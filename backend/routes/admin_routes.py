from flask import Blueprint, request, jsonify, current_app, abort
from models.models import db, Property, Admin, PropertyImage, PropertyTypeField, PropertyValue, Lead, LeadStatus, LeadHistory, PresetFeature, PropertyFeature, PropertyAuditLog, PropertyContact, PasswordResetRequest, ActivityLog, Role, Permission, RolePermission
from models.contactus import Contactus
from models.analytics_model import PageVisit
from datetime import datetime, timedelta
from sqlalchemy import func, cast, String, or_
import bcrypt
import secrets
import os
import re
import time
import bleach
from werkzeug.utils import secure_filename
import jwt as pyjwt
from flask_jwt_extended import (
    create_access_token, set_access_cookies, jwt_required,
    get_jwt_identity, unset_jwt_cookies,
)
from extensions import limiter
from utils.helpers import generate_listing_id, paginate
from utils.supabase_storage import upload_file, delete_file
from utils.mailer import password_reset_email, send_email_async, submission_confirmed_email, submission_rejected_email
from utils.permissions import has_permission, is_admin, current_admin, admin_permissions, PERMISSION_CATALOG, require_permission
from routes.settings_routes import is_setting_enabled
import logging

logger = logging.getLogger("realtyhub")

admin_bp = Blueprint("admin", __name__)

DEFAULT_ALLOWED = {"png", "jpg", "jpeg", "gif", "webp", "avif"}


VALID_STATUSES = {"pending", "approved", "rejected"}
VALID_TRANSACTION_TYPES = {"sell", "rent"}
VALID_PROPERTY_TYPES = {"flat", "house", "plot", "commercial", "villa", "bungalow", "penthouse", "other"}


def _login_limit_key():
    return request.json.get("username", "unknown") if request.is_json else "unknown"
MIN_PASSWORD_LENGTH = 8


def _validate_file(file):
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if not ext:
        return False, "File has no extension"
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", DEFAULT_ALLOWED) if current_app else DEFAULT_ALLOWED
    if ext not in allowed:
        return False, f"File type .{ext} not allowed"

    signature_map = {
        b"\xff\xd8\xff": "jpg",
        b"\x89PNG\r\n\x1a\n": "png",
        b"GIF87a": "gif",
        b"GIF89a": "gif",
        b"RIFF": "webp",
        b"\x00\x00\x00\x1cftyp": "avif",
        b"\x00\x00\x00\x20ftyp": "avif",
    }
    file.seek(0)
    header = file.read(12)
    file.seek(0)
    matched = False
    for sig, fmt in signature_map.items():
        if header.startswith(sig):
            if fmt == ext:
                matched = True
                break
    if not matched and ext != "avif":
        return False, f"File content does not match .{ext} signature"

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    max_size = current_app.config.get("MAX_FILE_SIZE", 10 * 1024 * 1024) if current_app else 10 * 1024 * 1024
    if size > max_size:
        return False, "File too large (max 10MB)"
    return True, None


def _sanitize_html(text):
    if not text:
        return text
    ALLOWED_TAGS = ["b", "i", "u", "em", "strong", "p", "br", "ul", "ol", "li", "a", "span"]
    ALLOWED_ATTRS = {"a": ["href", "class", "rel", "target"], "span": ["class", "style"], "p": ["class"]}
    return bleach.clean(text, tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRS, strip=True)


def _hash_token(token):
    return bcrypt.hashpw(token.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _check_token(token, hashed):
    return bcrypt.checkpw(token.encode("utf-8"), hashed.encode("utf-8"))


def _log_activity(action, module=None, target=None):
    try:
        admin_id = get_jwt_identity()
        log = ActivityLog(user_id=int(admin_id) if admin_id else None, action=action, module=module, target=str(target) if target else None)
        db.session.add(log)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.warning("Failed to log activity: %s", e)


def _audit_property(property_id, action, remarks=None):
    try:
        admin_id = get_jwt_identity()
        if not admin_id:
            return
        admin = Admin.query.get(int(admin_id))
        if not admin:
            return
        db.session.add(PropertyAuditLog(
            property_id=property_id,
            user_id=admin.id,
            action=action,
            user_name=admin.name or admin.username,
            user_email=admin.email,
            user_mobile=admin.phone,
            remarks=remarks,
        ))
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.warning("Failed to audit property %s: %s", property_id, e)


# =========================
# LOGIN
# =========================
@admin_bp.route("/login", methods=["POST"])
@limiter.limit("5/minute", key_func=_login_limit_key)
@limiter.limit("20/minute")
def login():
    data = request.json
    if not data or "username" not in data or "password" not in data:
        return jsonify({"error": "Username and password required"}), 400

    identifier = (data["username"] or "").strip()
    if not identifier:
        return jsonify({"error": "Username and password required"}), 400

    identifier_lower = identifier.lower()
    admin = (
        Admin.query.filter(
            or_(
                func.lower(Admin.username) == identifier_lower,
                func.lower(Admin.email) == identifier_lower,
                Admin.user_id == identifier,
            )
        ).first()
    )
    if not admin:
        return jsonify({"error": "Invalid credentials"}), 401

    if not bcrypt.checkpw(data["password"].encode("utf-8"), admin.password.encode("utf-8")):
        return jsonify({"error": "Invalid credentials"}), 401

    access_token = create_access_token(identity=str(admin.id))

    response = jsonify({
        "message": "Login successful",
        "admin_id": admin.id,
        "username": admin.username,
        "role": admin.role or "admin",
        "role_name": admin.role_obj.name if admin.role_obj else (admin.role or "admin"),
        "permissions": sorted(admin_permissions(admin)),
    })
    set_access_cookies(response, access_token)

    admin.last_login = datetime.utcnow()
    db.session.commit()

    return response


# =========================
# CHECK AUTH
# =========================
@admin_bp.route("/check-auth", methods=["GET"])
@jwt_required()
def check_auth():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(int(admin_id))
    if not admin:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"admin_id": admin.id, "user_id": admin.user_id, "username": admin.username, "name": admin.name, "email": admin.email, "role": admin.role or "admin",
                    "role_name": admin.role_obj.name if admin.role_obj else (admin.role or "admin"),
                    "permissions": sorted(admin_permissions(admin))})


# =========================
# LOGOUT
# =========================
@admin_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    response = jsonify({"message": "Logged out"})
    unset_jwt_cookies(response)
    return response


# =========================
# DASHBOARD SUMMARY
# =========================
@admin_bp.route("/my-summary", methods=["GET"])
@jwt_required()
def my_summary():
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    admin_id = get_jwt_identity()
    current_admin = Admin.query.get(int(admin_id))
    is_admin = current_admin and current_admin.role == "admin"

    total_properties = Property.query.count()
    pending_properties = Property.query.filter_by(status="pending").count()
    approved_properties = Property.query.filter_by(status="approved").count()
    rejected_properties = Property.query.filter_by(status="rejected").count()
    active_properties = Property.query.filter_by(is_active=True).count()
    total_users = Admin.query.count()

    if is_admin:
        total_leads = Lead.query.count()
        new_leads = Lead.query.filter(Lead.created_at >= today_start).count()
        leads_30d = Lead.query.filter(Lead.created_at >= now - timedelta(days=30)).count()
    else:
        uid = int(admin_id)
        total_leads = Lead.query.filter_by(assigned_to=uid).count()
        new_leads = Lead.query.filter(Lead.assigned_to == uid, Lead.created_at >= today_start).count()
        leads_30d = Lead.query.filter(Lead.assigned_to == uid, Lead.created_at >= now - timedelta(days=30)).count()

    contactus_today = Contactus.query.filter(Contactus.created_at >= today_start).count() if hasattr(Contactus, 'created_at') else 0

    return jsonify({
        "stats": {
            "total_properties": total_properties,
            "pending_properties": pending_properties,
            "approved_properties": approved_properties,
            "rejected_properties": rejected_properties,
            "active_properties": active_properties,
            "total_leads": total_leads,
            "leads_30d": leads_30d,
            "new_leads": new_leads,
            "total_users": total_users,
            "contactus_today": contactus_today,
        }
    })


