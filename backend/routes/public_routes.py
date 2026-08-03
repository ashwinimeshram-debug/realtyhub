from flask import Blueprint, request, jsonify, current_app
from models.models import db, Property, PropertyImage, PropertyContact, PropertyTypeField, PropertyValue, Lead, PresetFeature, PropertyFeature
from utils.helpers import generate_listing_id, paginate
from extensions import limiter
import os
import json
import logging
from werkzeug.utils import secure_filename
from datetime import datetime
from utils.supabase_storage import upload_file, delete_file

logger = logging.getLogger("realtyhub")

public_bp = Blueprint("public", __name__)

from config import Config
VALID_PAGES = Config.VALID_PAGES


def _validate_file(file):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in current_app.config.get("ALLOWED_EXTENSIONS", {"png", "jpg", "jpeg", "gif", "webp", "avif"}):
        return False, f"File type .{ext} not allowed"
    file.seek(0, os.SEEK_END)
    size = file.tell()
    file.seek(0)
    if size > current_app.config.get("MAX_FILE_SIZE", 10 * 1024 * 1024):
        return False, "File too large (max 10MB)"
    return True, None


def _parse_price(price_str):
    if not price_str:
        return None
    import re
    cleaned = re.sub(r'[₹$,]', '', str(price_str))
    multiplier = 1
    if re.search(r'\b(crore|cr)\b', cleaned, re.IGNORECASE):
        multiplier = 10_00_000
    elif re.search(r'\b(lakh|lac)\b', cleaned, re.IGNORECASE):
        multiplier = 1_00_000
    elif re.search(r'\bk\b', cleaned, re.IGNORECASE):
        multiplier = 1_000
    cleaned = re.sub(r'\b(lakh|lac|crore|cr|k)\b', '', cleaned, flags=re.IGNORECASE).strip()
    try:
        return float(cleaned) * multiplier
    except ValueError:
        return None


@public_bp.route("/submit-property", methods=["POST"])
@limiter.limit("10/hour")
def submit_property():
    data = request.form
    required_fields = ["title", "transaction_type", "property_type", "location", "name"]
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400
    if not data.get("mobile") and not data.get("email"):
        return jsonify({"error": "Mobile or Email is required"}), 400

    try:
        price = _parse_price(data.get("price"))
        price_text = (data.get("price_text") or "").strip() or "*"
        if price_text.lower() in ("connect for price", "price on request"):
            price = None
        prop = Property(
            title=data.get("title"), description=data.get("description"),
            price=price, price_text=price_text, location=data.get("location"),
            transaction_type=data.get("transaction_type"),
            property_type=data.get("property_type"),
            status="pending", is_active=False,
            overview_template_id=int(data["overview_template_id"]) if data.get("overview_template_id") and data["overview_template_id"].isdigit() else None,
            closing_template_id=int(data["closing_template_id"]) if data.get("closing_template_id") and data["closing_template_id"].isdigit() else None,
            title_template_id=int(data["title_template_id"]) if data.get("title_template_id") and data["title_template_id"].isdigit() else None,
        )
        db.session.add(prop)
        db.session.commit()
        prop.listing_id = generate_listing_id(prop.id)
        db.session.commit()

        owner_name = data.get("name", "").strip()
        owner_email = data.get("email", "").strip() or None
        owner_mobile = data.get("mobile", "").strip()
        db.session.add(PropertyContact(
            property_id=prop.id, type="owner",
            name=owner_name, email=owner_email, mobile=owner_mobile,
        ))

        db.session.flush()

        safe_folder = prop.listing_id
        files = request.files.getlist("images")
        total_size = 0
        _saved_paths = []
        try:
            for file in files:
                if file and file.filename != "":
                    valid, err = _validate_file(file)
                    if not valid:
                        return jsonify({"error": err}), 400
                    file.seek(0, os.SEEK_END)
                    total_size += file.tell()
                    file.seek(0)
                    if total_size > current_app.config.get("MAX_CONTENT_LENGTH", 50 * 1024 * 1024):
                        return jsonify({"error": "Total upload size exceeds 50MB"}), 400
                    filename = f"{int(datetime.utcnow().timestamp())}_{secure_filename(file.filename)}"
                    path = f"{safe_folder}/{filename}" if safe_folder else filename
                    url_path = upload_file(file, path)
                    _saved_paths.append(path)
                    db.session.add(PropertyImage(property_id=prop.id, image_url=url_path))
        except Exception:
            db.session.rollback()
            for p in _saved_paths:
                try:
                    delete_file(p)
                except Exception:
                    pass
            raise

        db.session.commit()

        field_values_raw = data.get("field_values")
        if field_values_raw:
            try:
                field_values = json.loads(field_values_raw)
                for fv in field_values:
                    if fv.get("field_key") and fv.get("field_value"):
                        db.session.add(PropertyValue(
                            property_id=prop.id,
                            field_key=fv["field_key"],
                            field_value=fv["field_value"],
                        ))
                db.session.commit()
            except Exception as e:
                logger.warning("Failed to parse field_values for submission: %s", e)

        feature_ids_raw = data.get("feature_ids")
        if feature_ids_raw:
            try:
                fids = json.loads(feature_ids_raw)
                for fid in fids:
                    pf = PresetFeature.query.get(int(fid))
                    if pf:
                        db.session.add(PropertyFeature(property_id=prop.id, feature_id=pf.id))
                db.session.commit()
            except Exception as e:
                logger.warning("Failed to parse feature_ids for submission: %s", e)

        return jsonify({"message": "Property submitted for review", "listing_id": prop.listing_id})
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Submission failed"}), 500


