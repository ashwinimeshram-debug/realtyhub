import json
from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.setting_model import Setting
from models.models import Admin

pages_bp = Blueprint("pages", __name__)

from config import Config
VALID_PAGES = Config.VALID_PAGES

ALLOWED_TAGS = ["b", "i", "u", "em", "strong", "a", "br", "p", "ul", "ol", "li"]


def _pages_require_admin():
    admin_id = get_jwt_identity()
    admin = Admin.query.get(int(admin_id))
    if not admin or admin.role != "admin":
        abort(403)


def _sanitize_html(raw_html):
    if not raw_html:
        return raw_html
    import bleach
    return bleach.clean(raw_html, tags=ALLOWED_TAGS, attributes={"a": ["href", "target", "rel"]}, strip=True)


def _get_setting(key):
    s = Setting.query.filter_by(skey=key).first()
    return s.svalue if s else None


def _set_setting(key, value):
    s = Setting.query.filter_by(skey=key).first()
    if s:
        s.svalue = str(value)
    else:
        s = Setting(skey=key, svalue=str(value))
        db.session.add(s)
    db.session.commit()


def _invalidate_cache():
    try:
        from routes.settings_routes import invalidate_settings_cache
        invalidate_settings_cache()
    except Exception:
        pass


# =========================
# ADMIN: List all pages
# =========================
@pages_bp.route("/admin/pages", methods=["GET"])
@jwt_required()
def admin_list_pages():
    result = []
    for slug in VALID_PAGES:
        content_raw = _get_setting(f"page_{slug}")
        try:
            data = json.loads(content_raw) if content_raw else {}
        except Exception:
            data = {}
        result.append({"slug": slug, "title": data.get("title", slug.replace("-", " ").title())})
    return jsonify(result)


# =========================
# ADMIN: Get page by slug
# =========================
@pages_bp.route("/admin/pages/<string:slug>", methods=["GET"])
@jwt_required()
def admin_get_page(slug):
    if slug not in VALID_PAGES:
        return jsonify({"error": "Invalid page"}), 400
    content_raw = _get_setting(f"page_{slug}")
    try:
        data = json.loads(content_raw) if content_raw else {}
    except Exception:
        data = {}
    return jsonify({"slug": slug, "title": data.get("title", ""), "content": data.get("content", "")})


# =========================
# ADMIN: Update page by slug
# =========================
@pages_bp.route("/admin/pages/<string:slug>", methods=["PUT"])
@jwt_required()
def admin_update_page(slug):
    _pages_require_admin()
    if slug not in VALID_PAGES:
        return jsonify({"error": "Invalid page"}), 400
    data = request.json
    current_raw = _get_setting(f"page_{slug}")
    try:
        current = json.loads(current_raw) if current_raw else {}
    except Exception:
        current = {}
    current["title"] = data.get("title", current.get("title", ""))
    current["content"] = _sanitize_html(data.get("content", current.get("content", "")))
    _set_setting(f"page_{slug}", json.dumps(current))
    _invalidate_cache()
    return jsonify({"message": "Page updated"})


# =========================
# ADMIN: Get sections by slug
# =========================
@pages_bp.route("/admin/pages/<string:slug>/sections", methods=["GET"])
@jwt_required()
def admin_get_sections(slug):
    if slug not in VALID_PAGES:
        return jsonify([])
    sections_raw = _get_setting(f"page_{slug}_sections")
    try:
        sections = json.loads(sections_raw) if sections_raw else []
    except Exception:
        sections = []
    return jsonify(sections if isinstance(sections, list) else [])


# =========================
# ADMIN: Replace sections by slug
# =========================
@pages_bp.route("/admin/pages/<string:slug>/sections", methods=["PUT"])
@jwt_required()
def admin_update_sections(slug):
    _pages_require_admin()
    if slug not in VALID_PAGES:
        return jsonify({"error": "Invalid page"}), 400
    data = request.json
    if not isinstance(data, list):
        return jsonify({"error": "Body must be a JSON array"}), 400
    for section in data:
        if "content" in section:
            section["content"] = _sanitize_html(section["content"])
    _set_setting(f"page_{slug}_sections", json.dumps(data))
    _invalidate_cache()
    return jsonify({"message": "Sections updated"})


# =========================
# ADMIN: Get team layout
# =========================
@pages_bp.route("/admin/pages/about/team-layout", methods=["GET"])
@jwt_required()
def admin_get_team_layout():
    layout = _get_setting("page_about_team_layout") or "carousel"
    return jsonify({"layout": layout})


# =========================
# ADMIN: Update team layout
# =========================
@pages_bp.route("/admin/pages/about/team-layout", methods=["PUT"])
@jwt_required()
def admin_update_team_layout():
    _pages_require_admin()
    data = request.json
    layout = data.get("layout", "carousel")
    if layout not in ("carousel", "grid"):
        return jsonify({"error": "Invalid layout"}), 400
    _set_setting("page_about_team_layout", layout)
    _invalidate_cache()
    return jsonify({"message": "Team layout updated"})