# =========================
# GET ALL PROPERTIES
# =========================
@admin_bp.route("/properties", methods=["GET"])
@require_permission("properties.view")
def get_all_properties():
    page = request.args.get("page", 1)
    per_page = request.args.get("per_page", 50)
    base_query = Property.query.order_by(Property.created_at.desc())
    properties, total, page, per_page = paginate(base_query, page, per_page)

    property_ids = [p.id for p in properties]
    image_map = {}
    if property_ids:
        first_images = db.session.query(
            PropertyImage.property_id,
            PropertyImage.image_url,
        ).filter(
            PropertyImage.property_id.in_(property_ids),
        ).order_by(PropertyImage.property_id, PropertyImage.order.asc()).all()
        seen = set()
        for img in first_images:
            if img.property_id not in seen:
                image_map[img.property_id] = img.image_url
                seen.add(img.property_id)

    result = []
    for p in properties:
        owner_pc = PropertyContact.query.filter_by(property_id=p.id, type="owner").first()
        uploader_name = None
        if p.uploaded_admin:
            uploader_name = p.uploaded_admin.name or p.uploaded_admin.username
        result.append({
            "id": p.id,
            "listing_id": p.listing_id,
            "title": p.title,
            "status": p.status,
            "is_closed": p.is_closed,
            "is_active": p.is_active,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "location": p.location,
            "uploader_name": uploader_name,
            "uploader_type": "owner" if owner_pc else None,
            "uploader_user_id": p.uploaded_admin.user_id if p.uploaded_admin else None,
            "owner_name": owner_pc.name if owner_pc else None,
            "first_image": image_map.get(p.id),
        })
    return jsonify({"items": result, "total": total, "page": page, "per_page": per_page})


# =========================
# GET SINGLE PROPERTY (ADMIN)
# =========================
@admin_bp.route("/property/<int:id>", methods=["GET"])
@require_permission("properties.view")
def get_property(id):
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    owner_pc = PropertyContact.query.filter_by(property_id=id, type="owner").first()
    images = PropertyImage.query.filter_by(property_id=id).order_by(PropertyImage.order.asc()).all()
    field_values = PropertyValue.query.filter_by(property_id=id).all()
    audit_logs = PropertyAuditLog.query.filter_by(property_id=id).order_by(PropertyAuditLog.created_at.desc()).all()

    uploader = None
    if prop.uploaded_admin:
        uploader = {
            "user_id": prop.uploaded_admin.user_id,
            "display_name": prop.uploaded_admin.name or prop.uploaded_admin.username,
            "email": prop.uploaded_admin.email,
            "mobile": prop.uploaded_admin.phone,
            "whatsapp": prop.uploaded_admin.whatsapp,
        }

    return jsonify({
        "id": prop.id,
        "listing_id": prop.listing_id,
        "title": prop.title,
        "description": prop.description,
        "price": float(prop.price) if prop.price is not None else None,
        "price_text": prop.price_text or "*",
        "location": prop.location,
        "status": prop.status,
        "is_active": prop.is_active,
        "is_featured": prop.is_featured,
        "is_verified": prop.is_verified,
        "is_closed": prop.is_closed,
        "transaction_type": prop.transaction_type,
        "property_type": prop.property_type,
        "overview_template_id": prop.overview_template_id,
        "closing_template_id": prop.closing_template_id,
        "title_template_id": prop.title_template_id,
        "selected_features": [{"id": pf.id, "label": pf.label, "sentence": pf.sentence} for pf in prop.features],
        "created_at": prop.created_at.isoformat() if prop.created_at else None,
        "owner_name": owner_pc.name if owner_pc else None,
        "owner_email": owner_pc.email if owner_pc else None,
        "owner_mobile": owner_pc.mobile if owner_pc else None,
        "field_values": [{"field_key": fv.field_key, "field_value": fv.field_value} for fv in field_values],
        "uploader": uploader,
        "images": [{"id": img.id, "image_url": img.image_url, "order": img.order} for img in images],
        "audit_log": [{
            "id": log.id, "action": log.action,
            "user_name": log.user_name, "user_email": log.user_email,
            "remarks": log.remarks, "created_at": log.created_at.isoformat() if log.created_at else None,
        } for log in audit_logs],
    })


# =========================
# CREATE PROPERTY (ADMIN)
# =========================
@admin_bp.route("/property", methods=["POST"])
@require_permission("properties.create")
def create_property():
    data = request.form if request.form else request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400

    price_raw = (data.get("price") or "").strip()
    price_text = (data.get("price_text") or "").strip() or "*"
    if price_text.lower() in ("connect for price", "price on request"):
        price_val = None
    elif price_raw and price_raw.lower() not in ("connect for price", ""):
        import re as _re
        try:
            _cleaned = _re.sub(r'[₹$,]', '', price_raw)
            _multiplier = 1
            if _re.search(r'\b(crore|cr)\b', _cleaned, _re.IGNORECASE):
                _multiplier = 10_00_000
            elif _re.search(r'\b(lakh|lac)\b', _cleaned, _re.IGNORECASE):
                _multiplier = 1_00_000
            elif _re.search(r'\bk\b', _cleaned, _re.IGNORECASE):
                _multiplier = 1_000
            _cleaned = _re.sub(r'\b(lakh|lac|crore|cr|k)\b', '', _cleaned, flags=_re.IGNORECASE).strip()
            price_val = float(_cleaned) * _multiplier
        except (ValueError, TypeError):
            price_val = None
    else:
        price_val = None

    admin_id = get_jwt_identity()
    admin = Admin.query.get(int(admin_id)) if admin_id else None
    creator_is_admin = is_admin(admin)
    auto_approve = not creator_is_admin and is_setting_enabled("auto_approve_properties")
    approved_now = creator_is_admin or auto_approve

    prop = Property(
        title=title,
        description=data.get("description", ""),
        price=price_val,
        price_text=price_text,
        location=data.get("location", ""),
        transaction_type=data.get("transaction_type", "sell"),
        property_type=data.get("property_type", "flat"),
        status="approved" if approved_now else "pending",
        is_active=approved_now,
        is_verified=True if creator_is_admin else False,
        uploaded_by=int(admin_id) if admin_id else None,
        overview_template_id=data.get("overview_template_id") or None,
        closing_template_id=data.get("closing_template_id") or None,
        title_template_id=data.get("title_template_id") or None,
    )
    db.session.add(prop)
    db.session.commit()
    prop.listing_id = generate_listing_id(prop.id)
    db.session.commit()

    feature_ids_raw = data.get("feature_ids")
    if feature_ids_raw:
        import json as _fj
        try:
            fids = _fj.loads(feature_ids_raw) if isinstance(feature_ids_raw, str) else feature_ids_raw
            for fid in fids:
                pf = PresetFeature.query.get(int(fid))
                if pf:
                    db.session.add(PropertyFeature(property_id=prop.id, feature_id=pf.id))
        except Exception as e:
            logger.warning("Failed to parse feature_ids: %s", e)

    name = data.get("owner_name", "").strip()
    email = data.get("owner_email", "").strip()
    mobile = data.get("owner_mobile", "").strip()
    if name or mobile:
        db.session.add(PropertyContact(
            property_id=prop.id, type="owner",
            name=name or "", email=email or None, mobile=mobile or None,
        ))

    field_values_raw = data.get("field_values")
    if field_values_raw:
        import json
        try:
            field_values = json.loads(field_values_raw) if isinstance(field_values_raw, str) else field_values_raw
            for fv in field_values:
                if fv.get("field_key") and fv.get("field_value"):
                    db.session.add(PropertyValue(
                        property_id=prop.id, field_key=fv["field_key"], field_value=fv["field_value"]
                    ))
        except Exception as e:
            logger.warning("Failed to parse field_values: %s", e)

    db.session.flush()

    safe_folder = prop.listing_id
    files = request.files.getlist("images")
    _saved_paths = []
    try:
        for file in files:
            if file and file.filename:
                filename = f"{time.time_ns()}_{secure_filename(file.filename)}"
                path = f"{safe_folder}/{filename}" if safe_folder else filename
                url_path = upload_file(file, path)
                _saved_paths.append(path)
                db.session.add(PropertyImage(property_id=prop.id, image_url=url_path))
        db.session.commit()
    except Exception:
        db.session.rollback()
        for p in _saved_paths:
            try:
                delete_file(p)
            except Exception:
                pass
        raise

    _audit_property(prop.id, "created")
    return jsonify({"message": "Property created", "id": prop.id, "listing_id": prop.listing_id}), 201


