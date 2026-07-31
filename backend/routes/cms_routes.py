from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from extensions import db, limiter
from models.cms_models import HeroSlide, Service, Advantage
from werkzeug.utils import secure_filename
from datetime import datetime, timezone
import time
import os
from utils.supabase_storage import upload_file as storage_upload, delete_file as storage_delete, list_files as storage_list

cms_bp = Blueprint("cms", __name__)


# =========================
# HERO
# =========================
@cms_bp.route("/hero", methods=["GET"])
def get_hero():
    slides = HeroSlide.query.filter_by(is_active=True).order_by(HeroSlide.order).all()
    return jsonify([{
        "id": s.id, "image": s.image, "title": s.title, "subtitle": s.subtitle,
        "button_text": s.button_text, "button_link": s.button_link,
        "overlay_opacity": s.overlay_opacity or 40,
        "title_color": s.title_color, "title_align": s.title_align,
        "title_font_family": s.title_font_family, "title_font_size": s.title_font_size,
        "title_font_style": s.title_font_style, "title_line_height": s.title_line_height,
        "subtitle_color": s.subtitle_color, "subtitle_align": s.subtitle_align,
        "subtitle_font_family": s.subtitle_font_family, "subtitle_font_size": s.subtitle_font_size,
        "subtitle_font_style": s.subtitle_font_style, "subtitle_line_height": s.subtitle_line_height,
        "background_color": s.background_color,
        "button_color": s.button_color, "button_bg_color": s.button_bg_color,
        "button_align": s.button_align,
        "button_font_family": s.button_font_family, "button_font_size": s.button_font_size,
        "button_font_style": s.button_font_style,
        "content_vertical": s.content_vertical,
        "order": s.order, "is_active": s.is_active,
    } for s in slides])


@cms_bp.route("/admin/hero", methods=["GET"])
@jwt_required()
def admin_get_hero():
    slides = HeroSlide.query.order_by(HeroSlide.order).all()
    return jsonify([{
        "id": s.id, "image": s.image, "title": s.title, "subtitle": s.subtitle,
        "button_text": s.button_text, "button_link": s.button_link,
        "overlay_opacity": s.overlay_opacity or 40,
        "title_color": s.title_color, "title_align": s.title_align,
        "title_font_family": s.title_font_family, "title_font_size": s.title_font_size,
        "title_font_style": s.title_font_style, "title_line_height": s.title_line_height,
        "subtitle_color": s.subtitle_color, "subtitle_align": s.subtitle_align,
        "subtitle_font_family": s.subtitle_font_family, "subtitle_font_size": s.subtitle_font_size,
        "subtitle_font_style": s.subtitle_font_style, "subtitle_line_height": s.subtitle_line_height,
        "background_color": s.background_color,
        "button_color": s.button_color, "button_bg_color": s.button_bg_color,
        "button_align": s.button_align,
        "button_font_family": s.button_font_family, "button_font_size": s.button_font_size,
        "button_font_style": s.button_font_style,
        "content_vertical": s.content_vertical,
        "order": s.order, "is_active": s.is_active,
    } for s in slides])


def _clean_int(value, default=None):
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


@cms_bp.route("/admin/hero", methods=["POST"])
@jwt_required()
def add_hero():
    data = request.json
    title = data.get("title", "")
    subtitle = data.get("subtitle", "")
    button_text = data.get("button_text", "")
    if len(title) > 500 or len(subtitle) > 500 or len(button_text) > 200:
        return jsonify({"error": "Input too long"}), 400
    slide = HeroSlide(
        image=data.get("image"), title=data.get("title"), subtitle=data.get("subtitle"),
        button_text=data.get("button_text"), button_link=data.get("button_link"),
        background_color=data.get("background_color"), button_bg_color=data.get("button_bg_color"),
        order=_clean_int(data.get("order"), 0), is_active=True,
        overlay_opacity=_clean_int(data.get("overlay_opacity"), 40),
        content_vertical=data.get("content_vertical", "middle"),
        title_color=data.get("title_color"), title_align=data.get("title_align"),
        title_font_family=data.get("title_font_family"),
        title_font_size=_clean_int(data.get("title_font_size")),
        title_font_style=data.get("title_font_style"),
        title_line_height=_clean_int(data.get("title_line_height")),
        subtitle_color=data.get("subtitle_color"), subtitle_align=data.get("subtitle_align"),
        subtitle_font_family=data.get("subtitle_font_family"),
        subtitle_font_size=_clean_int(data.get("subtitle_font_size")),
        subtitle_font_style=data.get("subtitle_font_style"),
        subtitle_line_height=_clean_int(data.get("subtitle_line_height")),
        button_color=data.get("button_color"), button_align=data.get("button_align"),
        button_font_family=data.get("button_font_family"),
        button_font_size=_clean_int(data.get("button_font_size")),
        button_font_style=data.get("button_font_style"),
    )
    db.session.add(slide)
    db.session.commit()
    return jsonify({"message": "Hero added", "id": slide.id}), 201


