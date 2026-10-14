import os, time
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required
from werkzeug.utils import secure_filename
from extensions import db
from models.models import AboutGalleryImage
from utils.supabase_storage import upload_file, delete_file, rename_file, list_files, create_folder, delete_folder
from urllib.parse import urlparse

gallery_bp = Blueprint("gallery", __name__)

SUPABASE_BUCKET = os.environ.get("SUPABASE_BUCKET", "realtyhub-images")

def _public_url(path: str) -> str:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    return f"{supabase_url}/storage/v1/object/public/{SUPABASE_BUCKET}/{path}" if supabase_url else f"uploads/{path}"

def _path_from_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    prefix = f"/storage/v1/object/public/{SUPABASE_BUCKET}/"
    if prefix in parsed.path:
        return parsed.path.split(prefix, 1)[1]
    path = parsed.path.lstrip("/")
    if path.startswith("uploads/"):
        path = path[len("uploads/"):]
    return path


@gallery_bp.route("/admin/about-gallery", methods=["GET"])
@jwt_required()
def get_all_gallery():
    images = AboutGalleryImage.query.order_by(AboutGalleryImage.sort_order.asc()).all()
    return jsonify([{"id": i.id, "image_url": i.image_url, "caption": i.caption,
                     "sort_order": i.sort_order, "is_active": i.is_active,
                     "is_featured": getattr(i, "is_featured", False)} for i in images])


@gallery_bp.route("/admin/about-gallery", methods=["POST"])
@jwt_required()
def add_gallery_image():
    data = request.json
    image_url = data.get("image_url", "")
    if not image_url:
        return jsonify({"error": "image_url is required"}), 400
    img = AboutGalleryImage(
        image_url=data.get("image_url"),
        caption=data.get("caption", ""),
        sort_order=data.get("sort_order", 0),
        is_active=True,
    )
    db.session.add(img)
    db.session.commit()
    return jsonify({"message": "Image added", "id": img.id}), 201


@gallery_bp.route("/admin/about-gallery/<int:id>", methods=["PUT"])
@jwt_required()
def update_gallery_image(id):
    img = AboutGalleryImage.query.get_or_404(id)
    data = request.json
    img.caption = data.get("caption", img.caption)
    img.sort_order = data.get("sort_order", img.sort_order)
    if "is_featured" in data:
        img.is_featured = data["is_featured"]
    if "is_active" in data:
        img.is_active = data["is_active"]
    db.session.commit()
    return jsonify({"message": "Updated"})