# =========================
# UPDATE PROPERTY
# =========================
@admin_bp.route("/property/<int:id>", methods=["PUT"])
@jwt_required()
def update_property(id):
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    current_id = int(get_jwt_identity())
    current = Admin.query.get(current_id)
    if not _can_manage_property(current, prop):
        return jsonify({"error": "Forbidden"}), 403

    data = request.form if request.form else request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400

    # Non-admins without approve permission cannot change moderation fields.
    if not is_admin(current) and not has_permission(current, "properties.approve"):
        data = {k: v for k, v in data.items() if k not in ("status", "is_featured", "is_verified")}

    prop.title = data.get("title", prop.title)
    prop.description = data.get("description", prop.description)
    prop.location = data.get("location", prop.location)

    if "transaction_type" in data:
        val = data["transaction_type"]
        if val not in VALID_TRANSACTION_TYPES:
            return jsonify({"error": f"Invalid transaction_type. Must be one of: {', '.join(VALID_TRANSACTION_TYPES)}"}), 400
        prop.transaction_type = val
    if "property_type" in data:
        val = data["property_type"]
        if val not in VALID_PROPERTY_TYPES:
            return jsonify({"error": f"Invalid property_type. Must be one of: {', '.join(VALID_PROPERTY_TYPES)}"}), 400
        prop.property_type = val

    _changed_status = "status" in data
    _changed_featured = "is_featured" in data
    _changed_verified = "is_verified" in data

    if "overview_template_id" in data:
        val = data.get("overview_template_id")
        prop.overview_template_id = int(val) if val is not None and val != "" else None
    if "closing_template_id" in data:
        val = data.get("closing_template_id")
        prop.closing_template_id = int(val) if val is not None and val != "" else None
    if "title_template_id" in data:
        val = data.get("title_template_id")
        prop.title_template_id = int(val) if val is not None and val != "" else None

    if "feature_ids" in data:
        import json as _fj2
        try:
            fids = _fj2.loads(data["feature_ids"]) if isinstance(data["feature_ids"], str) else data["feature_ids"]
            new_features = []
            for fid in fids:
                pf = PresetFeature.query.get(int(fid))
                if pf:
                    new_features.append(pf.id)
            PropertyFeature.query.filter_by(property_id=id).delete()
            for pfid in new_features:
                db.session.add(PropertyFeature(property_id=id, feature_id=pfid))
        except Exception as e:
            logger.warning("Failed to update feature_ids: %s", e)

    if "price" in data:
        price_raw = (data.get("price") or "").strip()
        price_text = (data.get("price_text") or "").strip() or "*"
        prop.price_text = price_text
        if price_text.lower() in ("connect for price", "price on request"):
            prop.price = None
        elif price_raw and price_raw.lower() not in ("connect for price", ""):
            import re as _re
            try:
                _cleaned = _re.sub(r'[₹$,]', '', price_raw)
                _multiplier = 1
                if _re.search(r'\b(crore|cr)\b', _cleaned, _re.IGNORECASE):
                    _multiplier = 10_00_000
                elif _re.search(r'\b(lakh|lac)\b', _cleaned, _re.IGNORECASE):
                    _multiplier = 1_00_000
                elif _re.search(r'\bk\b', _cleaned, _re.IGNORECASE):
                    _multiplier = 1_000
                _cleaned = _re.sub(r'\b(lakh|lac|crore|cr|k)\b', '', _cleaned, flags=_re.IGNORECASE).strip()
                prop.price = float(_cleaned) * _multiplier
            except (ValueError, TypeError):
                prop.price = None
        else:
            prop.price = None

    if "is_active" in data:
        val = data.get("is_active")
        prop.is_active = val in (True, "true", "1", 1)
    if "is_featured" in data:
        val = data.get("is_featured")
        prop.is_featured = val in (True, "true", "1", 1)
    if "is_verified" in data:
        val = data.get("is_verified")
        prop.is_verified = val in (True, "true", "1", 1)
    if "status" in data:
        val = data["status"]
        if val not in VALID_STATUSES:
            return jsonify({"error": f"Invalid status. Must be one of: {', '.join(VALID_STATUSES)}"}), 400
        prop.status = val

    from models.models import PropertyContact, PropertyValue
    owner_pc = PropertyContact.query.filter_by(property_id=id, type="owner").first()
    owner_name = data.get("owner_name")
    owner_email = data.get("owner_email")
    owner_mobile = data.get("owner_mobile")
    if owner_name is not None or owner_mobile is not None or owner_email is not None:
        if owner_pc:
            if owner_name is not None:
                owner_pc.name = owner_name
            if owner_mobile is not None:
                owner_pc.mobile = owner_mobile
            if owner_email is not None:
                owner_pc.email = owner_email
        else:
            if owner_name or owner_mobile:
                db.session.add(PropertyContact(
                    property_id=id, type="owner",
                    name=owner_name or "", email=owner_email or None, mobile=owner_mobile or None,
                ))

    field_values_raw = data.get("field_values")
    if field_values_raw:
        import json as _json
        try:
            fv_list = _json.loads(field_values_raw) if isinstance(field_values_raw, str) else field_values_raw
            existing = {fv.field_key: fv for fv in PropertyValue.query.filter_by(property_id=id).all()}
            for item in fv_list:
                fk = item.get("field_key")
                fv = item.get("field_value", "")
                if not fk:
                    continue
                if fk in existing:
                    existing[fk].field_value = fv
                else:
                    db.session.add(PropertyValue(property_id=id, field_key=fk, field_value=fv))
            deleted_keys = [k for k in existing if k not in {i.get("field_key") for i in fv_list}]
            for k in deleted_keys:
                db.session.delete(existing[k])
        except Exception as e:
            logger.warning("Failed to update field_values for property %s: %s", id, e)

    db.session.flush()

    files = request.files.getlist("images")
    if files:
        safe_folder = prop.listing_id
        max_order = db.session.query(func.max(PropertyImage.order)).filter_by(property_id=id).scalar()
        start_order = (max_order or 0) + 1
        _saved_paths = []
        try:
            for i, file in enumerate(files):
                if file and file.filename:
                    filename = f"{time.time_ns()}_{secure_filename(file.filename)}"
                    path = f"{safe_folder}/{filename}" if safe_folder else filename
                    url_path = upload_file(file, path)
                    _saved_paths.append(path)
                    db.session.add(PropertyImage(property_id=id, image_url=url_path, order=start_order + i))
        except Exception:
            db.session.rollback()
            for p in _saved_paths:
                try:
                    delete_file(p)
                except Exception:
                    pass
            raise

    if _changed_status:
        _audit_property(id, f"status_changed:{data['status']}")
    if _changed_featured:
        _audit_property(id, f"featured:{data['is_featured']}")
    if _changed_verified:
        _audit_property(id, f"verified:{data['is_verified']}")

    _audit_property(id, "edited")
    db.session.commit()
    return jsonify({"message": "Property updated"})


