from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from extensions import db
from models.setting_model import Setting
import time
import re as _re

settings_bp = Blueprint("settings", __name__)

_settings_cache = {}
_cache_ttl = 300  # 5 minutes


def get_all_settings():
    now = time.time()
    if _settings_cache and (now - _settings_cache.get("_ts", 0)) < _cache_ttl:
        return {k: v for k, v in _settings_cache.items() if k != "_ts"}
    settings = Setting.query.all()
    result = {s.skey: s.svalue for s in settings}
    result["_ts"] = now
    _settings_cache.clear()
    _settings_cache.update(result)
    return {k: v for k, v in result.items() if k != "_ts"}


def invalidate_settings_cache():
    _settings_cache.clear()


def is_setting_enabled(key, default=False):
    """Read a boolean setting safely (accepts true/1/yes/on)."""
    value = get_all_settings().get(key)
    if value is None:
        return default
    return str(value).strip().lower() in ("true", "1", "yes", "on")


@settings_bp.route("/settings", methods=["GET"])
def public_get_settings():
    PUBLIC_PREFIXES = ("site_", "section_", "hero_", "page_", "contact_", "social_")
    all_settings = get_all_settings()
    safe = {k: v for k, v in all_settings.items() if k.startswith(PUBLIC_PREFIXES) or k in ("site_name", "site_logo", "allow_public_post")}
    return jsonify(safe)


@settings_bp.route("/admin/settings", methods=["GET"])
@jwt_required()
def admin_get_settings():
    data = dict(get_all_settings())
    if "mail_password" in data:
        data["mail_password"] = ""
    return jsonify(data)


MAIL_SETTING_KEYS = {
    "mail_enabled", "mail_server", "mail_port", "mail_username",
    "mail_password", "mail_sender", "mail_use_tls",
}


@settings_bp.route("/admin/settings", methods=["PUT"])
@jwt_required()
def admin_update_settings():
    data = request.json
    if not isinstance(data, dict):
        return jsonify({"error": "Body must be a JSON object"}), 400
    KNOWN_SETTINGS = {
        "site_name", "site_logo", "session_timeout_minutes", "contact_email",
        "contact_phone", "contact_address", "hero_title", "hero_subtitle",
        "hero_animation", "primary_color", "secondary_color",
        "social_facebook", "social_instagram", "social_twitter", "social_youtube", "social_linkedin",
        "section_order", "section_hero_visible", "section_services_visible",
        "section_advantages_visible", "section_testimonials_visible",
        "section_featured_visible", "section_faq_visible", "section_locations_visible",
        "section_new_visible", "section_new_count",
        "auto_assign_leads", "auto_approve_properties", "allow_public_post",
    }
    ACCEPTED = KNOWN_SETTINGS | MAIL_SETTING_KEYS
    SECTION_HEADER_RE = _re.compile(r"^section_[a-z0-9_]+_(title|subtitle|align)$")
    for key in data:
        if key not in ACCEPTED and not SECTION_HEADER_RE.match(key):
            continue
        val = data[key]
        if key == "mail_password":
            if val is None or not str(val).strip():
                continue
            val = str(val)
        elif val is not None and not isinstance(val, str):
            return jsonify({"error": f"Setting values must be strings: {key}"}), 400
        val_str = str(val) if val is not None else ""
        setting = Setting.query.filter_by(skey=key).first()
        if setting:
            setting.svalue = val_str
        else:
            setting = Setting(skey=key, svalue=val_str)
            db.session.add(setting)
    db.session.commit()
    invalidate_settings_cache()
    return jsonify({"message": "Settings updated"})