@public_bp.route("/properties", methods=["GET"])
def get_properties():
    query = Property.query.filter_by(status="approved", is_active=True, is_closed=False)

    location = request.args.get("location")
    transaction_type = request.args.get("type")
    property_type = request.args.get("category")
    min_price = request.args.get("min_price")
    max_price = request.args.get("max_price")
    featured = request.args.get("featured")
    sort = request.args.get("sort", "newest")

    if location:
        query = query.filter(Property.location.ilike(f"%{location}%"))
    if transaction_type:
        query = query.filter_by(transaction_type=transaction_type)
    if property_type:
        query = query.filter_by(property_type=property_type)
    if min_price:
        try:
            query = query.filter(Property.price >= float(min_price))
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid min_price"}), 400
    if max_price:
        try:
            query = query.filter(Property.price <= float(max_price))
        except (ValueError, TypeError):
            return jsonify({"error": "Invalid max_price"}), 400
    if featured == "true":
        query = query.filter_by(is_featured=True)

    if sort == "price_low":
        query = query.order_by(Property.price.asc())
    elif sort == "price_high":
        query = query.order_by(Property.price.desc())
    elif sort == "featured":
        query = query.order_by(Property.is_featured.desc(), Property.created_at.desc())
    else:
        query = query.order_by(Property.created_at.desc())

    page = request.args.get("page", 1)
    per_page = request.args.get("per_page", 20)
    properties, total, page, per_page = paginate(query, page, per_page)
    result = []
    for p in properties:
        result.append({
            "id": p.id, "listing_id": p.listing_id, "title": p.title,
            "price": float(p.price) if p.price is not None else None, "price_text": p.price_text or "*", "location": p.location,
            "is_featured": p.is_featured, "is_verified": p.is_verified,
            "property_type": p.property_type, "transaction_type": p.transaction_type,
            "images": [img.image_url for img in p.images],
        })
    return jsonify({"items": result, "total": total, "page": page, "per_page": per_page})


@public_bp.route("/property/<int:id>", methods=["GET"])
def get_property_detail(id):
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404

    owner_pc = PropertyContact.query.filter_by(property_id=id, type="owner").first()
    field_values = PropertyValue.query.filter_by(property_id=id).all()

    field_defs = _get_field_defs()

    return jsonify({
        "id": prop.id, "listing_id": prop.listing_id, "title": prop.title,
        "description": prop.description, "price": float(prop.price) if prop.price is not None else None,
        "price_text": prop.price_text or "*", "location": prop.location, "transaction_type": prop.transaction_type,
        "property_type": prop.property_type, "is_featured": prop.is_featured,
        "is_verified": prop.is_verified, "images": [img.image_url for img in prop.images],
        "owner_name": owner_pc.name if owner_pc else None,
        "contact": {"name": owner_pc.name if owner_pc else None, "mobile": owner_pc.mobile if owner_pc else None, "email": owner_pc.email if owner_pc else None},
        "selected_features": [{"id": pf.id, "label": pf.label} for pf in prop.features],
        "field_values": [{"field_key": fv.field_key, "field_value": fv.field_value, "field_label": field_defs.get(fv.field_key, fv.field_key)} for fv in field_values],
    })


@public_bp.route("/property/<int:id>/contact", methods=["POST"])
@limiter.limit("10/hour")
def property_contact(id):
    data = request.json
    name = data.get("name", "").strip()
    mobile = data.get("mobile", "").strip()
    email = data.get("email", "").strip()
    if not name or not mobile:
        return jsonify({"error": "Name and mobile are required"}), 400

    lead = Lead(name=name, email=email, mobile=mobile, source="connect", property_id=id)
    db.session.add(lead)
    db.session.commit()

    from routes.leads_routes import _auto_assign_lead
    _auto_assign_lead(lead)
    db.session.commit()

    return jsonify({"message": "Thank you! Our team will contact you shortly."}), 201


@public_bp.route("/faq", methods=["GET"])
def get_faqs():
    from models.models import Faq
    faqs = Faq.query.filter_by(is_active=True).order_by(Faq.order.asc()).all()
    return jsonify([{"id": f.id, "question": f.question, "answer": f.answer} for f in faqs])


@public_bp.route("/types", methods=["GET"])
def get_types():
    from models.models import PropertyType
    category = request.args.get("category")
    query = PropertyType.query.filter_by(is_active=True)
    if category:
        query = query.filter_by(category=category)
    types = query.order_by(PropertyType.sort_order.asc()).all()
    return jsonify([{"id": t.id, "name": t.name, "value": t.value, "category": t.category} for t in types])