@cms_bp.route("/hero/<int:id>", methods=["PUT"])
@jwt_required()
def update_hero(id):
    data = request.json
    slide = HeroSlide.query.get_or_404(id)
    slide.title = data.get("title", slide.title)
    slide.subtitle = data.get("subtitle", slide.subtitle)
    slide.image = data.get("image", slide.image)
    slide.button_text = data.get("button_text", slide.button_text)
    slide.button_link = data.get("button_link", slide.button_link)
    if "overlay_opacity" in data:
        slide.overlay_opacity = _clean_int(data["overlay_opacity"])
    if "content_vertical" in data:
        slide.content_vertical = data["content_vertical"]
    if "title_color" in data:
        slide.title_color = data["title_color"]
    if "title_align" in data:
        slide.title_align = data["title_align"]
    if "title_font_family" in data:
        slide.title_font_family = data["title_font_family"]
    if "title_font_size" in data:
        slide.title_font_size = _clean_int(data["title_font_size"])
    if "title_font_style" in data:
        slide.title_font_style = data["title_font_style"]
    if "title_line_height" in data:
        slide.title_line_height = _clean_int(data["title_line_height"])
    if "subtitle_color" in data:
        slide.subtitle_color = data["subtitle_color"]
    if "subtitle_align" in data:
        slide.subtitle_align = data["subtitle_align"]
    if "subtitle_font_family" in data:
        slide.subtitle_font_family = data["subtitle_font_family"]
    if "subtitle_font_size" in data:
        slide.subtitle_font_size = _clean_int(data["subtitle_font_size"])
    if "subtitle_font_style" in data:
        slide.subtitle_font_style = data["subtitle_font_style"]
    if "subtitle_line_height" in data:
        slide.subtitle_line_height = _clean_int(data["subtitle_line_height"])
    if "background_color" in data:
        slide.background_color = data["background_color"]
    if "button_color" in data:
        slide.button_color = data["button_color"]
    if "button_bg_color" in data:
        slide.button_bg_color = data["button_bg_color"]
    if "button_align" in data:
        slide.button_align = data["button_align"]
    if "button_font_family" in data:
        slide.button_font_family = data["button_font_family"]
    if "button_font_size" in data:
        slide.button_font_size = _clean_int(data["button_font_size"])
    if "button_font_style" in data:
        slide.button_font_style = data["button_font_style"]
    db.session.commit()
    return jsonify({"message": "Updated"})


