import hashlib
import json
import logging
import os
import re
import secrets
import time
from datetime import datetime, timedelta
from functools import wraps

import bcrypt
from flask import Blueprint, current_app, g, jsonify, request
from flask_jwt_extended import (
    create_access_token, get_jwt_identity, jwt_required, set_access_cookies,
    unset_jwt_cookies,
)
from sqlalchemy import func
from werkzeug.utils import secure_filename

from extensions import db, limiter
from routes.settings_routes import is_setting_enabled
from models.models import (
    Lead, LeadHistory, Owner, Property, PropertyContact, PropertyFeature,
    PropertyImage, PropertyTypeField, PropertyValue, PresetFeature,
)
from utils.mailer import frontend_url, password_reset_email, send_email_async, verification_email
from utils.supabase_storage import delete_file, upload_file

logger = logging.getLogger("realtyhub")

owner_bp = Blueprint("owner", __name__)

VALID_TRANSACTION_TYPES = {"sell", "rent"}
VALID_PROPERTY_TYPES = {"flat", "house", "plot", "commercial", "villa", "bungalow", "penthouse", "other"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MOBILE_RE = re.compile(r"^[0-9+\-\s()]{10,20}$")
MIN_PASSWORD_LENGTH = 8


def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_owner_id():
    ident = str(get_jwt_identity() or "")
    if not ident.startswith("owner:"):
        return None
    try:
        return int(ident.split(":", 1)[1])
    except ValueError:
        return None


def owner_required(fn):
    @jwt_required()
    @wraps(fn)
    def wrapper(*args, **kwargs):
        owner_id = get_owner_id()
        if not owner_id:
            return jsonify({"error": "Owner login required"}), 401
        owner = Owner.query.get(owner_id)
        if not owner or not owner.is_active:
            return jsonify({"error": "Owner login required"}), 401
        g.owner = owner
        return fn(*args, **kwargs)
    return wrapper


def owner_verified(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not g.owner.is_verified:
            return jsonify({"error": "Please verify your email before posting properties"}), 403
        return fn(*args, **kwargs)
    return wrapper


def _own_or_404(prop_id):
    prop = Property.query.get(prop_id)
    if not prop or prop.owner_id != g.owner.id:
        return None
    return prop


def _parse_price(price_str):
    if not price_str:
        return None
    cleaned = re.sub(r"[₹$,]", "", str(price_str))
    multiplier = 1
    if re.search(r"\b(crore|cr)\b", cleaned, re.IGNORECASE):
        multiplier = 1_00_00_000
    elif re.search(r"\b(lakh|lac)\b", cleaned, re.IGNORECASE):
        multiplier = 1_00_000
    elif re.search(r"\bk\b", cleaned, re.IGNORECASE):
        multiplier = 1_000
    cleaned = re.sub(r"\b(lakh|lac|crore|cr|k)\b", "", cleaned, flags=re.IGNORECASE).strip()
    try:
        return float(cleaned) * multiplier
    except ValueError:
        return None


def _issue_cookie(resp, owner):
    token = create_access_token(identity=f"owner:{owner.id}")
    set_access_cookies(resp, token)


def _send_verification(owner):
    token = secrets.token_urlsafe(32)
    owner.verification_token = _hash_token(token)
    owner.verification_expiry = datetime.utcnow() + timedelta(hours=24)
    db.session.commit()
    send_email_async(
        "Verify your email - Nagpur Realty Hub",
        [owner.email],
        verification_email(owner.name, token),
    )


# =========================
# AUTH
# =========================
@owner_bp.route("/register", methods=["POST"])
@limiter.limit("10/hour")
def register():
    if not is_setting_enabled("allow_public_post", default=True):
        return jsonify({"error": "Public registration is currently disabled."}), 403
    data = request.json or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    mobile = (data.get("mobile") or "").strip()
    password = data.get("password") or ""

    if not name or len(name) > 120:
        return jsonify({"error": "Name is required"}), 400
    if not email or len(email) > 150 or not EMAIL_RE.match(email):
        return jsonify({"error": "A valid email address is required"}), 400
    if not mobile or not MOBILE_RE.match(mobile):
        return jsonify({"error": "A valid mobile number is required"}), 400
    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400

    if Owner.query.filter_by(email=email).first():
        return jsonify({"error": "An account with this email already exists"}), 409

    owner = Owner(
        name=name,
        email=email,
        mobile=mobile,
        password=bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8"),
        is_verified=False,
    )
    db.session.add(owner)
    db.session.commit()
    _send_verification(owner)
    return jsonify({
        "message": "Registration successful. Please check your email to verify your account.",
    }), 201


@owner_bp.route("/verify/<token>", methods=["GET"])
@limiter.limit("30/hour")
def verify_email(token):
    owner = Owner.query.filter_by(verification_token=_hash_token(token)).first()
    if not owner:
        return jsonify({"error": "Invalid or expired verification link"}), 400
    if owner.verification_expiry and owner.verification_expiry < datetime.utcnow():
        return jsonify({"error": "This verification link has expired. Please log in and resend it."}), 400

    owner.is_verified = True
    owner.verification_token = None
    owner.verification_expiry = None
    db.session.commit()

    resp = jsonify({
        "message": "Email verified successfully",
        "owner_id": owner.id,
        "name": owner.name,
        "email": owner.email,
        "is_verified": True,
    })
    _issue_cookie(resp, owner)
    return resp


@owner_bp.route("/resend-verification", methods=["POST"])
@limiter.limit("3/hour")
@owner_required
def resend_verification():
    if g.owner.is_verified:
        return jsonify({"message": "Email already verified"}), 200
    _send_verification(g.owner)
    return jsonify({"message": "Verification email sent"}), 200


@owner_bp.route("/login", methods=["POST"])
@limiter.limit("5/minute")
def login():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    owner = Owner.query.filter_by(email=email).first()
    if not owner or not bcrypt.checkpw(password.encode("utf-8"), owner.password.encode("utf-8")):
        return jsonify({"error": "Invalid credentials"}), 401
    if not owner.is_active:
        return jsonify({"error": "This account has been deactivated"}), 403

    owner.last_login = datetime.utcnow()
    db.session.commit()

    resp = jsonify({
        "message": "Login successful",
        "owner_id": owner.id,
        "name": owner.name,
        "email": owner.email,
        "is_verified": bool(owner.is_verified),
    })
    _issue_cookie(resp, owner)
    return resp


@owner_bp.route("/logout", methods=["POST"])
@owner_required
def logout():
    resp = jsonify({"message": "Logged out"})
    unset_jwt_cookies(resp)
    return resp


@owner_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("3/hour")
def forgot_password():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    owner = Owner.query.filter_by(email=email).first()
    if not owner or not EMAIL_RE.match(email) or not owner.is_active:
        return jsonify({"message": "If the email is registered, a reset link has been sent"})

    token = secrets.token_urlsafe(32)
    owner.reset_token = _hash_token(token)
    owner.reset_token_expiry = datetime.utcnow() + timedelta(minutes=15)
    db.session.commit()

    reset_link = frontend_url(f"owner-reset-password/{token}")
    send_email_async(
        "Reset Your Password - Nagpur Realty Hub",
        [owner.email],
        password_reset_email(reset_link),
    )
    return jsonify({"message": "If the email is registered, a reset link has been sent"})


@owner_bp.route("/reset-password/<token>", methods=["POST"])
@limiter.limit("5/hour")
def reset_password(token):
    data = request.json or {}
    if not token:
        return jsonify({"error": "Token is required"}), 400

    owners = Owner.query.filter(Owner.reset_token.isnot(None), Owner.reset_token_expiry.isnot(None)).all()
    owner = None
    for o in owners:
        if o.reset_token_expiry and o.reset_token_expiry < datetime.utcnow():
            continue
        if _hash_token(token) == o.reset_token:
            owner = o
            break
    if not owner:
        return jsonify({"error": "Invalid or expired token"}), 400

    password = data.get("password") or ""
    if len(password) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400

    owner.password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    owner.reset_token = None
    owner.reset_token_expiry = None
    db.session.commit()
    return jsonify({"message": "Password reset successful"})


@owner_bp.route("/check-auth", methods=["GET"])
@owner_required
def check_auth():
    owner = g.owner
    return jsonify({
        "owner_id": owner.id,
        "name": owner.name,
        "email": owner.email,
        "mobile": owner.mobile,
        "is_verified": bool(owner.is_verified),
    })


# =========================
# MY PROPERTIES
# =========================
@owner_bp.route("/properties", methods=["GET"])
@owner_required
def my_properties():
    props = Property.query.filter_by(owner_id=g.owner.id).order_by(Property.created_at.desc()).all()
    ids = [p.id for p in props]
    lead_counts = {}
    if ids:
        lead_counts = dict(
            db.session.query(Lead.property_id, func.count(Lead.id))
            .filter(Lead.property_id.in_(ids))
            .group_by(Lead.property_id)
            .all()
        )
    result = []
    for p in props:
        first_image = p.images[0].image_url if p.images else None
        result.append({
            "id": p.id,
            "listing_id": p.listing_id,
            "title": p.title,
            "status": p.status,
            "is_active": bool(p.is_active),
            "is_closed": bool(p.is_closed),
            "price": float(p.price) if p.price is not None else None,
            "price_text": p.price_text,
            "location": p.location,
            "transaction_type": p.transaction_type,
            "property_type": p.property_type,
            "image": first_image,
            "lead_count": lead_counts.get(p.id, 0),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return jsonify(result)


def _field_defs():
    return {f.field_key: f.field_label for f in PropertyTypeField.query.all()}


@owner_bp.route("/properties/<int:id>", methods=["GET"])
@owner_required
def my_property(id):
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    field_defs = _field_defs()
    owner_pc = PropertyContact.query.filter_by(property_id=id, type="owner").first()
    return jsonify({
        "id": prop.id,
        "listing_id": prop.listing_id,
        "title": prop.title,
        "description": prop.description,
        "price": float(prop.price) if prop.price is not None else None,
        "price_text": prop.price_text,
        "location": prop.location,
        "transaction_type": prop.transaction_type,
        "property_type": prop.property_type,
        "status": prop.status,
        "is_active": bool(prop.is_active),
        "is_closed": bool(prop.is_closed),
        "overview_template_id": prop.overview_template_id,
        "closing_template_id": prop.closing_template_id,
        "title_template_id": prop.title_template_id,
        "images": [{"id": img.id, "image_url": img.image_url, "order": img.order} for img in prop.images],
        "field_values": [
            {"field_key": fv.field_key, "field_value": fv.field_value,
             "field_label": field_defs.get(fv.field_key, fv.field_key)}
            for fv in PropertyValue.query.filter_by(property_id=id).all()
        ],
        "feature_ids": [pf.id for pf in (prop.features or [])],
        "contact": {
            "name": owner_pc.name if owner_pc else g.owner.name,
            "mobile": owner_pc.mobile if owner_pc else g.owner.mobile,
            "email": owner_pc.email if owner_pc else g.owner.email,
        },
        "created_at": prop.created_at.isoformat() if prop.created_at else None,
    })


def _delete_image(img):
    url = img.image_url or ""
    path = url
    if path.startswith("uploads/"):
        path = path[len("uploads/"):]
    elif "/uploads/" in path:
        path = path.split("/uploads/", 1)[1]
    try:
        delete_file(path)
    except Exception as e:
        logger.warning("Failed to delete image %s: %s", url, e)


@owner_bp.route("/properties/<int:id>", methods=["PUT"])
@owner_required
@owner_verified
@limiter.limit("20/hour")
def update_my_property(id):
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    data = request.form if request.form else request.json or {}

    title = (data.get("title") or prop.title or "").strip()
    location = (data.get("location") or prop.location or "").strip()
    if not title or len(title) > 255:
        return jsonify({"error": "Title is required"}), 400
    if not location or len(location) > 255:
        return jsonify({"error": "Location is required"}), 400
    prop.title = title
    prop.location = location

    if data.get("description") is not None:
        prop.description = data.get("description")

    transaction_type = data.get("transaction_type")
    if transaction_type:
        if transaction_type not in VALID_TRANSACTION_TYPES:
            return jsonify({"error": "Invalid transaction type"}), 400
        prop.transaction_type = transaction_type
    property_type = data.get("property_type")
    if property_type:
        if property_type not in VALID_PROPERTY_TYPES:
            return jsonify({"error": "Invalid property type"}), 400
        prop.property_type = property_type

    if "price" in data:
        price_text = (data.get("price_text") or "").strip() or "*"
        prop.price_text = price_text
        if price_text.lower() in ("connect for price", "price on request"):
            prop.price = None
        else:
            prop.price = _parse_price(data.get("price"))

    # Re-review rule: owner edits to approved/rejected properties go back to pending
    re_review = False
    if prop.status in ("approved", "rejected"):
        prop.status = "pending"
        prop.is_active = False
        re_review = True

    # Sync the property's owner contact card with the owner profile
    owner_pc = PropertyContact.query.filter_by(property_id=id, type="owner").first()
    if owner_pc:
        owner_pc.name = g.owner.name
        owner_pc.email = g.owner.email
        owner_pc.mobile = (data.get("mobile") or g.owner.mobile or owner_pc.mobile)
    else:
        db.session.add(PropertyContact(
            property_id=id, type="owner",
            name=g.owner.name, email=g.owner.email,
            mobile=data.get("mobile") or g.owner.mobile,
        ))

    # Replace field values
    field_values_raw = data.get("field_values")
    if field_values_raw:
        try:
            fv_list = json.loads(field_values_raw) if isinstance(field_values_raw, str) else field_values_raw
            existing = {fv.field_key: fv for fv in PropertyValue.query.filter_by(property_id=id).all()}
            kept_keys = set()
            for item in fv_list:
                fk = item.get("field_key")
                if not fk:
                    continue
                kept_keys.add(fk)
                if fk in existing:
                    existing[fk].field_value = item.get("field_value", "")
                else:
                    db.session.add(PropertyValue(property_id=id, field_key=fk, field_value=item.get("field_value", "")))
            for k, fv in existing.items():
                if k not in kept_keys:
                    db.session.delete(fv)
        except Exception as e:
            logger.warning("Failed to update field_values for property %s: %s", id, e)

    # Replace features
    if "feature_ids" in data:
        try:
            fids = json.loads(data["feature_ids"]) if isinstance(data["feature_ids"], str) else data["feature_ids"]
            valid_ids = []
            for fid in fids:
                if PresetFeature.query.get(int(fid)):
                    valid_ids.append(int(fid))
            PropertyFeature.query.filter_by(property_id=id).delete()
            for fid in valid_ids:
                db.session.add(PropertyFeature(property_id=id, feature_id=fid))
        except Exception as e:
            logger.warning("Failed to update feature_ids for property %s: %s", id, e)

    db.session.flush()

    # Remove images requested by the owner
    remove_raw = data.get("remove_image_ids")
    if remove_raw:
        try:
            remove_ids = json.loads(remove_raw) if isinstance(remove_raw, str) else remove_raw
            for img_id in remove_ids:
                img = PropertyImage.query.filter_by(id=int(img_id), property_id=id).first()
                if img:
                    _delete_image(img)
                    db.session.delete(img)
        except Exception as e:
            logger.warning("Failed to remove images for property %s: %s", id, e)

    # Append new images
    files = request.files.getlist("images")
    if files:
        safe_folder = prop.listing_id
        max_order = db.session.query(func.max(PropertyImage.order)).filter_by(property_id=id).scalar()
        start_order = (max_order or 0) + 1
        saved_paths = []
        total_size = 0
        try:
            for i, file in enumerate(files):
                if not file or not file.filename:
                    continue
                ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
                if ext not in current_app.config.get("ALLOWED_EXTENSIONS", {"png", "jpg", "jpeg", "gif", "webp", "avif"}):
                    return jsonify({"error": f"File type .{ext} not allowed"}), 400
                file.seek(0, os.SEEK_END)
                total_size += file.tell()
                file.seek(0)
                if total_size > current_app.config.get("MAX_FILE_SIZE", 10 * 1024 * 1024):
                    return jsonify({"error": "File too large (max 10MB)"}), 400
                filename = f"{time.time_ns()}_{secure_filename(file.filename)}"
                path = f"{safe_folder}/{filename}" if safe_folder else filename
                url_path = upload_file(file, path)
                saved_paths.append(path)
                db.session.add(PropertyImage(property_id=id, image_url=url_path, order=start_order + i))
        except Exception:
            db.session.rollback()
            for p in saved_paths:
                try:
                    delete_file(p)
                except Exception:
                    pass
            raise

    db.session.commit()
    return jsonify({
        "message": "Property updated. Pending review." if re_review else "Property updated",
        "status": prop.status,
        "re_review": re_review,
    })


# =========================
# CLOSE / REOPEN
# =========================
@owner_bp.route("/properties/<int:id>/close", methods=["POST"])
@owner_required
def close_my_property(id):
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if prop.is_closed:
        return jsonify({"message": "Property already closed"}), 200
    prop.is_closed = True
    prop.is_active = False
    prop.closed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"message": "Property closed"})


@owner_bp.route("/properties/<int:id>/reopen", methods=["POST"])
@owner_required
def reopen_my_property(id):
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if not prop.is_closed:
        return jsonify({"message": "Property is not closed"}), 200
    prop.is_closed = False
    prop.is_active = prop.status == "approved"
    prop.closed_at = None
    db.session.commit()
    return jsonify({"message": "Property reopened"})


# =========================
# LEADS / CONNECT REQUESTS
# =========================
VALID_STAGES = {"NEW", "CONTACTED", "SITE_VISIT", "NEGOTIATION", "CLOSED"}


def _own_lead_or_404(lead_id):
    lead = (
        Lead.query.join(Property, Lead.property_id == Property.id)
        .filter(Lead.id == lead_id, Property.owner_id == g.owner.id)
        .first()
    )
    return lead


def _owner_leads_query():
    return Lead.query.join(Property, Lead.property_id == Property.id).filter(
        Property.owner_id == g.owner.id
    )


def _owner_lead_dict(lead):
    return {
        "id": lead.id,
        "property_id": lead.property_id,
        "property_title": lead.property.title if lead.property else None,
        "listing_id": lead.property.listing_id if lead.property else None,
        "name": lead.name,
        "email": lead.email,
        "mobile": lead.mobile,
        "source": lead.source,
        "stage": lead.stage or "NEW",
        "lead_status": lead.lead_status or "ACTIVE",
        "rejection_reason": lead.rejection_reason,
        "notes": lead.notes,
        "follow_up_date": lead.follow_up_at.isoformat() if lead.follow_up_at else None,
        "archived_at": lead.archived_at.isoformat() if lead.archived_at else None,
        "created_at": lead.created_at.isoformat() if lead.created_at else None,
    }


def _owner_lead_detail(lead):
    detail = _owner_lead_dict(lead)
    history = (
        LeadHistory.query.filter_by(lead_id=lead.id)
        .order_by(LeadHistory.created_at.desc())
        .all()
    )
    detail["history"] = [{
        "id": h.id,
        "previous_status": None,
        "new_status": None,
        "remarks": h.remarks,
        "interaction_type": h.type,
        "follow_up_date": h.followup_date.isoformat() if h.followup_date else None,
        "created_at": h.created_at.isoformat() if h.created_at else None,
    } for h in history]
    return detail


def _parse_followup_date(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        try:
            return datetime.strptime(str(value), "%Y-%m-%d")
        except (ValueError, TypeError):
            return None


@owner_bp.route("/leads", methods=["GET"])
@owner_required
def my_leads():
    query = _owner_leads_query().filter(Lead.archived_at.is_(None))
    stage = request.args.get("stage")
    if stage in VALID_STAGES:
        query = query.filter(Lead.stage == stage)
    leads = query.order_by(Lead.created_at.desc()).all()
    return jsonify([_owner_lead_dict(lead) for lead in leads])


@owner_bp.route("/leads/archived", methods=["GET"])
@owner_required
def my_archived_leads():
    search = request.args.get("search", "").strip()
    query = _owner_leads_query().filter(Lead.archived_at.isnot(None))
    if search:
        like = f"%{search}%"
        query = query.filter(db.or_(
            Lead.name.ilike(like), Lead.email.ilike(like), Lead.mobile.ilike(like)
        ))
    leads = query.order_by(Lead.archived_at.desc()).all()
    return jsonify([_owner_lead_dict(lead) for lead in leads])


@owner_bp.route("/leads/followups", methods=["GET"])
@owner_required
def my_lead_followups():
    owned_ids = [row[0] for row in db.session.query(Lead.id).join(
        Property, Lead.property_id == Property.id
    ).filter(Property.owner_id == g.owner.id).all()]
    if not owned_ids:
        return jsonify([])
    history = (
        LeadHistory.query.filter(
            LeadHistory.lead_id.in_(owned_ids),
            LeadHistory.followup_date.isnot(None),
        ).order_by(LeadHistory.followup_date.asc()).limit(500).all()
    )
    results = []
    for h in history:
        lead = Lead.query.get(h.lead_id)
        if not lead:
            continue
        results.append({
            "id": h.id,
            "lead_id": h.lead_id,
            "type": h.type,
            "remarks": h.remarks,
            "followup_date": h.followup_date.isoformat() if h.followup_date else None,
            "lead_name": lead.name,
            "lead_mobile": lead.mobile,
            "lead_email": lead.email,
            "source": lead.source,
            "stage": lead.stage or "NEW",
            "lead_status": lead.lead_status or "ACTIVE",
            "property_title": lead.property.title if lead.property else None,
        })
    return jsonify(results)


@owner_bp.route("/leads/<int:id>", methods=["GET"])
@owner_required
def my_lead_detail(id):
    lead = _own_lead_or_404(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    return jsonify(_owner_lead_detail(lead))


@owner_bp.route("/leads/<int:id>/stage", methods=["PATCH"])
@owner_required
def update_my_lead_stage(id):
    lead = _own_lead_or_404(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    data = request.json or {}
    if data.get("stage") in VALID_STAGES:
        lead.stage = data["stage"]
    if "lead_status" in data:
        lead.lead_status = data["lead_status"]
    if "follow_up_at" in data:
        lead.follow_up_at = _parse_followup_date(data["follow_up_at"])
    db.session.add(LeadHistory(
        lead_id=id, type="System Note",
        remarks=f"Stage changed to {lead.stage}",
    ))
    db.session.commit()
    return jsonify({"message": "Stage updated", "stage": lead.stage})


@owner_bp.route("/leads/<int:id>/interactions", methods=["POST"])
@owner_required
def add_my_lead_interaction(id):
    lead = _own_lead_or_404(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    data = request.json or {}
    followup_date = _parse_followup_date(data.get("follow_up_date"))
    db.session.add(LeadHistory(
        lead_id=id,
        type=data.get("interaction_type") or data.get("type") or "System Note",
        remarks=data.get("remarks"),
        followup_date=followup_date,
    ))
    if data.get("stage") in VALID_STAGES:
        lead.stage = data["stage"]
    if data.get("lead_status"):
        lead.lead_status = data["lead_status"]
    if followup_date:
        lead.follow_up_at = followup_date
    db.session.commit()
    return jsonify({"message": "Interaction added"}), 201


@owner_bp.route("/leads/<int:id>/not-interested", methods=["POST"])
@owner_required
def mark_my_lead_not_interested(id):
    lead = _own_lead_or_404(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    data = request.json or {}
    lead.stage = "CLOSED"
    lead.lead_status = "NOT_INTERESTED"
    lead.rejection_reason = data.get("reason")
    lead.notes = data.get("notes")
    lead.archived_at = datetime.utcnow()
    db.session.add(LeadHistory(
        lead_id=id, type="System Note",
        remarks=f"Marked as Not Interested: {data.get('reason') or ''}".strip(),
    ))
    db.session.commit()
    return jsonify({"message": "Lead archived"})


@owner_bp.route("/leads/<int:id>/reopen", methods=["POST"])
@owner_required
def reopen_my_lead(id):
    lead = _own_lead_or_404(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    lead.stage = "NEW"
    lead.lead_status = "ACTIVE"
    lead.archived_at = None
    lead.rejection_reason = None
    db.session.add(LeadHistory(
        lead_id=id, type="System Note", remarks="Lead reopened",
    ))
    db.session.commit()
    return jsonify({"message": "Lead reopened"})
