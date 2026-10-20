"""Facebook Lead Ads ingestion + admin configuration.

Public webhook (no auth, verified by the Meta hub challenge token):
    GET  /api/meta/webhook   — Meta verification handshake
    POST /api/meta/webhook   — leadgen events (fetched then stored as leads)

Admin configuration (requires facebook.manage):
    GET/PUT /api/admin/facebook/settings
    GET/POST/PUT/DELETE /api/admin/facebook/pages
    POST /api/admin/facebook/pages/<id>/test
    GET  /api/admin/facebook/events
"""
import json
import logging
import secrets

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import jwt_required

from extensions import db, limiter
from models.models import Admin, Lead, LeadStatus, MetaLeadEvent, MetaPage, Property
from routes.settings_routes import get_all_settings, invalidate_settings_cache
from utils.meta_graph import MetaError, get_lead, get_page
from utils.permissions import require_permission
from utils.secrets_crypto import decrypt_secret, encrypt_secret, mask_secret

logger = logging.getLogger("realtyhub.meta")

meta_bp = Blueprint("meta", __name__)

_FB_SETTING_KEYS = {
    "facebook_enabled", "facebook_app_id", "facebook_app_secret",
    "facebook_verify_token", "facebook_default_source", "facebook_auto_assign",
}
_FB_SECRET_KEYS = {"facebook_app_secret"}


# =========================
# Helpers
# =========================
def _get_verify_token():
    """Verify token from settings, falling back to a stable env value."""
    from routes.settings_routes import get_all_settings
    token = (get_all_settings().get("facebook_verify_token") or "").strip()
    if token:
        return token
    return (current_app.config.get("FACEBOOK_VERIFY_TOKEN") or "").strip()


def _meta_credentials():
    s = get_all_settings()
    return {
        "enabled": str(s.get("facebook_enabled", "")).strip().lower() in ("true", "1", "yes", "on"),
        "app_id": (s.get("facebook_app_id") or "").strip(),
        "app_secret": (s.get("facebook_app_secret") or "").strip(),
        "verify_token": (s.get("facebook_verify_token") or "").strip(),
        "default_source": (s.get("facebook_default_source") or "facebook").strip() or "facebook",
        "auto_assign": str(s.get("facebook_auto_assign", "true")).strip().lower() not in ("false", "0", "no", "off"),
    }


def _extract_contact(fields):
    """Pick name/email/mobile from Meta lead field_data with common aliases."""
    def pick(*names):
        for n in names:
            v = fields.get(n)
            if v:
                return str(v).strip()
        return ""

    name = pick("full_name", "name", "first_name")
    if not name:
        first = pick("first_name")
        last = pick("last_name")
        name = (f"{first} {last}").strip()
    email = pick("email", "email_address")
    mobile = pick("phone_number", "phone", "mobile", "mobile_number")
    return name or "Facebook Lead", email, mobile


def _store_event(leadgen_id, page_id=None, form_id=None, status="pending", detail=None, lead_id=None):
    row = MetaLeadEvent(
        leadgen_id=str(leadgen_id), page_id=page_id, form_id=form_id,
        status=status, detail=(detail or "")[:255] or None, lead_id=lead_id,
    )
    db.session.add(row)
    return row


def _ingest_leadgen(leadgen_id, page_id):
    """Fetch a leadgen record and create a Lead. Idempotent per leadgen_id."""
    existing = MetaLeadEvent.query.filter_by(leadgen_id=str(leadgen_id)).first()
    if existing and existing.status == "imported":
        return "duplicate"

    page = MetaPage.query.filter_by(page_id=str(page_id)).first() if page_id else None
    if not page or not page.is_active:
        _store_event(leadgen_id, page_id=page_id, status="error", detail="Unknown or inactive page")
        db.session.commit()
        return "unknown_page"

    token = decrypt_secret(page.access_token)
    if not token:
        _store_event(leadgen_id, page_id=page_id, status="error", detail="Page token could not be read")
        db.session.commit()
        return "bad_token"

    try:
        data = get_lead(leadgen_id, token)
    except MetaError as exc:
        _store_event(leadgen_id, page_id=page_id, status="error", detail=str(exc))
        db.session.commit()
        return "fetch_failed"

    fields = data.get("fields") or {}
    name, email, mobile = _extract_contact(fields)
    source = (page.source_label or _meta_credentials()["default_source"] or "facebook").strip()

    lead = Lead(name=name[:100], email=email[:150] or None, mobile=mobile[:15] or None,
                source=source, stage="NEW", lead_status="ACTIVE")
    from utils.sla import apply_sla
    apply_sla(lead)
    db.session.add(lead)
    db.session.flush()

    if _meta_credentials()["auto_assign"]:
        try:
            from routes.leads_routes import _auto_assign_lead
            _auto_assign_lead(lead)
        except Exception as exc:  # pragma: no cover
            logger.warning("Facebook lead auto-assign failed: %s", exc)

    page.last_lead_at = lead.created_at
    _store_event(leadgen_id, page_id=str(page_id), form_id=data.get("form_id"),
                 status="imported", lead_id=lead.id)
    db.session.commit()

    _notify_new_meta_lead(lead, page)
    return "imported"


