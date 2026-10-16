import csv
import hashlib
import io
import json
import logging
import os
import re
import secrets
import time
import zipfile
from datetime import datetime, timedelta
from functools import wraps

import bcrypt
from flask import Blueprint, current_app, g, jsonify, request, send_file
from sqlalchemy import func
from werkzeug.utils import secure_filename

from extensions import db, limiter
from routes.settings_routes import is_setting_enabled
from models.models import (
    ConsentRecord, Lead, LeadHistory, ListingTransaction, Owner, Property,
    PropertyContact, PropertyFeature, PropertyImage, PropertyTypeField,
    PropertyValue, PresetFeature, SavedSearch,
)
from utils.consent import consent_given, record_consent
from utils.mailer import frontend_url, get_site_name, password_reset_email, send_email_async, verification_email
from utils.supabase_storage import delete_file
from utils.images import process_image_upload
from utils.auth import revoke_token
from utils.owner_auth import (
    issue_owner_session, clear_owner_session, load_owner_payload,
    owner_csrf_ok, owner_id_from_payload,
)
from utils import payments as payment_gateway
from utils.listing_lifecycle import (
    featured_plan, plan_for, payment_required, currency as plan_currency,
    listing_state, days_until_expiry, plans_payload, lead_details_locked,
    is_effectively_featured, can_feature_another, FeaturedSlotsFullError,
    combo_plan,
)

logger = logging.getLogger("realtyhub")

owner_bp = Blueprint("owner", __name__)

VALID_TRANSACTION_TYPES = {"buy", "sell", "rent", "resale"}
VALID_PROPERTY_TYPES = {"flat", "house", "plot", "commercial", "villa", "bungalow", "penthouse", "other"}
VALID_LISTED_BY = {"owner", "agent", "broker"}
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MOBILE_RE = re.compile(r"^[0-9+\-\s()]{10,20}$")
MIN_PASSWORD_LENGTH = 8


def _hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def owner_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        payload = load_owner_payload()
        if not payload:
            return jsonify({"error": "Owner login required"}), 401
        if not owner_csrf_ok(payload):
            return jsonify({"error": "Missing CSRF token"}), 401
        owner_id = owner_id_from_payload(payload)
        owner = Owner.query.get(owner_id) if owner_id else None
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


def _parse_coord(value, min_v, max_v):
    """Parse a latitude/longitude value; return None when missing/invalid."""
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        if value == "":
            return None
    try:
        num = float(value)
    except (ValueError, TypeError):
        return None
    if num < min_v or num > max_v:
        return None
    return num


def _issue_cookie(resp, owner):
    # Isolated owner cookies (separate from the admin access_token_cookie).
    return issue_owner_session(resp, owner)