@cms_bp.route("/hero/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_hero(id):
    slide = HeroSlide.query.get_or_404(id)
    db.session.delete(slide)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@cms_bp.route("/hero/toggle/<int:id>", methods=["PATCH"])
@jwt_required()
def toggle_hero(id):
    slide = HeroSlide.query.get_or_404(id)
    slide.is_active = not slide.is_active
    db.session.commit()
    return jsonify({"message": "Updated", "is_active": slide.is_active})


@cms_bp.route("/hero/reorder", methods=["POST"])
@jwt_required()
def reorder_hero():
    data = request.json
    if not isinstance(data, list):
        return jsonify({"error": "Body must be a JSON array"}), 400
    for item in data:
        if "id" not in item or "order" not in item:
            return jsonify({"error": "Each item must have id and order"}), 400
        slide = HeroSlide.query.get(item["id"])
        if slide:
            slide.order = item["order"]
    db.session.commit()
    return jsonify({"message": "Reordered"})


# =========================
# SERVICES
# =========================
@cms_bp.route("/services", methods=["GET"])
def get_services():
    services = Service.query.filter_by(is_active=True).all()
    return jsonify([{"id": s.id, "title": s.title, "description": s.description, "image": s.image} for s in services])


@cms_bp.route("/admin/services", methods=["POST"])
@jwt_required()
def add_service():
    data = request.json
    service = Service(title=data.get("title"), description=data.get("description"), image=data.get("image"))
    db.session.add(service)
    db.session.commit()
    return jsonify({"message": "Service added"}), 201


@cms_bp.route("/admin/services/<int:id>", methods=["PUT"])
@jwt_required()
def update_service(id):
    data = request.json
    service = Service.query.get_or_404(id)
    service.title = data.get("title", service.title)
    service.description = data.get("description", service.description)
    service.image = data.get("image", service.image)
    db.session.commit()
    return jsonify({"message": "Service updated"})


@cms_bp.route("/admin/services/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_service(id):
    service = Service.query.get_or_404(id)
    db.session.delete(service)
    db.session.commit()
    return jsonify({"message": "Service deleted"})


@cms_bp.route("/admin/services/<int:id>/toggle", methods=["PATCH"])
@jwt_required()
def toggle_service(id):
    service = Service.query.get_or_404(id)
    service.is_active = not service.is_active
    db.session.commit()
    return jsonify({"message": "Updated", "is_active": service.is_active})


# =========================
# ADVANTAGES
# =========================
@cms_bp.route("/advantages", methods=["GET"])
def get_advantages():
    advantages = Advantage.query.filter_by(is_active=True).all()
    return jsonify([{"id": a.id, "title": a.title, "description": a.description, "icon": a.icon} for a in advantages])


@cms_bp.route("/admin/advantages", methods=["POST"])
@jwt_required()
def add_advantage():
    data = request.json
    advantage = Advantage(title=data.get("title"), description=data.get("description"), icon=data.get("icon"), is_active=True)
    db.session.add(advantage)
    db.session.commit()
    return jsonify({"message": "Advantage added"}), 201


@cms_bp.route("/admin/advantages/<int:id>", methods=["PUT"])
@jwt_required()
def update_advantage(id):
    data = request.json
    advantage = Advantage.query.get_or_404(id)
    advantage.title = data.get("title", advantage.title)
    advantage.description = data.get("description", advantage.description)
    advantage.icon = data.get("icon", advantage.icon)
    db.session.commit()
    return jsonify({"message": "Advantage updated"})


@cms_bp.route("/admin/advantages/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_advantage(id):
    advantage = Advantage.query.get_or_404(id)
    db.session.delete(advantage)
    db.session.commit()
    return jsonify({"message": "Advantage deleted"})


@cms_bp.route("/admin/advantages/<int:id>/toggle", methods=["PATCH"])
@jwt_required()
def toggle_advantage(id):
    advantage = Advantage.query.get_or_404(id)
    advantage.is_active = not advantage.is_active
    db.session.commit()
    return jsonify({"message": "Updated", "is_active": advantage.is_active})


# =========================
# MEDIA LIBRARY
# =========================
@cms_bp.route("/admin/media", methods=["GET"])
@jwt_required()
def list_media():
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", {"png", "jpg", "jpeg", "gif", "webp", "avif"})
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    bucket = os.environ.get("SUPABASE_BUCKET", "realtyhub-images")
    root_items = storage_list("")
    folders = []
    files = []

    def is_folder(item):
        return item.get("id") is None or item.get("metadata") is None

    for item in root_items:
        fname = item.get("name", "")
        if is_folder(item):
            folder_name = fname.rstrip("/")
            folders.append(folder_name)
            continue
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        if ext not in allowed:
            continue
        meta = item.get("metadata") or {}
        files.append({
            "filename": fname,
            "url": f"{supabase_url}/storage/v1/object/public/{bucket}/{fname}" if supabase_url else "",
            "size": meta.get("size", 0),
            "last_modified": item.get("updated_at", ""),
        })
    for folder in sorted(folders):
        for item in storage_list(folder):
            fname = item.get("name", "")
            if is_folder(item):
                continue
            ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
            if ext not in allowed:
                continue
            meta = item.get("metadata") or {}
            files.append({
                "filename": f"{folder}/{fname}",
                "url": f"{supabase_url}/storage/v1/object/public/{bucket}/{folder}/{fname}" if supabase_url else "",
                "size": meta.get("size", 0),
                "last_modified": item.get("updated_at", ""),
            })
    files.sort(key=lambda f: f.get("last_modified", ""), reverse=True)
    return jsonify({"files": files})


# =========================
# FILE UPLOAD
# =========================
@cms_bp.route("/upload", methods=["POST"])
@jwt_required()
def upload_media():
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    allowed = current_app.config.get("ALLOWED_EXTENSIONS", {"png", "jpg", "jpeg", "gif", "webp", "avif"})
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed:
        return jsonify({"error": f"File type .{ext} not allowed"}), 400

    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    max_size = current_app.config.get("MAX_FILE_SIZE", 10 * 1024 * 1024)
    if size > max_size:
        return jsonify({"error": "File too large (max 10MB)"}), 400

    folder = (request.form.get("folder") or "").strip()
    safe_folder = secure_filename(folder) if folder else ""
    filename = f"{time.time_ns()}_{secure_filename(file.filename)}"
    path = f"{safe_folder}/{filename}" if safe_folder else filename
    url_path = storage_upload(file, path)
    return jsonify({"url": url_path})