def _notify_new_meta_lead(lead, page):
    try:
        from utils.mailer import get_site_name, new_lead_email, send_email_async
        recipients = [a.email for a in Admin.query.filter_by(role="admin", is_active=True).all() if a.email]
        if lead.assigned_to:
            exec_admin = Admin.query.get(lead.assigned_to)
            if exec_admin and exec_admin.email:
                recipients.insert(0, exec_admin.email)
        recipients = list(dict.fromkeys(r for r in recipients if r))
        if recipients:
            send_email_async(
                f"New Facebook lead - {get_site_name()}",
                recipients,
                new_lead_email(lead, None, False),
            )
    except Exception as exc:  # pragma: no cover
        logger.warning("Facebook lead notification failed: %s", exc)


# =========================
# Public webhook
# =========================
@meta_bp.route("/meta/webhook", methods=["GET"])
def meta_webhook_verify():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    expected = _get_verify_token()
    if mode == "subscribe" and expected and token == expected:
        return current_app.response_class(challenge or "", mimetype="text/plain")
    return jsonify({"error": "Verification failed"}), 403


@meta_bp.route("/meta/webhook", methods=["POST"])
def meta_webhook_receive():
    if not _meta_credentials()["enabled"]:
        return jsonify({"status": "disabled"}), 200
    payload = request.get_json(silent=True) or {}
    if payload.get("object") != "page":
        return jsonify({"status": "ignored"}), 200

    processed = 0
    for entry in payload.get("entry") or []:
        page_id = str(entry.get("id") or "") or None
        for change in entry.get("changes") or []:
            if change.get("field") != "leadgen":
                continue
            value = change.get("value") or {}
            leadgen_id = value.get("leadgen_id")
            if not leadgen_id:
                continue
            try:
                _ingest_leadgen(leadgen_id, page_id)
                processed += 1
            except Exception as exc:  # pragma: no cover
                db.session.rollback()
                logger.warning("Facebook leadgen %s failed: %s", leadgen_id, exc)
                try:
                    _store_event(leadgen_id, page_id=page_id, status="error", detail=str(exc))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
    return jsonify({"status": "ok", "processed": processed}), 200


# =========================
# Admin configuration
# =========================
def _page_dict(p, include_token=False):
    d = {
        "id": p.id,
        "page_id": p.page_id,
        "page_name": p.page_name,
        "source_label": p.source_label,
        "is_active": p.is_active,
        "last_lead_at": p.last_lead_at.isoformat() if p.last_lead_at else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "has_token": bool(p.access_token),
        "token_preview": mask_secret(p.access_token),
    }
    return d


def _webhook_url():
    try:
        from utils.mailer import frontend_url
        base = frontend_url("")
    except Exception:
        base = ""
    return f"{base}/api/meta/webhook" if base else "/api/meta/webhook"


@meta_bp.route("/admin/facebook/settings", methods=["GET"])
@require_permission("facebook.manage")
def get_facebook_settings():
    s = get_all_settings()
    return jsonify({
        "enabled": str(s.get("facebook_enabled", "")).strip().lower() in ("true", "1", "yes", "on"),
        "app_id": s.get("facebook_app_id", "") or "",
        "app_secret_set": bool(s.get("facebook_app_secret")),
        "app_secret_preview": mask_secret(s.get("facebook_app_secret")),
        "verify_token": s.get("facebook_verify_token", "") or "",
        "default_source": s.get("facebook_default_source") or "facebook",
        "auto_assign": str(s.get("facebook_auto_assign", "true")).strip().lower() not in ("false", "0", "no", "off"),
        "webhook_url": _webhook_url(),
    })