def _send_verification(owner):
    token = secrets.token_urlsafe(32)
    owner.verification_token = _hash_token(token)
    owner.verification_expiry = datetime.utcnow() + timedelta(hours=24)
    db.session.commit()
    send_email_async(
        f"Verify your email - {get_site_name()}",
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
    if not consent_given():
        return jsonify({"error": "Please accept the terms and privacy notice to continue"}), 400

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
    record_consent("registration", "owner", email=email, subject_id=owner.id)
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
def logout():
    # No @owner_required: owner cookies must clear even when the token has
    # already expired or been revoked (session-expiry logout). Only the owner
    # cookies are touched here so an admin session is never affected.
    payload = load_owner_payload()
    if payload:
        revoke_token(payload.get("jti"))
    resp = jsonify({"message": "Logged out"})
    clear_owner_session(resp)
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
        f"Reset Your Password - {get_site_name()}",
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
            "listed_by": p.listed_by or "owner",
            "rera_details": p.rera_details or None,
            "image": first_image,
            "lead_count": lead_counts.get(p.id, 0),
            "created_at": p.created_at.isoformat() if p.created_at else None,
            # Paid-listing lifecycle
            "payment_status": p.payment_status or "unpaid",
            "expires_at": p.expires_at.isoformat() if p.expires_at else None,
            "featured_until": p.featured_until.isoformat() if p.featured_until else None,
            "renewal_count": p.renewal_count or 0,
            "listing_state": listing_state(p),
            "days_until_expiry": days_until_expiry(p),
            "is_featured": bool(p.is_featured),
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
        "latitude": float(prop.latitude) if prop.latitude is not None else None,
        "longitude": float(prop.longitude) if prop.longitude is not None else None,
        "transaction_type": prop.transaction_type,
        "property_type": prop.property_type,
        "listed_by": prop.listed_by or "owner",
        "rera_details": prop.rera_details or None,
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
        # Paid-listing lifecycle
        "payment_status": prop.payment_status or "unpaid",
        "expires_at": prop.expires_at.isoformat() if prop.expires_at else None,
        "featured_until": prop.featured_until.isoformat() if prop.featured_until else None,
        "renewal_count": prop.renewal_count or 0,
        "listing_state": listing_state(prop),
        "days_until_expiry": days_until_expiry(prop),
        "is_featured": bool(prop.is_featured),
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

    if "latitude" in data:
        prop.latitude = _parse_coord(data.get("latitude"), -90, 90)
    if "longitude" in data:
        prop.longitude = _parse_coord(data.get("longitude"), -180, 180)

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
    listed_by = data.get("listed_by")
    if listed_by:
        if listed_by not in VALID_LISTED_BY:
            return jsonify({"error": "Invalid listed by"}), 400
        prop.listed_by = listed_by
    if "rera_details" in data:
        prop.rera_details = (data.get("rera_details") or "").strip() or None

    if "price" in data:
        price_text = (data.get("price_text") or "").strip() or "*"
        prop.price_text = price_text
        if price_text.lower() in ("connect for price", "price on request"):
            prop.price = None
        else:
            prop.price = _parse_price(data.get("price"))

    # Re-review rule: only edits to rejected properties go back to pending for
    # re-approval. Edits to already-approved properties stay approved.
    re_review = False
    if prop.status == "rejected":
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
                url_path = process_image_upload(file, path)
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


@owner_bp.route("/properties/<int:id>/gallery-images", methods=["POST"])
@owner_required
@owner_verified
def add_owner_gallery_images(id):
    """Attach images from gallery URLs to one of the owner's properties."""
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    data = request.get_json(silent=True) or {}
    urls = data.get("urls") or []
    if not isinstance(urls, list):
        return jsonify({"error": "urls array is required"}), 400
    urls = [u.strip() for u in urls if isinstance(u, str) and u.strip()]
    if not urls:
        return jsonify({"error": "No URLs provided"}), 400
    max_order = db.session.query(func.max(PropertyImage.order)).filter_by(property_id=id).scalar()
    start_order = (max_order or 0) + 1
    for i, url in enumerate(urls):
        db.session.add(PropertyImage(property_id=id, image_url=url, order=start_order + i))
    db.session.commit()
    return jsonify({"message": "Gallery images attached", "urls": urls}), 201


@owner_bp.route("/properties/<int:id>/reorder-images", methods=["POST"])
@owner_required
@owner_verified
def reorder_owner_images(id):
    """Reorder images belonging to one of the owner's properties."""
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    data = request.json
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of {id, order}"}), 400
    for item in data:
        if not isinstance(item, dict) or "id" not in item or "order" not in item:
            return jsonify({"error": "Each item must have 'id' and 'order'"}), 400
    for item in data:
        img = PropertyImage.query.filter_by(id=item["id"], property_id=id).first()
        if img:
            img.order = item["order"]
    db.session.commit()
    return jsonify({"message": "Reordered"})


@owner_bp.route("/preset-features", methods=["POST"])
@owner_required
def create_owner_preset_feature():
    """Quick-add a new key feature; shared across all listings (deduped by label)."""
    data = request.get_json(silent=True) or {}
    label = (data.get("label") or "").strip()
    if not label:
        return jsonify({"error": "Feature label is required"}), 400
    if len(label) > 100:
        return jsonify({"error": "Feature label is too long"}), 400
    existing = PresetFeature.query.filter(func.lower(PresetFeature.label) == label.lower()).first()
    if existing:
        return jsonify({
            "id": existing.id, "label": existing.label,
            "sentence": existing.sentence, "existing": True,
        }), 200
    sentence = (data.get("sentence") or "").strip() or f"{label} available."
    max_order = db.session.query(func.max(PresetFeature.sort_order)).scalar() or 0
    feat = PresetFeature(label=label, sentence=sentence, is_active=True, sort_order=max_order + 1)
    db.session.add(feat)
    db.session.commit()
    return jsonify({
        "id": feat.id, "label": feat.label,
        "sentence": feat.sentence, "existing": False,
    }), 201


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
# PAID LISTING LIFECYCLE (checkout / renew / feature)
# =========================
def _txn_dict(txn):
    return {
        "id": txn.id,
        "property_id": txn.property_id,
        "property_title": txn.property.title if txn.property else None,
        "purpose": txn.purpose,
        "amount": float(txn.amount) if txn.amount is not None else None,
        "currency": txn.currency,
        "duration_days": txn.duration_days,
        "featured_days": txn.featured_days or 0,
        "discount_percent": float(txn.discount_percent) if txn.discount_percent else 0,
        "status": txn.status,
        "method": txn.method,
        "provider": txn.provider,
        "provider_order_id": txn.provider_order_id,
        "created_at": txn.created_at.isoformat() if txn.created_at else None,
        "paid_at": txn.paid_at.isoformat() if txn.paid_at else None,
    }


def _create_checkout(prop, purpose):
    """Create a pending transaction and provider order for a listing/feature/combo."""
    featured_days = 0
    discount_percent = 0

    if purpose == "featured":
        # A slot is only needed when the property is not already featured.
        if not is_effectively_featured(prop) and not can_feature_another():
            raise FeaturedSlotsFullError()
        plan = featured_plan()
        amount = plan["price"]
        duration_days = plan["duration_days"]
    elif purpose == "combo":
        # Listing validity + featured add-on, discounted as a bundle.
        if not is_effectively_featured(prop) and not can_feature_another():
            raise FeaturedSlotsFullError()
        plan = combo_plan(prop.transaction_type)
        amount = plan["amount"]
        duration_days = plan["duration_days"]
        featured_days = plan["featured_days"]
        discount_percent = plan["discount_percent"]
    else:
        plan = plan_for(prop.transaction_type)
        amount = plan["price"]
        duration_days = plan["duration_days"]

    provider = payment_gateway.get_payment_provider()
    currency = plan_currency()

    txn = ListingTransaction(
        property_id=prop.id,
        owner_id=g.owner.id,
        purpose=purpose,
        transaction_type=prop.transaction_type,
        amount=amount,
        currency=currency,
        duration_days=duration_days,
        featured_days=featured_days,
        discount_percent=discount_percent,
        provider=provider.name,
        method="online",
        status="pending",
    )
    db.session.add(txn)
    db.session.flush()

    order = provider.create_order(
        amount, currency, receipt=f"txn_{txn.id}",
        notes={
            "transaction_id": str(txn.id),
            "property_id": str(prop.id),
            "purpose": purpose,
        },
    )
    txn.provider_order_id = order["order_id"]
    db.session.commit()

    return {
        "transaction_id": txn.id,
        "purpose": purpose,
        "amount": amount,
        "currency": currency,
        "duration_days": duration_days,
        "featured_days": featured_days,
        "discount_percent": discount_percent,
        "provider": provider.name,
        "uses_client_js": getattr(provider, "uses_client_js", False),
        "public_key": getattr(provider, "public_key", ""),
        "order": order,
    }


@owner_bp.route("/plans", methods=["GET"])
@owner_required
def owner_plans():
    return jsonify(plans_payload())


@owner_bp.route("/properties/<int:id>/checkout", methods=["POST"])
@owner_required
@owner_verified
@limiter.limit("30/hour")
def checkout_property(id):
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if prop.is_closed:
        return jsonify({"error": "Reopen the property before purchasing for it"}), 400
    data = request.json or {}
    purpose = (data.get("purpose") or "listing").strip().lower()
    if purpose not in ("listing", "featured", "combo"):
        return jsonify({"error": "Invalid purpose"}), 400
    if purpose == "combo" and is_effectively_featured(prop):
        return jsonify({"error": "This listing is already featured. Extend the boost from the Feature action instead.",
                        "code": "already_featured"}), 400
    try:
        payload = _create_checkout(prop, purpose)
    except FeaturedSlotsFullError:
        return jsonify({"error": "All featured slots are currently full. Please try again later.",
                        "code": "featured_full"}), 409
    except payment_gateway.PaymentConfigurationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.warning("Checkout failed property=%s: %s", id, e)
        return jsonify({"error": "Could not start checkout"}), 500
    return jsonify(payload), 201


@owner_bp.route("/properties/<int:id>/renew", methods=["POST"])
@owner_required
@owner_verified
@limiter.limit("30/hour")
def renew_property(id):
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    try:
        return jsonify(_create_checkout(prop, "listing")), 201
    except payment_gateway.PaymentConfigurationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.warning("Renew checkout failed property=%s: %s", id, e)
        return jsonify({"error": "Could not start renewal"}), 500


@owner_bp.route("/properties/<int:id>/feature", methods=["POST"])
@owner_required
@owner_verified
@limiter.limit("30/hour")
def feature_property(id):
    prop = _own_or_404(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    try:
        return jsonify(_create_checkout(prop, "featured")), 201
    except FeaturedSlotsFullError:
        return jsonify({"error": "All featured slots are currently full. Please try again later.",
                        "code": "featured_full"}), 409
    except payment_gateway.PaymentConfigurationError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        logger.warning("Feature checkout failed property=%s: %s", id, e)
        return jsonify({"error": "Could not start checkout"}), 500


@owner_bp.route("/transactions", methods=["GET"])
@owner_required
def my_transactions():
    rows = ListingTransaction.query.filter_by(owner_id=g.owner.id).order_by(
        ListingTransaction.created_at.desc()
    ).all()
    return jsonify([_txn_dict(t) for t in rows])


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
    locked = lead_details_locked(lead.property, lead)
    return {
        "id": lead.id,
        "property_id": lead.property_id,
        "property_title": lead.property.title if lead.property else None,
        "listing_id": lead.property.listing_id if lead.property else None,
        "locked": locked,
        "name": "Locked enquiry" if locked else lead.name,
        "email": None if locked else lead.email,
        "mobile": None if locked else lead.mobile,
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
        locked = lead_details_locked(lead.property, lead)
        results.append({
            "id": h.id,
            "lead_id": h.lead_id,
            "type": h.type,
            "remarks": h.remarks,
            "followup_date": h.followup_date.isoformat() if h.followup_date else None,
            "locked": locked,
            "lead_name": "Locked enquiry" if locked else lead.name,
            "lead_mobile": None if locked else lead.mobile,
            "lead_email": None if locked else lead.email,
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


_EXPORT_CSV_COLUMNS = {
    "account": ["id", "name", "email", "mobile", "is_verified", "is_active", "created_at", "last_login"],
    "properties": ["id", "listing_id", "title", "description", "location", "price", "status", "is_active", "created_at"],
    "leads": ["id", "property_id", "name", "email", "mobile", "source", "stage", "lead_status", "notes", "created_at"],
    "saved_searches": ["id", "name", "params", "notify", "is_active", "created_at"],
    "consents": ["purpose", "version", "granted", "created_at"],
}


def _csv_cell(value):
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)
    return value


def _csv_bytes(columns, rows):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(columns)
    for row in rows:
        writer.writerow([_csv_cell(row.get(col)) for col in columns])
    # utf-8-sig so Excel opens non-ASCII (e.g. the rupee sign) correctly.
    return buf.getvalue().encode("utf-8-sig")


def _export_data_zip(payload):
    """Bundle the export sections into a .zip of Excel-friendly .csv files."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for name, columns in _EXPORT_CSV_COLUMNS.items():
            section = payload.get(name)
            if isinstance(section, list):
                rows = section
            elif section:
                rows = [section]
            else:
                rows = []
            zf.writestr(f"{name}.csv", _csv_bytes(columns, rows))
    buf.seek(0)
    filename = f"my-realtyhub-data-{datetime.utcnow().strftime('%Y-%m-%d')}.zip"
    return send_file(buf, mimetype="application/zip", as_attachment=True, download_name=filename)


@owner_bp.route("/data-export", methods=["GET"])
@owner_required
def export_my_data():
    """DPDP data portability: return everything we hold about this owner.

    Defaults to JSON; pass ?format=csv for a .zip of .csv files (also accepts
    ?format=zip).
    """
    owner = g.owner
    props = Property.query.filter_by(owner_id=owner.id).all()
    prop_ids = [p.id for p in props]

    leads = []
    if prop_ids:
        for lead in Lead.query.filter(Lead.property_id.in_(prop_ids)).order_by(Lead.created_at.desc()).all():
            locked = lead_details_locked(lead.property, lead)
            leads.append({
                "id": lead.id,
                "property_id": lead.property_id,
                "locked": locked,
                "name": "Locked enquiry" if locked else lead.name,
                "email": None if locked else lead.email,
                "mobile": None if locked else lead.mobile,
                "source": lead.source,
                "stage": lead.stage,
                "lead_status": lead.lead_status,
                "notes": lead.notes,
                "created_at": lead.created_at.isoformat() if lead.created_at else None,
            })

    searches = [
        {"id": s.id, "name": s.name, "params": s.params, "notify": bool(s.notify),
         "is_active": bool(s.is_active), "created_at": s.created_at.isoformat() if s.created_at else None}
        for s in SavedSearch.query.filter_by(owner_id=owner.id).all()
    ]

    consents = [
        {"purpose": c.purpose, "version": c.version, "granted": bool(c.granted),
         "created_at": c.created_at.isoformat() if c.created_at else None}
        for c in ConsentRecord.query.filter_by(subject_type="owner", subject_id=owner.id).all()
    ]

    payload = {
        "exported_at": datetime.utcnow().isoformat(),
        "account": {
            "id": owner.id,
            "name": owner.name,
            "email": owner.email,
            "mobile": owner.mobile,
            "is_verified": bool(owner.is_verified),
            "is_active": bool(owner.is_active),
            "created_at": owner.created_at.isoformat() if owner.created_at else None,
            "last_login": owner.last_login.isoformat() if owner.last_login else None,
        },
        "properties": [
            {"id": p.id, "listing_id": p.listing_id, "title": p.title,
             "description": p.description, "location": p.location,
             "price": float(p.price) if p.price is not None else None,
             "status": p.status, "is_active": bool(p.is_active),
             "created_at": p.created_at.isoformat() if p.created_at else None}
            for p in props
        ],
        "leads": leads,
        "saved_searches": searches,
        "consents": consents,
    }

    if request.args.get("format", "json").lower() in ("csv", "zip"):
        return _export_data_zip(payload)

    return jsonify(payload)


@owner_bp.route("/delete-account", methods=["POST"])
@owner_required
def delete_my_account():
    """DPDP erasure: anonymize the owner and scrub their personal data, then deactivate.

    The row is kept (anonymized) to preserve referential integrity with leads,
    properties and audit history.
    """
    owner = g.owner

    props = Property.query.filter_by(owner_id=owner.id).all()
    prop_ids = [p.id for p in props]

    if prop_ids:
        Lead.query.filter(Lead.property_id.in_(prop_ids)).update(
            {
                Lead.name: "Redacted",
                Lead.email: None,
                Lead.mobile: None,
                Lead.notes: None,
            },
            synchronize_session=False,
        )
        PropertyContact.query.filter(PropertyContact.property_id.in_(prop_ids)).delete(
            synchronize_session=False
        )
        Property.query.filter(Property.id.in_(prop_ids)).update(
            {Property.is_active: False, Property.is_closed: True},
            synchronize_session=False,
        )

    SavedSearch.query.filter_by(owner_id=owner.id).delete(synchronize_session=False)
    ConsentRecord.query.filter_by(subject_type="owner", subject_id=owner.id).delete(
        synchronize_session=False
    )

    owner.name = "Deleted user"
    owner.email = f"deleted+{owner.id}@deleted.local"
    owner.mobile = None
    owner.password = bcrypt.hashpw(secrets.token_urlsafe(24).encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    owner.verification_token = None
    owner.verification_expiry = None
    owner.reset_token = None
    owner.reset_token_expiry = None
    owner.is_verified = False
    owner.is_active = False

    db.session.commit()

    revoke_token((load_owner_payload() or {}).get("jti"))

    resp = jsonify({"message": "Your account and personal data have been deleted."})
    clear_owner_session(resp)
    return resp