# =========================
# DELETE PROPERTY
# =========================
@admin_bp.route("/property/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_property(id):
    current = current_admin()
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if not _can_manage_property(current, prop):
        return jsonify({"error": "Forbidden"}), 403
    if not prop.is_closed:
        return jsonify({"error": "Property must be closed before deleting"}), 400

    db.session.delete(prop)
    db.session.commit()
    return jsonify({"message": "Property deleted successfully"}), 200


# =========================
# ACTIONS
# =========================
@admin_bp.route("/approve/<int:id>", methods=["POST"])
@jwt_required()
def approve_property(id):
    _require_permission("properties.approve")
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    prop.status = "approved"
    prop.is_active = True
    _audit_property(id, "approved")
    db.session.commit()
    _log_activity("approve", "property", id)
    if prop.owner_id and prop.owner:
        send_email_async(
            "Your property is now live - Nagpur Realty Hub",
            [prop.owner.email],
            submission_confirmed_email(prop, prop.owner.name),
        )
    return jsonify({"message": "Property approved"})


@admin_bp.route("/reject/<int:id>", methods=["POST"])
@jwt_required()
def reject_property(id):
    _require_permission("properties.approve")
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    prop.status = "rejected"
    prop.is_active = False
    _audit_property(id, "rejected")
    db.session.commit()
    _log_activity("reject", "property", id)
    if prop.owner_id and prop.owner:
        send_email_async(
            "Property needs changes - Nagpur Realty Hub",
            [prop.owner.email],
            submission_rejected_email(prop, prop.owner.name),
        )
    return jsonify({"message": "Property rejected"})


@admin_bp.route("/close/<int:id>", methods=["POST"])
@jwt_required()
def close_property(id):
    current = current_admin()
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if not _can_manage_property(current, prop):
        return jsonify({"error": "Forbidden"}), 403
    prop.is_closed = True
    prop.is_active = False
    prop.closed_at = datetime.utcnow()
    _audit_property(id, "closed")
    db.session.commit()
    return jsonify({"message": "Property closed"})


@admin_bp.route("/reopen/<int:id>", methods=["POST"])
@jwt_required()
def reopen_property(id):
    current = current_admin()
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if not _can_manage_property(current, prop):
        return jsonify({"error": "Forbidden"}), 403
    prop.is_closed = False
    prop.is_active = True
    prop.closed_at = None
    _audit_property(id, "reopened")
    db.session.commit()
    return jsonify({"message": "Property reopened"})


@admin_bp.route("/feature/<int:id>", methods=["POST"])
@jwt_required()
def toggle_featured(id):
    _require_permission("properties.approve")
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    prop.is_featured = not prop.is_featured
    db.session.commit()
    return jsonify({"message": "Featured updated", "is_featured": prop.is_featured})


@admin_bp.route("/verify/<int:id>", methods=["POST"])
@jwt_required()
def toggle_verified(id):
    _require_permission("properties.approve")
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    prop.is_verified = not prop.is_verified
    db.session.commit()
    return jsonify({"message": "Verified updated", "is_verified": prop.is_verified})


@admin_bp.route("/toggle-visibility/<int:id>", methods=["POST"])
@jwt_required()
def toggle_visibility(id):
    _require_permission("properties.approve")
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if prop.status != "approved":
        return jsonify({"error": "Can only toggle visibility for approved properties"}), 400
    prop.is_active = not prop.is_active
    if prop.is_active and prop.is_closed:
        prop.is_closed = False
        prop.closed_at = None
    _audit_property(id, "visibility")
    db.session.commit()
    return jsonify({"message": "Visibility updated", "is_active": prop.is_active})


# =========================
# CONTACTS
# =========================
@admin_bp.route("/property/<int:id>/contacts", methods=["GET"])
@jwt_required()
def get_property_contacts(id):
    prop = Property.query.options(db.joinedload(Property.uploaded_admin)).get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    contacts = PropertyContact.query.filter_by(property_id=id).all()
    return jsonify({
        "contacts": [{
            "id": c.id, "type": c.type, "name": c.name, "mobile": c.mobile, "email": c.email,
            "created_at": c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else None
        } for c in contacts],
        "user_id": prop.uploaded_admin.user_id if prop.uploaded_admin else None,
    })


# =========================
# NAVIGATION
# =========================
@admin_bp.route("/property-nav/<int:id>", methods=["GET"])
@require_permission("properties.view")
def property_navigation(id):
    prev_property = Property.query.filter(Property.id < id).order_by(Property.id.desc()).first()
    next_property = Property.query.filter(Property.id > id).order_by(Property.id.asc()).first()
    return jsonify({
        "prev_id": prev_property.id if prev_property else None,
        "next_id": next_property.id if next_property else None
    })


# =========================
# IMAGE UPLOAD
# =========================
@admin_bp.route("/upload-image/<int:property_id>", methods=["POST"])
@jwt_required()
def upload_image(property_id):
    _, err_resp, err_code = _property_edit_guard(property_id)
    if err_resp:
        return err_resp, err_code
    if "image" not in request.files:
        return jsonify({"error": "No file"}), 400
    file = request.files["image"]
    valid, err = _validate_file(file)
    if not valid:
        return jsonify({"error": err}), 400

    prop = Property.query.get(property_id)
    safe_folder = prop.listing_id if prop else ""
    filename = f"{time.time_ns()}_{secure_filename(file.filename)}"
    path = f"{safe_folder}/{filename}" if safe_folder else filename
    url_path = upload_file(file, path)
    new_image = PropertyImage(property_id=property_id, image_url=url_path)
    db.session.add(new_image)
    db.session.commit()
    return jsonify({"message": "Image uploaded", "url": url_path})


@admin_bp.route("/upload-images/<int:property_id>", methods=["POST"])
@jwt_required()
def upload_images(property_id):
    _, err_resp, err_code = _property_edit_guard(property_id)
    if err_resp:
        return err_resp, err_code
    files = request.files.getlist("images")
    if not files:
        return jsonify({"error": "No files"}), 400

    prop = Property.query.get(property_id)
    safe_folder = prop.listing_id if prop else ""

    from sqlalchemy import func
    max_order = db.session.query(func.max(PropertyImage.order)).filter_by(property_id=property_id).scalar()
    start_order = (max_order or 0) + 1
    uploaded = []

    for i, file in enumerate(files):
        valid, err = _validate_file(file)
        if not valid:
            return jsonify({"error": f"File {i+1}: {err}"}), 400
        filename = f"{time.time_ns()}_{secure_filename(file.filename)}"
        path = f"{safe_folder}/{filename}" if safe_folder else filename
        url_path = upload_file(file, path)
        new_image = PropertyImage(property_id=property_id, image_url=url_path, order=start_order + i)
        db.session.add(new_image)
        uploaded.append(url_path)

    db.session.commit()
    return jsonify({"message": "Images uploaded", "urls": uploaded})


@admin_bp.route("/property/<int:property_id>/gallery-images", methods=["POST"])
@jwt_required()
def attach_gallery_images(property_id):
    _, err_resp, err_code = _property_edit_guard(property_id)
    if err_resp:
        return err_resp, err_code
    data = request.get_json(silent=True) or {}
    urls = data.get("urls") or []
    if not urls or not isinstance(urls, list):
        return jsonify({"error": "urls array is required"}), 400
    urls = [u for u in urls if isinstance(u, str) and u.strip()]
    if not urls:
        return jsonify({"error": "No URLs provided"}), 400

    prop = Property.query.get(property_id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    max_order = db.session.query(func.max(PropertyImage.order)).filter_by(property_id=property_id).scalar()
    start_order = (max_order or 0) + 1
    added = []
    for i, url in enumerate(urls):
        db.session.add(PropertyImage(property_id=property_id, image_url=url.strip(), order=start_order + i))
        added.append(url.strip())
    db.session.commit()
    return jsonify({"message": "Gallery images attached", "urls": added}), 201


@admin_bp.route("/delete-image/<int:image_id>", methods=["DELETE"])
@jwt_required()
def delete_image(image_id):
    image = PropertyImage.query.get(image_id)
    if not image:
        return jsonify({"error": "Not found"}), 404
    current = current_admin()
    prop = Property.query.get(image.property_id) if image.property_id else None
    if not prop or not _can_manage_property(current, prop):
        return jsonify({"error": "Forbidden"}), 403
    try:
        from urllib.parse import urlparse
        old_path = urlparse(image.image_url).path
        bucket_prefix = f"/storage/v1/object/public/"
        if bucket_prefix in old_path:
            old_path = old_path.split(bucket_prefix, 1)[1].split("/", 1)[1] if "/" in old_path.split(bucket_prefix, 1)[1] else ""
        else:
            old_path = old_path.lstrip("/")
            if old_path.startswith("uploads/"):
                old_path = old_path[len("uploads/"):]
        if old_path:
            delete_file(old_path)
    except Exception as e:
        logger.warning("Failed to delete file from Supabase: %s", e)
    db.session.delete(image)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@admin_bp.route("/reorder-images", methods=["POST"])
@jwt_required()
def reorder_images():
    data = request.json
    if not isinstance(data, list):
        return jsonify({"error": "Expected a list of {id, order}"}), 400
    for item in data:
        if not isinstance(item, dict) or "id" not in item or "order" not in item:
            return jsonify({"error": "Each item must have 'id' and 'order'"}), 400
        img = PropertyImage.query.get(item["id"])
        if img:
            img.order = item["order"]
    db.session.commit()
    return jsonify({"message": "Reordered"})


# =========================
# PASSWORD
# =========================
@admin_bp.route("/change-password", methods=["POST"])
@jwt_required()
def change_password():
    data = request.json
    admin_id = get_jwt_identity()
    admin = Admin.query.get(int(admin_id))
    if not admin:
        return jsonify({"error": "Admin not found"}), 404
    current_password = data.get("old_password") or data.get("current_password", "")
    new_password = data.get("new_password", "")
    if not current_password or not new_password:
        return jsonify({"error": "Current and new password are required"}), 400
    if len(new_password) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": f"New password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400
    if not bcrypt.checkpw(current_password.encode("utf-8"), admin.password.encode("utf-8")):
        return jsonify({"error": "Current password is incorrect"}), 400
    admin.password = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.session.commit()
    return jsonify({"message": "Password changed successfully"})


@admin_bp.route("/forgot-password", methods=["POST"])
@limiter.limit("3/hour")
def forgot_password():
    data = request.json
    admin = Admin.query.filter_by(email=data.get("email")).first()
    if not admin:
        return jsonify({"message": "If the email is registered, a reset link has been sent"})

    token = secrets.token_urlsafe(32)
    admin.reset_token = _hash_token(token)
    admin.reset_token_expiry = datetime.utcnow() + timedelta(minutes=15)
    db.session.commit()

    reset_link = f"{current_app.config['FRONTEND_URL']}/reset-password/{token}"
    send_email_async(
        "Reset Your Password - Nagpur Realty Hub",
        [admin.email],
        password_reset_email(reset_link),
    )

    return jsonify({"message": "If the email is registered, a reset link has been sent"})


@admin_bp.route("/reset-password/<token>", methods=["POST"])
@limiter.limit("5/hour")
def reset_password(token):
    data = request.json
    if not token:
        return jsonify({"error": "Token is required"}), 400

    admins = Admin.query.filter(Admin.reset_token.isnot(None), Admin.reset_token_expiry.isnot(None)).all()
    admin = None
    for a in admins:
        if a.reset_token_expiry and a.reset_token_expiry < datetime.utcnow():
            continue
        if _check_token(token, a.reset_token):
            admin = a
            break
    if not admin:
        return jsonify({"error": "Invalid or expired token"}), 400

    if len(data.get("password", "")) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400

    admin.password = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    admin.reset_token = None
    admin.reset_token_expiry = None
    db.session.commit()
    return jsonify({"message": "Password reset successful"})


# =========================
# PROFILE
# =========================
@admin_bp.route("/profile", methods=["GET"])
@jwt_required()
def get_profile():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(int(admin_id))
    if not admin:
        return jsonify({"error": "Not found"}), 404
    return jsonify({
        "id": admin.id, "username": admin.username, "email": admin.email,
        "name": admin.name, "phone": admin.phone, "whatsapp": admin.whatsapp,
        "profile_image": admin.profile_image, "role": admin.role,
        "role_name": admin.role_obj.name if admin.role_obj else admin.role,
    })


@admin_bp.route("/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(int(admin_id))
    if not admin:
        return jsonify({"error": "Not found"}), 404
    data = request.json
    admin.name = data.get("name", admin.name)
    admin.email = data.get("email", admin.email)
    admin.phone = data.get("phone", admin.phone)
    admin.whatsapp = data.get("whatsapp", admin.whatsapp)
    db.session.commit()
    return jsonify({"message": "Profile updated"})


# =========================
# DESCRIPTION TEMPLATES
# =========================
@admin_bp.route("/description-templates", methods=["GET"])
@jwt_required()
def admin_list_templates():
    from models.models import DescriptionTemplate
    category = request.args.get("category")
    query = DescriptionTemplate.query
    if category:
        query = query.filter_by(category=category)
    templates = query.order_by(DescriptionTemplate.category.asc(), DescriptionTemplate.sort_order.asc()).all()
    return jsonify({"templates": [{
        "id": t.id, "category": t.category, "property_type": t.property_type,
        "template_text": t.template_text, "sort_order": t.sort_order,
        "is_active": t.is_active, "created_at": t.created_at.isoformat() if t.created_at else None,
    } for t in templates]})


@admin_bp.route("/description-templates", methods=["POST"])
@jwt_required()
def admin_create_template():
    from models.models import DescriptionTemplate
    data = request.json
    if not data or not data.get("template_text") or not data.get("category"):
        return jsonify({"error": "category and template_text are required"}), 400
    if data["category"] not in ("title", "overview", "amenities", "highlights", "closing"):
        return jsonify({"error": "Invalid category"}), 400
    tmpl = DescriptionTemplate(
        category=data["category"], property_type=data.get("property_type"),
        template_text=data["template_text"], sort_order=data.get("sort_order", 0),
        is_active=data.get("is_active", True),
    )
    db.session.add(tmpl)
    db.session.commit()
    _log_activity("created", "templates", tmpl.id)
    return jsonify({"id": tmpl.id, "message": "Template created"}), 201


@admin_bp.route("/description-templates/<int:id>", methods=["PUT"])
@jwt_required()
def admin_update_template(id):
    from models.models import DescriptionTemplate
    tmpl = DescriptionTemplate.query.get(id)
    if not tmpl:
        return jsonify({"error": "Not found"}), 404
    data = request.json
    if "template_text" in data:
        tmpl.template_text = data["template_text"]
    if "property_type" in data:
        tmpl.property_type = data["property_type"]
    if "category" in data:
        if data["category"] not in ("title", "overview", "amenities", "highlights", "closing"):
            return jsonify({"error": "Invalid category"}), 400
        tmpl.category = data["category"]
    if "sort_order" in data:
        tmpl.sort_order = data["sort_order"]
    if "is_active" in data:
        tmpl.is_active = data["is_active"]
    db.session.commit()
    _log_activity("updated", "templates", tmpl.id)
    return jsonify({"message": "Template updated"})


@admin_bp.route("/description-templates/<int:id>", methods=["DELETE"])
@jwt_required()
def admin_delete_template(id):
    from models.models import DescriptionTemplate
    tmpl = DescriptionTemplate.query.get(id)
    if not tmpl:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(tmpl)
    db.session.commit()
    _log_activity("deleted", "templates", id)
    return jsonify({"message": "Template deleted"})


# =========================
# ROLES & PERMISSIONS (RBAC)
# =========================
@admin_bp.route("/roles", methods=["GET"])
@jwt_required()
def list_roles():
    _require_admin()
    roles = Role.query.order_by(Role.sort_order.asc(), Role.id.asc()).all()
    user_count_map = dict(
        db.session.query(Admin.role_id, func.count(Admin.id))
        .filter(Admin.role_id.isnot(None)).group_by(Admin.role_id).all()
    )
    return jsonify({"roles": [{
        "id": r.id, "name": r.name, "slug": r.slug, "description": r.description,
        "is_system": r.is_system, "sort_order": r.sort_order,
        "permissions": sorted(p.code for p in r.permissions),
        "user_count": user_count_map.get(r.id, 0),
    } for r in roles]})


@admin_bp.route("/permissions", methods=["GET"])
@jwt_required()
def list_permissions():
    _require_admin()
    modules = {}
    for item in PERMISSION_CATALOG:
        modules.setdefault(item["module"], []).append(item)
    return jsonify({"modules": [
        {"module": m, "permissions": entries} for m, entries in modules.items()
    ]})


def _resolve_role(role_val):
    if role_val is None:
        return None
    s = str(role_val).strip()
    if s.isdigit():
        return Role.query.get(int(s))
    return Role.query.filter(Role.slug == s).first() or Role.query.filter(Role.name == s).first()


@admin_bp.route("/roles", methods=["POST"])
@jwt_required()
def create_role():
    _require_admin()
    data = request.json or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Role name is required"}), 400
    slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    if not slug:
        return jsonify({"error": "Role name must contain letters"}), 400
    if Role.query.filter_by(slug=slug).first():
        return jsonify({"error": f"A role named '{name}' already exists"}), 409
    role = Role(
        name=name, slug=slug,
        description=(data.get("description") or "").strip()[:255],
        is_system=False, sort_order=Role.query.count(),
    )
    codes = data.get("permissions") or []
    perm_map = {p.code: p for p in Permission.query.filter(Permission.code.in_(codes)).all()}
    role.permissions = [perm_map[c] for c in codes if c in perm_map]
    db.session.add(role)
    db.session.commit()
    _log_activity("created", "roles", role.id)
    return jsonify({"id": role.id, "slug": role.slug, "message": "Role created"}), 201


@admin_bp.route("/roles/<int:rid>", methods=["PUT"])
@jwt_required()
def update_role(rid):
    _require_admin()
    role = Role.query.get(rid)
    if not role:
        return jsonify({"error": "Role not found"}), 404
    data = request.json or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Role name is required"}), 400
        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        clash = Role.query.filter(Role.slug == slug, Role.id != rid).first()
        if clash:
            return jsonify({"error": f"A role named '{name}' already exists"}), 409
        role.name, role.slug = name, slug
        for a in role.admins:
            a.role = slug
    if "description" in data:
        role.description = (data.get("description") or "").strip()[:255]
    if "permissions" in data:
        codes = data.get("permissions") or []
        perm_map = {p.code: p for p in Permission.query.filter(Permission.code.in_(codes)).all()}
        role.permissions = [perm_map[c] for c in codes if c in perm_map]
    db.session.commit()
    _log_activity("updated", "roles", role.id)
    return jsonify({"message": "Role updated"})


@admin_bp.route("/roles/<int:rid>", methods=["DELETE"])
@jwt_required()
def delete_role(rid):
    _require_admin()
    role = Role.query.get(rid)
    if not role:
        return jsonify({"error": "Role not found"}), 404
    if role.is_system:
        return jsonify({"error": "System roles cannot be deleted"}), 400
    assigned = list(role.admins)
    if assigned:
        return jsonify({"error": f"Reassign or deactivate the {len(assigned)} user(s) using this role first"}), 400
    db.session.delete(role)
    db.session.commit()
    _log_activity("deleted", "roles", role.id)
    return jsonify({"message": "Role deleted"})


# =========================
# USER MANAGEMENT (admin-only)
# =========================
def _require_admin():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(int(admin_id))
    if not admin or admin.role != "admin":
        abort(403, description="Admin access required")
    return admin


def _require_permission(code):
    admin = current_admin()
    if not has_permission(admin, code):
        abort(403, description="Permission denied")
    return admin


def _can_manage_property(admin, prop):
    """Admin, or user with edit permission, or owner of the listing (manage_own)."""
    if not admin or not admin.is_active:
        return False
    if is_admin(admin):
        return True
    if has_permission(admin, "properties.edit"):
        return True
    if has_permission(admin, "properties.manage_own") and prop.uploaded_by == admin.id:
        return True
    return False


def _property_edit_guard(property_id):
    prop = Property.query.get(property_id)
    if not prop:
        return None, jsonify({"error": "Property not found"}), 404
    current = current_admin()
    if not _can_manage_property(current, prop):
        return None, jsonify({"error": "Forbidden"}), 403
    return prop, None, None


@admin_bp.route("/users", methods=["GET"])
@jwt_required()
def list_users():
    _require_admin()
    users = Admin.query.order_by(Admin.created_at.desc()).all()
    return jsonify({"users": [{
        "id": u.id, "user_id": u.user_id, "username": u.username, "name": u.name, "email": u.email,
        "role": u.role or "admin", "role_id": u.role_id,
        "role_name": u.role_obj.name if u.role_obj else (u.role or "admin"),
        "phone": u.phone, "is_active": u.is_active,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    } for u in users]})


@admin_bp.route("/users", methods=["POST"])
@jwt_required()
def create_user():
    _require_admin()
    data = request.json
    if not data or not data.get("username") or not data.get("password") or not data.get("email"):
        return jsonify({"error": "username, email, and password are required"}), 400
    if Admin.query.filter_by(username=data["username"]).first():
        return jsonify({"error": "Username already exists"}), 409
    if Admin.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "Email already exists"}), 409
    role_val = data.get("role")
    role = _resolve_role(role_val)
    if not role:
        if role_val is None or str(role_val).strip().lower() in ("", "power_user"):
            role = Role.query.filter_by(slug="agent").first()
        if not role:
            return jsonify({"error": "Invalid role"}), 400
    hashed = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user = Admin(
        username=data["username"], email=data["email"], name=data.get("name", ""),
        password=hashed, role=role.slug, role_id=role.id, phone=data.get("phone", ""),
        is_active=data.get("is_active", True),
    )
    user_id = (data.get("user_id") or "").strip()
    if user_id:
        if Admin.query.filter_by(user_id=user_id).first():
            return jsonify({"error": "User ID already exists"}), 409
        user.user_id = user_id
    db.session.add(user)
    db.session.commit()
    if not user.user_id:
        user.user_id = f"EMP-{user.id:03d}"
        db.session.commit()
    _log_activity("created", "users", user.id)
    return jsonify({"id": user.id, "user_id": user.user_id, "role": role.slug, "message": "User created"}), 201


@admin_bp.route("/users/<int:id>", methods=["PUT"])
@jwt_required()
def update_user(id):
    _require_admin()
    user = Admin.query.get(id)
    if not user:
        return jsonify({"error": "Not found"}), 404
    data = request.json
    if "username" in data and data["username"] != user.username:
        if Admin.query.filter_by(username=data["username"]).first():
            return jsonify({"error": "Username already exists"}), 409
        user.username = data["username"]
    if "email" in data and data["email"] != user.email:
        if Admin.query.filter_by(email=data["email"]).first():
            return jsonify({"error": "Email already exists"}), 409
        user.email = data["email"]
    if "user_id" in data:
        uid = (data["user_id"] or "").strip()
        if uid and uid != user.user_id:
            if Admin.query.filter_by(user_id=uid).first():
                return jsonify({"error": "User ID already exists"}), 409
            user.user_id = uid
        elif not uid:
            user.user_id = None
    if "name" in data:
        user.name = data["name"]
    if "phone" in data:
        user.phone = data["phone"]
    if "role" in data:
        role = _resolve_role(data["role"])
        if not role:
            return jsonify({"error": "Invalid role"}), 400
        user.role = role.slug
        user.role_id = role.id
    if "is_active" in data:
        user.is_active = data["is_active"]
    if "password" in data and data["password"]:
        user.password = bcrypt.hashpw(data["password"].encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.session.commit()
    _log_activity("updated", "users", user.id)
    return jsonify({"message": "User updated"})


@admin_bp.route("/users/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_user(id):
    current = _require_admin()
    if not current:
        return jsonify({"error": "Forbidden"}), 403
    if current.id == id:
        return jsonify({"error": "Cannot delete yourself"}), 400
    user = Admin.query.get(id)
    if not user:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(user)
    db.session.commit()
    _log_activity("deleted", "users", id)
    return jsonify({"message": "User deleted"})


# =========================
# PRESET FEATURES (ADMIN CRUD)
# =========================
@admin_bp.route("/preset-features", methods=["GET"])
@jwt_required()
def admin_get_preset_features():
    features = PresetFeature.query.order_by(PresetFeature.sort_order.asc()).all()
    return jsonify({"features": [{
        "id": f.id, "label": f.label, "sentence": f.sentence,
        "is_active": f.is_active, "sort_order": f.sort_order,
    } for f in features]})


@admin_bp.route("/preset-features", methods=["POST"])
@jwt_required()
def admin_create_preset_feature():
    data = request.json
    if not data or not data.get("label") or not data.get("sentence"):
        return jsonify({"error": "label and sentence are required"}), 400
    feat = PresetFeature(
        label=data["label"].strip(),
        sentence=data["sentence"].strip(),
        is_active=data.get("is_active", True),
        sort_order=data.get("sort_order", 0),
    )
    db.session.add(feat)
    db.session.commit()
    _log_activity("created", "preset_features", feat.id)
    return jsonify({"message": "Feature created", "id": feat.id}), 201


@admin_bp.route("/preset-features/<int:id>", methods=["PUT"])
@jwt_required()
def admin_update_preset_feature(id):
    feat = PresetFeature.query.get(id)
    if not feat:
        return jsonify({"error": "Feature not found"}), 404
    data = request.json
    if "label" in data:
        feat.label = data["label"].strip()
    if "sentence" in data:
        feat.sentence = data["sentence"].strip()
    if "is_active" in data:
        feat.is_active = data["is_active"]
    if "sort_order" in data:
        feat.sort_order = data["sort_order"]
    db.session.commit()
    _log_activity("updated", "preset_features", id)
    return jsonify({"message": "Feature updated"})


@admin_bp.route("/preset-features/<int:id>", methods=["DELETE"])
@jwt_required()
def admin_delete_preset_feature(id):
    feat = PresetFeature.query.get(id)
    if not feat:
        return jsonify({"error": "Feature not found"}), 404
    db.session.delete(feat)
    db.session.commit()
    _log_activity("deleted", "preset_features", id)
    return jsonify({"message": "Feature deleted"})


# =========================
# PASSWORD RESET REQUESTS
# =========================

@admin_bp.route("/password-reset-request", methods=["POST"])
@limiter.limit("5/hour")
def create_password_reset_request():
    data = request.json or {}
    identifier = (data.get("identifier") or "").strip()
    if not identifier:
        return jsonify({"error": "Email or username is required"}), 400
    if len(identifier) > 120 or len(data.get("name", "")) > 120:
        return jsonify({"error": "Input too long"}), 400

    logger.info("Password reset request from %s for %s", request.remote_addr, identifier)

    req = PasswordResetRequest(
        user_identifier=identifier,
        user_name=(data.get("name") or "").strip() or None,
    )
    db.session.add(req)
    db.session.commit()
    return jsonify({"message": "Your request has been sent to the admin. You will be contacted shortly."}), 201


@admin_bp.route("/password-reset-requests", methods=["GET"])
@jwt_required()
def list_password_reset_requests():
    _require_admin()

    requests = PasswordResetRequest.query.order_by(
        PasswordResetRequest.created_at.desc()
    ).all()
    return jsonify({"requests": [{
        "id": r.id, "user_identifier": r.user_identifier, "user_name": r.user_name,
        "status": r.status, "admin_note": r.admin_note,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "completed_at": r.completed_at.isoformat() if r.completed_at else None,
    } for r in requests]})


@admin_bp.route("/password-reset-requests/unread-count", methods=["GET"])
@jwt_required()
def password_reset_requests_unread_count():
    count = PasswordResetRequest.query.filter_by(status="pending").count()
    return jsonify({"count": count})


@admin_bp.route("/password-reset-requests/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_password_reset_request(id):
    _require_admin()

    req = PasswordResetRequest.query.get(id)
    if not req:
        return jsonify({"error": "Request not found"}), 404
    db.session.delete(req)
    db.session.commit()
    return jsonify({"message": "Request dismissed"})


@admin_bp.route("/password-reset-requests/<int:id>/complete", methods=["POST"])
@jwt_required()
def complete_password_reset_request(id):
    _require_admin()

    req = PasswordResetRequest.query.get(id)
    if not req:
        return jsonify({"error": "Request not found"}), 404

    data = request.json or {}
    req.status = "completed"
    req.admin_note = (data.get("admin_note") or "").strip() or None
    req.completed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"message": "Request marked as completed"})


@admin_bp.route("/reports", methods=["GET"])
@jwt_required()
def get_reports():
    admin_id = get_jwt_identity()
    current_admin = Admin.query.get(int(admin_id))
    if not current_admin:
        return jsonify({"error": "Unauthorized"}), 401

    now = datetime.utcnow()

    # === PROPERTY REPORT ===
    total_props = Property.query.count()
    active_props = Property.query.filter_by(is_active=True).count()
    sold_props = Property.query.filter_by(is_closed=True).count()
    rental_props = Property.query.filter(Property.transaction_type == "rent").count()
    pending_props = Property.query.filter_by(status="pending").count()
    rejected_props = Property.query.filter_by(status="rejected").count()

    # By property type
    by_type = db.session.query(
        Property.property_type, func.count(Property.id)
    ).group_by(Property.property_type).all()
    by_type_dict = {row[0]: row[1] for row in by_type}

    # By transaction type
    by_txn = db.session.query(
        Property.transaction_type, func.count(Property.id)
    ).group_by(Property.transaction_type).all()
    by_txn_dict = {row[0]: row[1] for row in by_txn if row[0]}

    # Monthly additions (last 12 months)
    twelve_months_ago = now - timedelta(days=365)
    monthly_props = db.session.query(
        func.substr(cast(Property.created_at, String), 1, 7).label('month'),
        func.count(Property.id)
    ).filter(Property.created_at >= twelve_months_ago
    ).group_by('month').order_by('month').all()
    property_monthly = [{"month": r[0], "count": r[1]} for r in monthly_props]

    # === LEAD REPORT ===
    total_leads = Lead.query.count()
    lead_statuses = LeadStatus.query.filter_by(is_active=True).order_by(LeadStatus.sort_order).all()
    by_status = []
    for s in lead_statuses:
        cnt = Lead.query.filter_by(status=s.id).count()
        if cnt > 0:
            by_status.append({"status": s.name, "color": s.color, "count": cnt})
    unassigned_cnt = Lead.query.filter(Lead.status.is_(None)).count()
    if unassigned_cnt > 0:
        by_status.append({"status": "Unassigned", "color": "#9ca3af", "count": unassigned_cnt})

    by_source = db.session.query(
        Lead.source, func.count(Lead.id)
    ).group_by(Lead.source).all()
    by_source_list = [{"source": r[0] or "unknown", "count": r[1]} for r in by_source]

    won_status = LeadStatus.query.filter_by(name="Won").first()
    lost_status = LeadStatus.query.filter_by(name="Not Interested").first()
    won_count = Lead.query.filter_by(status=won_status.id).count() if won_status else 0
    conversion_rate = round((won_count / total_leads * 100), 1) if total_leads > 0 else 0

    # Monthly lead data
    monthly_leads = db.session.query(
        func.substr(cast(Lead.created_at, String), 1, 7).label('month'),
        func.count(Lead.id)
    ).filter(Lead.created_at >= twelve_months_ago
    ).group_by('month').order_by('month').all()
    lead_monthly_map = {r[0]: r[1] for r in monthly_leads}

    monthly_won = db.session.query(
        func.substr(cast(Lead.created_at, String), 1, 7).label('month'),
        func.count(Lead.id)
    )
    if won_status:
        monthly_won = monthly_won.filter(Lead.status == won_status.id)
    monthly_won = monthly_won.filter(
        Lead.created_at >= twelve_months_ago
    ).group_by('month').order_by('month').all()
    won_monthly_map = {r[0]: r[1] for r in monthly_won}

    monthly_lost = db.session.query(
        func.substr(cast(Lead.created_at, String), 1, 7).label('month'),
        func.count(Lead.id)
    )
    if lost_status:
        monthly_lost = monthly_lost.filter(Lead.status == lost_status.id)
    monthly_lost = monthly_lost.filter(
        Lead.created_at >= twelve_months_ago
    ).group_by('month').order_by('month').all()
    lost_monthly_map = {r[0]: r[1] for r in monthly_lost}

    all_months = sorted(set(list(lead_monthly_map.keys()) + list(won_monthly_map.keys()) + list(lost_monthly_map.keys())))
    lead_monthly = [{
        "month": m,
        "new": lead_monthly_map.get(m, 0),
        "won": won_monthly_map.get(m, 0),
        "lost": lost_monthly_map.get(m, 0),
    } for m in all_months]

    # === AGENT PERFORMANCE ===
    agents = Admin.query.filter(Admin.role != "admin", Admin.is_active == True).order_by(Admin.name).all()
    agent_ids = [a.id for a in agents]

    # Aggregate: assigned leads per agent
    lead_counts = dict(db.session.query(Lead.assigned_to, func.count(Lead.id)).filter(
        Lead.assigned_to.in_(agent_ids)
    ).group_by(Lead.assigned_to).all())

    # Aggregate: interaction counts per type and agent
    interaction_counts = db.session.query(
        LeadHistory.created_by, LeadHistory.type, func.count(LeadHistory.id)
    ).filter(
        LeadHistory.created_by.in_(agent_ids),
        LeadHistory.type.in_(["Call", "Meeting", "Site Visit"]),
    ).group_by(LeadHistory.created_by, LeadHistory.type).all()
    calls_map = {}
    meetings_map = {}
    site_visits_map = {}
    for user_id, typ, cnt in interaction_counts:
        if typ == "Call":
            calls_map[user_id] = cnt
        elif typ == "Meeting":
            meetings_map[user_id] = cnt
        elif typ == "Site Visit":
            site_visits_map[user_id] = cnt

    # Aggregate: properties uploaded per agent
    props_uploaded_map = dict(db.session.query(Property.uploaded_by, func.count(Property.id)).filter(
        Property.uploaded_by.in_(agent_ids)
    ).group_by(Property.uploaded_by).all())

    # Aggregate: closed deals per agent
    deals_closed_map = dict(db.session.query(Property.uploaded_by, func.count(Property.id)).filter(
        Property.uploaded_by.in_(agent_ids), Property.is_closed == True
    ).group_by(Property.uploaded_by).all())

    # Aggregate: won leads per agent
    won_map = {}
    if won_status:
        won_map = dict(db.session.query(Lead.assigned_to, func.count(Lead.id)).filter(
            Lead.assigned_to.in_(agent_ids), Lead.status == won_status.id
        ).group_by(Lead.assigned_to).all())

    agent_performance = []
    for agent in agents:
        agent_performance.append({
            "id": agent.id,
            "name": agent.name or agent.username,
            "leads_assigned": lead_counts.get(agent.id, 0),
            "calls": calls_map.get(agent.id, 0),
            "meetings": meetings_map.get(agent.id, 0),
            "site_visits": site_visits_map.get(agent.id, 0),
            "properties_uploaded": props_uploaded_map.get(agent.id, 0),
            "deals_closed": deals_closed_map.get(agent.id, 0),
            "won_leads": won_map.get(agent.id, 0),
        })

    return jsonify({
        "property_report": {
            "total": total_props,
            "active": active_props,
            "sold": sold_props,
            "rental": rental_props,
            "pending": pending_props,
            "rejected": rejected_props,
            "by_type": by_type_dict,
            "by_transaction_type": by_txn_dict,
            "monthly": property_monthly,
        },
        "lead_report": {
            "total": total_leads,
            "by_status": by_status,
            "by_source": by_source_list,
            "conversion_rate": conversion_rate,
            "won_count": won_count,
            "monthly": lead_monthly,
        },
        "agent_performance": agent_performance,
    })


@admin_bp.route("/reset-user-password", methods=["POST"])
@jwt_required()
def admin_reset_user_password():
    _require_admin()

    data = request.json or {}
    identifier = (data.get("identifier") or "").strip()
    new_password = (data.get("new_password") or "").strip()

    if not identifier:
        return jsonify({"error": "Email or username is required"}), 400
    if not new_password or len(new_password) < MIN_PASSWORD_LENGTH:
        return jsonify({"error": f"Password must be at least {MIN_PASSWORD_LENGTH} characters"}), 400

    user = Admin.query.filter(
        (Admin.email == identifier.lower()) | (Admin.username == identifier)
    ).first()
    if not user:
        return jsonify({"error": "User not found with this email or username"}), 404

    user.password = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    db.session.commit()

    # Mark any pending requests for this identifier as completed
    pending = PasswordResetRequest.query.filter_by(user_identifier=identifier, status="pending").all()
    for r in pending:
        r.status = "completed"
        r.completed_at = datetime.utcnow()
        r.admin_note = "Password reset by admin"
    db.session.commit()

    return jsonify({"message": f"Password reset for {user.username} ({user.email})"})