@meta_bp.route("/admin/facebook/settings", methods=["PUT"])
@require_permission("facebook.manage")
def update_facebook_settings():
    from models.setting_model import Setting

    data = request.json or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Body must be a JSON object"}), 400

    def _upsert(key, value):
        setting = Setting.query.filter_by(skey=key).first()
        if setting:
            setting.svalue = value
        else:
            db.session.add(Setting(skey=key, svalue=value))

    if "enabled" in data:
        _upsert("facebook_enabled", "true" if data.get("enabled") else "false")
    if "app_id" in data:
        _upsert("facebook_app_id", str(data.get("app_id") or "").strip())
    if "app_secret" in data:
        raw = str(data.get("app_secret") or "").strip()
        if raw:  # blank keeps the existing secret
            _upsert("facebook_app_secret", encrypt_secret(raw))
    if "default_source" in data:
        src = str(data.get("default_source") or "facebook").strip() or "facebook"
        _upsert("facebook_default_source", src[:50])
    if "auto_assign" in data:
        _upsert("facebook_auto_assign", "true" if data.get("auto_assign") else "false")
    if data.get("regenerate_verify_token"):
        _upsert("facebook_verify_token", secrets.token_urlsafe(24))
    elif "verify_token" in data:
        vt = str(data.get("verify_token") or "").strip()
        if vt:
            _upsert("facebook_verify_token", vt[:128])

    db.session.commit()
    invalidate_settings_cache()
    return jsonify({"message": "Facebook settings updated"})


@meta_bp.route("/admin/facebook/pages", methods=["GET"])
@require_permission("facebook.manage")
def list_facebook_pages():
    pages = MetaPage.query.order_by(MetaPage.created_at.desc()).all()
    return jsonify({"items": [_page_dict(p) for p in pages]})


@meta_bp.route("/admin/facebook/pages", methods=["POST"])
@require_permission("facebook.manage")
def create_facebook_page():
    data = request.json or {}
    page_id = str(data.get("page_id") or "").strip()
    token = str(data.get("access_token") or "").strip()
    if not page_id or not token:
        return jsonify({"error": "Page ID and access token are required"}), 400
    if MetaPage.query.filter_by(page_id=page_id).first():
        return jsonify({"error": "This page is already connected"}), 400

    page_name = str(data.get("page_name") or "").strip() or None
    try:
        info = get_page(page_id, token)
        page_name = page_name or info.get("name") or None
    except MetaError as exc:
        if not data.get("skip_validation"):
            return jsonify({"error": f"Could not verify this page/token: {exc}"}), 400

    source_label = str(data.get("source_label") or "").strip()[:50] or "facebook"
    page = MetaPage(
        page_id=page_id, page_name=page_name, access_token=encrypt_secret(token),
        source_label=source_label, is_active=bool(data.get("is_active", True)),
    )
    db.session.add(page)
    db.session.commit()
    return jsonify(_page_dict(page)), 201


@meta_bp.route("/admin/facebook/pages/<int:id>", methods=["PUT"])
@require_permission("facebook.manage")
def update_facebook_page(id):
    page = MetaPage.query.get(id)
    if not page:
        return jsonify({"error": "Not found"}), 404
    data = request.json or {}
    if "page_name" in data:
        page.page_name = str(data.get("page_name") or "").strip() or None
    if "source_label" in data:
        page.source_label = str(data.get("source_label") or "").strip()[:50] or "facebook"
    if "is_active" in data:
        page.is_active = bool(data.get("is_active"))
    if data.get("access_token"):
        token = str(data["access_token"]).strip()
        try:
            get_page(page.page_id, token)
        except MetaError as exc:
            if not data.get("skip_validation"):
                return jsonify({"error": f"Could not verify this token: {exc}"}), 400
        page.access_token = encrypt_secret(token)
    db.session.commit()
    return jsonify(_page_dict(page))


@meta_bp.route("/admin/facebook/pages/<int:id>", methods=["DELETE"])
@require_permission("facebook.manage")
def delete_facebook_page(id):
    page = MetaPage.query.get(id)
    if not page:
        return jsonify({"error": "Not found"}), 404
    db.session.delete(page)
    db.session.commit()
    return jsonify({"message": "Page disconnected"})


@meta_bp.route("/admin/facebook/pages/<int:id>/test", methods=["POST"])
@require_permission("facebook.manage")
def test_facebook_page(id):
    page = MetaPage.query.get(id)
    if not page:
        return jsonify({"error": "Not found"}), 404
    token = decrypt_secret(page.access_token)
    if not token:
        return jsonify({"ok": False, "error": "Stored token could not be read"}), 400
    try:
        info = get_page(page.page_id, token)
    except MetaError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 400
    if info.get("name") and info["name"] != page.page_name:
        page.page_name = info["name"]
        db.session.commit()
    return jsonify({"ok": True, "page_id": info.get("id"), "page_name": info.get("name")})


@meta_bp.route("/admin/facebook/events", methods=["GET"])
@require_permission("facebook.manage")
def list_facebook_events():
    rows = MetaLeadEvent.query.order_by(MetaLeadEvent.created_at.desc()).limit(100).all()
    return jsonify({"items": [{
        "id": r.id,
        "leadgen_id": r.leadgen_id,
        "page_id": r.page_id,
        "form_id": r.form_id,
        "status": r.status,
        "detail": r.detail,
        "lead_id": r.lead_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    } for r in rows]})
