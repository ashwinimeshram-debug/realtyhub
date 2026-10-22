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


def get_setting_int(key, default=0):
    """Read an integer setting safely, falling back to default on bad/missing values."""
    value = get_all_settings().get(key)
    if value is None or str(value).strip() == "":
        return default
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


@settings_bp.route("/settings", methods=["GET"])
def public_get_settings():
    PUBLIC_PREFIXES = ("site_", "section_", "hero_", "page_", "contact_", "social_", "share_", "seo_", "rera_")
    all_settings = get_all_settings()
    safe = {k: v for k, v in all_settings.items() if k.startswith(PUBLIC_PREFIXES) or k in ("site_name", "site_logo", "allow_public_post")}
    resp = jsonify(safe)
    resp.headers["Cache-Control"] = "public, max-age=60"
    return resp


SECRET_SETTING_KEYS = {"mail_password", "whatsapp_access_token", "twilio_auth_token",
                       "payment_key_secret", "payment_webhook_secret", "ai_api_key",
                       "facebook_app_secret"}


@settings_bp.route("/admin/settings", methods=["GET"])
@jwt_required()
def admin_get_settings():
    all_settings = get_all_settings()
    data = dict(all_settings)
    for key in SECRET_SETTING_KEYS:
        if key in data:
            data[key] = ""
    data["ai_api_key_set"] = bool(all_settings.get("ai_api_key"))
    return jsonify(data)


MAIL_SETTING_KEYS = {
    "mail_enabled", "mail_server", "mail_port", "mail_username",
    "mail_password", "mail_sender", "mail_use_tls", "mail_use_ssl",
}

WHATSAPP_SETTING_KEYS = {
    "whatsapp_enabled", "whatsapp_provider", "whatsapp_phone_number_id",
    "whatsapp_access_token", "whatsapp_from", "whatsapp_api_version",
    "twilio_account_sid", "twilio_auth_token", "twilio_whatsapp_from",
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
        "section_new_visible", "section_new_count", "section_featured_count",
        "section_featured_split",
        "auto_assign_leads", "auto_approve_properties", "allow_public_post",
        "data_retention_days",
        # Paid-listing lifecycle
        "require_listing_payment",
        "listing_sell_price", "listing_sell_days",
        "listing_rent_price", "listing_rent_days",
        "featured_price", "featured_days",
        "featured_bundle_discount_percent",
        "listing_grace_days", "listing_expiry_reminder_days",
        "payment_provider", "payment_key_id", "payment_currency",
        "payment_key_secret", "payment_webhook_secret",
        "share_caption_template",
        "seo_google_verification", "seo_bing_verification", "seo_default_description",
        "rera_license",
        # AI copy generation
        "ai_enabled", "ai_provider", "ai_model", "ai_api_key",
    }
    ACCEPTED = KNOWN_SETTINGS | MAIL_SETTING_KEYS | WHATSAPP_SETTING_KEYS
    SECTION_HEADER_RE = _re.compile(r"^section_[a-z0-9_]+_(title|subtitle|align)$")
    for key in data:
        if key not in ACCEPTED and not SECTION_HEADER_RE.match(key):
            continue
        val = data[key]
        if key in SECRET_SETTING_KEYS:
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