@public_bp.route("/property-type-fields/<string:type_value>", methods=["GET"])
def get_property_type_fields(type_value):
    lang = request.args.get("lang", "en")
    fields = PropertyTypeField.query.filter_by(
        property_type_value=type_value, is_active=True
    ).order_by(PropertyTypeField.sort_order.asc()).all()

    result = []
    for f in fields:
        label = f.field_label
        if lang == "mr" and f.field_label_mr:
            label = f.field_label_mr
        elif lang == "hi" and f.field_label_hi:
            label = f.field_label_hi
        result.append({
            "field_key": f.field_key,
            "field_label": label,
            "field_type": f.field_type,
            "options": f.options,
            "unit_options": f.unit_options,
            "placeholder": f.placeholder,
            "is_required": f.is_required,
        })
    return jsonify(result)


@public_bp.route("/team", methods=["GET"])
def get_team():
    from models.models import TeamMember
    members = TeamMember.query.filter_by(is_active=True).order_by(TeamMember.sort_order.asc()).all()
    return jsonify([{
        "id": m.id, "name": m.name, "role": m.role, "photo_url": m.photo,
        "bio": m.bio, "email": m.email, "social_links": m.social_links,
        "is_leader": m.is_leader
    } for m in members])


@public_bp.route("/pages/<slug>", methods=["GET"])
def get_page(slug):
    if slug not in VALID_PAGES:
        return jsonify({"error": "Page not found"}), 404
    from models.setting_model import Setting
    content_key = f"page_{slug}"
    setting = Setting.query.filter_by(skey=content_key).first()
    if not setting:
        return jsonify({"title": slug.replace("-", " ").title(), "content": ""})
    try:
        data = json.loads(setting.svalue)
    except Exception:
        data = {"title": slug.replace("-", " ").title(), "content": ""}
    return jsonify(data)


@public_bp.route("/pages/<slug>/sections", methods=["GET"])
def get_page_sections(slug):
    if slug not in VALID_PAGES:
        return jsonify([])
    from models.setting_model import Setting
    sections_key = f"page_{slug}_sections"
    setting = Setting.query.filter_by(skey=sections_key).first()
    if not setting:
        return jsonify([])
    try:
        sections = json.loads(setting.svalue)
        if isinstance(sections, list):
            return jsonify(sections)
    except Exception:
        pass
    return jsonify([])


@public_bp.route("/pages/about/team-layout", methods=["GET"])
def get_team_layout():
    from models.setting_model import Setting
    setting = Setting.query.filter_by(skey="page_about_team_layout").first()
    layout = setting.svalue if setting else "carousel"
    return jsonify({"layout": layout})


@public_bp.route("/about-gallery", methods=["GET"])
def get_about_gallery():
    from models.models import AboutGalleryImage
    images = AboutGalleryImage.query.filter_by(is_active=True).order_by(AboutGalleryImage.sort_order.asc()).all()
    return jsonify([{"id": i.id, "image_url": i.image_url, "caption": i.caption} for i in images])


@public_bp.route("/description-templates", methods=["GET"])
def get_description_templates():
    from models.models import DescriptionTemplate
    prop_type = request.args.get("property_type")
    query = DescriptionTemplate.query.filter_by(is_active=True)
    if prop_type:
        query = query.filter(
            (DescriptionTemplate.property_type.is_(None)) | (DescriptionTemplate.property_type == prop_type)
        )
    else:
        query = query.filter(DescriptionTemplate.property_type.is_(None))
    templates = query.order_by(
        DescriptionTemplate.category.asc(), DescriptionTemplate.sort_order.asc()
    ).all()
    grouped = {}
    for t in templates:
        grouped.setdefault(t.category, []).append({"id": t.id, "template_text": t.template_text, "sort_order": t.sort_order})
    return jsonify(grouped)


# =========================
# LOCATION COUNTS
# =========================
_public_bp_field_cache = None

def _get_field_defs():
    global _public_bp_field_cache
    if _public_bp_field_cache is None:
        _public_bp_field_cache = {f.field_key: f.field_label for f in PropertyTypeField.query.all()}
    return _public_bp_field_cache


def invalidate_field_cache():
    global _public_bp_field_cache
    _public_bp_field_cache = None


@public_bp.route("/location-counts", methods=["GET"])
def location_counts():
    from sqlalchemy import func
    rows = db.session.query(
        Property.location, func.count(Property.id).label("count")
    ).filter(
        Property.status == "approved", Property.is_active == True, Property.is_closed == False
    ).group_by(Property.location).order_by(func.count(Property.id).desc()).all()
    return jsonify([{"name": r[0], "count": r[1]} for r in rows if r[0]])


# =========================
# ACTIVE PRESET FEATURES (PUBLIC)
# =========================
@public_bp.route("/preset-features", methods=["GET"])
def get_active_features():
    from models.models import PresetFeature
    features = PresetFeature.query.filter_by(is_active=True).order_by(PresetFeature.sort_order.asc()).all()
    return jsonify([{"id": f.id, "label": f.label, "sentence": f.sentence} for f in features])