@gallery_bp.route("/admin/about-gallery/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_gallery_image(id):
    img = AboutGalleryImage.query.get_or_404(id)
    db.session.delete(img)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@gallery_bp.route("/admin/about-gallery/reorder", methods=["POST"])
@jwt_required()
def reorder_gallery():
    data = request.json
    if not isinstance(data, list):
        return jsonify({"error": "Body must be a JSON array"}), 400
    for item in data:
        if "id" not in item or "sort_order" not in item:
            return jsonify({"error": "Each item must have id and sort_order"}), 400
        img = AboutGalleryImage.query.get(item["id"])
        if img:
            img.sort_order = item["sort_order"]
    db.session.commit()
    return jsonify({"message": "Reordered"})


def _allowed_file(ext: str) -> bool:
    allowed = current_app.config.get("ALLOWED_EXTENSIONS", {"png", "jpg", "jpeg", "gif", "webp", "avif"})
    return ext.lower() in allowed


def _is_folder(item: dict) -> bool:
    return item.get("id") is None or item.get("name", "").endswith("/")


@gallery_bp.route("/admin/gallery", methods=["GET"])
@jwt_required()
def list_gallery_files():
    root_items = list_files("")
    folders = []
    files = []
    for item in root_items:
        name = item.get("name", "")
        if _is_folder(item):
            folder_name = name.rstrip("/")
            sub = list_files(folder_name)
            file_count = len(sub)
            folders.append({"name": folder_name, "file_count": file_count})
            continue
        ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if not _allowed_file(ext):
            continue
        meta = item.get("metadata") or {}
        files.append({
            "filename": name,
            "url": _public_url(name),
            "size": meta.get("size", 0),
            "last_modified": item.get("updated_at", ""),
            "folder": "",
        })
    for folder in sorted(folders, key=lambda f: f["name"].lower()):
        sub_items = list_files(folder["name"])
        for sub_item in sub_items:
            fname = sub_item.get("name", "")
            if _is_folder(sub_item):
                continue
            ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
            if not _allowed_file(ext):
                continue
            meta = sub_item.get("metadata") or {}
            files.append({
                "filename": fname,
                "url": _public_url(f"{folder['name']}/{fname}"),
                "size": meta.get("size", 0),
                "last_modified": sub_item.get("updated_at", ""),
                "folder": folder["name"],
            })
    folders.sort(key=lambda f: f["name"].lower())
    files.sort(key=lambda f: f.get("last_modified", ""), reverse=True)
    return jsonify({"folders": folders, "files": files})


@gallery_bp.route("/admin/gallery/folder", methods=["POST"])
@jwt_required()
def create_gallery_folder():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Folder name is required"}), 400
    safe = secure_filename(name)
    if not safe:
        return jsonify({"error": "Invalid folder name"}), 400
    try:
        existing = list_files(safe)
        if existing:
            return jsonify({"error": "Folder already exists"}), 409
    except Exception:
        pass
    create_folder(safe)
    return jsonify({"message": "Folder created", "name": safe}), 201


@gallery_bp.route("/admin/gallery/folder", methods=["PUT"])
@jwt_required()
def rename_gallery_folder():
    data = request.get_json(silent=True) or {}
    old_name = (data.get("old_name") or "").strip()
    new_name = (data.get("new_name") or "").strip()
    if not old_name or not new_name:
        return jsonify({"error": "old_name and new_name are required"}), 400
    safe = secure_filename(new_name)
    if not safe:
        return jsonify({"error": "Invalid new folder name"}), 400
    items = list_files(old_name)
    if not items:
        return jsonify({"error": "Folder not found or empty"}), 404
    for item in items:
        fname = item.get("name", "")
        if fname.endswith("/"):
            continue
        old_path = f"{old_name}/{fname}"
        new_path = f"{safe}/{fname}"
        rename_file(old_path, new_path)
    old_items = list_files(old_name)
    old_paths = [f"{old_name}/{i['name']}" for i in old_items if not i['name'].endswith("/")]
    if old_paths:
        delete_file(old_paths)
    return jsonify({"message": "Folder renamed", "name": safe})


@gallery_bp.route("/admin/gallery/folder", methods=["DELETE"])
@jwt_required()
def delete_gallery_folder():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Folder name is required"}), 400
    try:
        delete_folder(name)
    except Exception:
        return jsonify({"error": "Could not delete folder"}), 400
    return jsonify({"message": "Folder deleted"})


@gallery_bp.route("/admin/gallery/upload", methods=["POST"])
@jwt_required()
def upload_gallery_files():
    files = request.files.getlist("files")
    if not files or len(files) == 0:
        single = request.files.get("file")
        if single:
            files = [single]
        else:
            return jsonify({"error": "No files provided"}), 400

    max_size = current_app.config.get("MAX_FILE_SIZE", 10 * 1024 * 1024)
    folder = (request.form.get("folder") or "").strip()
    safe_folder = secure_filename(folder) if folder else ""

    uploaded = []
    errors = []

    for file in files:
        if file.filename == "":
            continue
        ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if not _allowed_file(ext):
            errors.append({"filename": file.filename, "error": f".{ext} not allowed"})
            continue
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > max_size:
            errors.append({"filename": file.filename, "error": "File too large (max 10MB)"})
            continue

        filename = f"{time.time_ns()}_{secure_filename(file.filename)}"
        path = f"{safe_folder}/{filename}" if safe_folder else filename
        url_path = upload_file(file, path)
        uploaded.append({"filename": file.filename, "url": url_path})

    return jsonify({"uploaded": uploaded, "errors": errors}), 201 if uploaded else 400


@gallery_bp.route("/admin/gallery/file", methods=["PUT"])
@jwt_required()
def rename_gallery_file():
    data = request.get_json(silent=True) or {}
    old_url = (data.get("old_url") or "").strip()
    new_name = (data.get("new_name") or "").strip()
    if not old_url or not new_name:
        return jsonify({"error": "old_url and new_name are required"}), 400

    old_path = _path_from_url(old_url)
    if not old_path:
        return jsonify({"error": "Could not parse old_url"}), 400

    ext = old_path.rsplit(".", 1)[-1].lower() if "." in old_path else ""
    if not _allowed_file(ext):
        return jsonify({"error": "Cannot rename this file type"}), 400

    safe = secure_filename(new_name)
    if not safe:
        return jsonify({"error": "Invalid filename"}), 400
    if not safe.lower().endswith(f".{ext}"):
        safe = f"{safe}.{ext}"

    folder = os.path.dirname(old_path)
    new_path = f"{folder}/{safe}" if folder else safe

    try:
        new_url = rename_file(old_path, new_path)
    except Exception:
        return jsonify({"error": "Rename failed (file may not exist)"}), 404

    from models.models import PropertyImage, AboutGalleryImage, Admin, TeamMember
    from models.cms_models import HeroSlide, Service
    from models.testimonial_model import Testimonial

    updates = 0
    for model, col in [
        (HeroSlide, "image"), (Service, "image"), (Testimonial, "image"),
        (AboutGalleryImage, "image_url"), (PropertyImage, "image_url"),
        (TeamMember, "photo"), (Admin, "profile_image"),
    ]:
        records = model.query.filter(getattr(model, col) == old_url).all()
        for r in records:
            setattr(r, col, new_url)
            updates += 1
    db.session.commit()

    return jsonify({"message": "File renamed", "old_url": old_url, "new_url": new_url, "updates": updates})


@gallery_bp.route("/admin/gallery/file/crop", methods=["POST"])
@jwt_required()
def crop_gallery_file():
    old_url = request.form.get("old_url", "").strip()
    file = request.files.get("file")
    if not old_url or not file:
        return jsonify({"error": "old_url and file are required"}), 400

    old_path = _path_from_url(old_url)
    if not old_path:
        return jsonify({"error": "Could not parse old_url"}), 400

    max_size = current_app.config.get("MAX_FILE_SIZE", 10 * 1024 * 1024)
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > max_size:
        return jsonify({"error": "File too large (max 10MB)"}), 400

    ext = old_path.rsplit(".", 1)[-1].lower() if "." in old_path else ""
    if not _allowed_file(ext):
        return jsonify({"error": "Cannot crop this file type"}), 400

    folder = os.path.dirname(old_path)
    base = os.path.basename(old_path).rsplit(".", 1)[0]
    new_name = f"{time.time_ns()}_{base}.webp"
    new_path = f"{folder}/{new_name}" if folder else new_name

    try:
        new_url = upload_file(file, new_path)
    except Exception:
        return jsonify({"error": "Upload failed"}), 500

    try:
        delete_file(old_path)
    except Exception:
        pass

    from models.models import PropertyImage, AboutGalleryImage, Admin, TeamMember
    from models.cms_models import HeroSlide, Service
    from models.testimonial_model import Testimonial

    updates = 0
    for model, col in [
        (HeroSlide, "image"), (Service, "image"), (Testimonial, "image"),
        (AboutGalleryImage, "image_url"), (PropertyImage, "image_url"),
        (TeamMember, "photo"), (Admin, "profile_image"),
    ]:
        records = model.query.filter(getattr(model, col) == old_url).all()
        for r in records:
            setattr(r, col, new_url)
            updates += 1
    db.session.commit()

    return jsonify({"message": "File cropped", "old_url": old_url, "new_url": new_url, "updates": updates})


@gallery_bp.route("/admin/gallery/file", methods=["DELETE"])
@jwt_required()
def delete_gallery_files():
    data = request.get_json(silent=True) or {}
    urls = data.get("urls")
    if not urls or not isinstance(urls, list) or len(urls) == 0:
        return jsonify({"error": "urls array is required"}), 400
    deleted = []
    errors = []
    for url in urls:
        path = _path_from_url(url)
        if not path:
            errors.append({"url": url, "error": "Could not parse URL"})
            continue
        try:
            delete_file(path)
            deleted.append(url)
        except Exception as e:
            errors.append({"url": url, "error": str(e)})
    return jsonify({"deleted": deleted, "errors": errors})
