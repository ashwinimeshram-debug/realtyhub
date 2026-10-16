from flask import Blueprint, request, jsonify, current_app
from models.models import db, Admin, Owner, Property, PropertyImage, PropertyContact, PropertyTypeField, PropertyValue, Lead, PresetFeature, PropertyFeature
from utils.helpers import generate_listing_id, paginate
from sqlalchemy import or_, func
from utils.search import apply_property_filters
from utils.listing_lifecycle import (
    public_visible_condition, owner_visible_condition,
)
from utils.owner_auth import load_owner_payload, owner_csrf_ok, get_owner_id
from utils.mailer import (
    connect_ack_visitor_email, connect_owner_email, get_site_name, new_lead_email,
    send_email_async, submission_received_email, submission_confirmed_email,
)
from routes.settings_routes import is_setting_enabled
from extensions import limiter
import os
import json
import math
import logging
from werkzeug.utils import secure_filename
from datetime import datetime
from utils.supabase_storage import delete_file
from utils.images import process_image_upload

logger = logging.getLogger("realtyhub")

public_bp = Blueprint("public", __name__)

from config import Config
VALID_PAGES = Config.VALID_PAGES


def _owner_visible_condition():
    """Properties with no owner (staff/imported) or whose owner is active."""
    return owner_visible_condition()


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


@public_bp.route("/submit-property", methods=["POST"])
@limiter.limit("10/hour")
def submit_property():
    if not is_setting_enabled("allow_public_post", default=True):
        return jsonify({"error": "Public property posting is currently disabled."}), 403
    payload = load_owner_payload()
    if not payload or not owner_csrf_ok(payload):
        return jsonify({"error": "Owner login required to post a property"}), 401
    owner_id = get_owner_id()
    owner = Owner.query.get(owner_id) if owner_id else None
    if not owner or not owner.is_active:
        return jsonify({"error": "Owner login required to post a property"}), 401
    if not owner.is_verified:
        return jsonify({"error": "Please verify your email before posting a property"}), 403

    data = request.form
    required_fields = ["title", "transaction_type", "property_type", "location"]
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"{field} is required"}), 400

    try:
        price = _parse_price(data.get("price"))
        price_text = (data.get("price_text") or "").strip() or "*"
        if price_text.lower() in ("connect for price", "price on request"):
            price = None
        prop = Property(
            title=data.get("title"), description=data.get("description"),
            price=price, price_text=price_text, location=data.get("location"),
            latitude=_parse_coord(data.get("latitude"), -90, 90),
            longitude=_parse_coord(data.get("longitude"), -180, 180),
            transaction_type=data.get("transaction_type"),
            property_type=data.get("property_type"),
            listed_by=data.get("listed_by") if data.get("listed_by") in ("owner", "agent", "broker") else "owner",
            rera_details=(data.get("rera_details") or "").strip() or None,
            status="pending",
            is_active=False,
            payment_status="unpaid",
            owner_id=owner.id,
            overview_template_id=int(data["overview_template_id"]) if data.get("overview_template_id") and data["overview_template_id"].isdigit() else None,
            closing_template_id=int(data["closing_template_id"]) if data.get("closing_template_id") and data["closing_template_id"].isdigit() else None,
            title_template_id=int(data["title_template_id"]) if data.get("title_template_id") and data["title_template_id"].isdigit() else None,
        )
        db.session.add(prop)
        db.session.commit()
        prop.listing_id = generate_listing_id(prop.id)
        db.session.commit()

        # Publication policy: with the free-listing bypass ON the listing is
        # published immediately (waived, still time-limited). With it OFF the
        # listing stays unpaid and hidden until the owner pays for it.
        from utils.listing_lifecycle import payment_required, waive_listing, plan_for
        published_now = False
        if not payment_required():
            waive_listing(prop, plan_for(prop.transaction_type)["duration_days"])
            published_now = True
            db.session.commit()

        owner_mobile = data.get("mobile", "").strip() or owner.mobile
        db.session.add(PropertyContact(
            property_id=prop.id, type="owner",
            name=owner.name, email=owner.email, mobile=owner_mobile,
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
                    url_path = process_image_upload(file, path)
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

        if published_now:
            send_email_async(
                f"Property published - {get_site_name()}",
                [owner.email],
                submission_confirmed_email(prop, owner.name),
            )
        else:
            from utils.mailer import listing_payment_required_email
            send_email_async(
                f"Complete payment to publish - {get_site_name()}",
                [owner.email],
                listing_payment_required_email(prop, owner.name),
            )
        return jsonify({
            "message": "Property published" if published_now else "Listing saved. Complete payment to publish.",
            "listing_id": prop.listing_id,
            "status": prop.status,
            "published_now": published_now,
            "payment_required": not published_now,
            "property_id": prop.id,
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "Submission failed"}), 500


@public_bp.route("/properties", methods=["GET"])
def get_properties():
    query = Property.query.filter(public_visible_condition())

    near = request.args.get("near")
    keyword = request.args.get("q")
    sort = request.args.get("sort", "newest")

    query, filter_err, keyword = apply_property_filters(query, request.args)
    if filter_err:
        return jsonify({"error": filter_err}), 400

    if near:
        pass  # ordering already applied by _apply_near
    elif sort == "price_low":
        query = query.order_by(Property.price.asc())
    elif sort == "price_high":
        query = query.order_by(Property.price.desc())
    elif sort == "featured":
        query = query.order_by(Property.is_featured.desc(), Property.created_at.desc())
    elif keyword and sort in ("relevance", "newest", ""):
        # pg_trgm similarity ranking (falls back to recency on ties)
        similarity = func.greatest(
            func.word_similarity(keyword, Property.title),
            func.word_similarity(keyword, Property.location),
        )
        query = query.order_by(similarity.desc(), Property.created_at.desc())
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
            "listed_by": p.listed_by or "owner",
            "rera_details": p.rera_details or None,
            "latitude": float(p.latitude) if p.latitude is not None else None,
            "longitude": float(p.longitude) if p.longitude is not None else None,
            "images": [img.image_url for img in p.images],
            "created_at": p.created_at.isoformat() if p.created_at else None,
        })
    return jsonify({"items": result, "total": total, "page": page, "per_page": per_page})


@public_bp.route("/property/<int:id>", methods=["GET"])
def get_property_detail(id):
    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if prop.owner_id and (not prop.owner or not prop.owner.is_active):
        return jsonify({"error": "Property not found"}), 404

    owner_pc = PropertyContact.query.filter_by(property_id=id, type="owner").first()
    field_values = PropertyValue.query.filter_by(property_id=id).all()

    field_defs = _get_field_defs()

    return jsonify({
        "id": prop.id, "listing_id": prop.listing_id, "title": prop.title,
        "description": prop.description, "price": float(prop.price) if prop.price is not None else None,
        "price_text": prop.price_text or "*", "location": prop.location, "transaction_type": prop.transaction_type,
        "listed_by": prop.listed_by or "owner",
        "rera_details": prop.rera_details or None,
        "latitude": float(prop.latitude) if prop.latitude is not None else None,
        "longitude": float(prop.longitude) if prop.longitude is not None else None,
        "property_type": prop.property_type, "is_featured": prop.is_featured,
        "is_verified": prop.is_verified, "images": [img.image_url for img in prop.images],
        "created_at": prop.created_at.isoformat() if prop.created_at else None,
        "updated_at": prop.updated_at.isoformat() if prop.updated_at else None,
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
    from utils.consent import consent_given, record_consent
    if not consent_given():
        return jsonify({"error": "Please accept the privacy notice to continue"}), 400

    prop = Property.query.get(id)
    if not prop:
        return jsonify({"error": "Property not found"}), 404
    if prop.owner_id and (not prop.owner or not prop.owner.is_active):
        return jsonify({"error": "Property not found"}), 404
    # A listing must be live to accept enquiries. Unpaid, grace and expired
    # listings still take leads (they unlock on payment/renewal), but listings
    # that were never approved, were rejected, or were closed by the owner do
    # not — report 404 so their existence is not leaked.
    if prop.status in ("pending", "rejected") or prop.is_closed:
        return jsonify({"error": "Property not found"}), 404

    lead = Lead(name=name, email=email, mobile=mobile, source="connect", property_id=id)
    from utils.sla import apply_sla
    apply_sla(lead)
    db.session.add(lead)
    db.session.commit()
    record_consent("enquiry", "visitor", email=email, subject_id=lead.id)

    # Owner-first routing: enquiries on owner-posted properties go directly to
    # the owner and stay unassigned so executives do not double-contact the visitor.
    owner_handled = bool(prop.owner_id)
    if not owner_handled:
        from routes.leads_routes import _auto_assign_lead
        _auto_assign_lead(lead)
        db.session.commit()

    if email:
        send_email_async(
            f"Enquiry received - {get_site_name()}",
            [email],
            connect_ack_visitor_email(name, prop),
        )

    recipients = []
    if owner_handled:
        owner = prop.owner
        if owner:
            send_email_async(
                f"New connect request - {prop.title}",
                [owner.email],
                connect_owner_email(prop, {"name": name, "mobile": mobile, "email": email}, owner.name),
            )
    elif lead.assigned_to:
        exec_admin = Admin.query.get(lead.assigned_to)
        if exec_admin:
            recipients.append(exec_admin.email)
    recipients += [a.email for a in Admin.query.filter_by(role="admin", is_active=True).all()]
    recipients = list(dict.fromkeys(r for r in recipients if r))
    if recipients:
        send_email_async(
            f"New visitor enquiry - {get_site_name()}",
            recipients,
            new_lead_email(lead, prop, owner_handled),
        )

    message = ("Thank you! The owner will contact you shortly."
               if owner_handled else
               "Thank you! Our team will contact you shortly.")
    return jsonify({"message": message}), 201


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
        public_visible_condition(),
    ).group_by(Property.location).order_by(func.count(Property.id).desc()).all()

    counts = {}
    for name, count in rows:
        if name and str(name).strip():
            counts[str(name).strip()] = count

    # Areas users asked to be alerted about are kept even when no listing exists
    # there yet, so an area typed by one visitor shows up for everyone else.
    import json as _json
    from models.models import SavedSearch
    for (params_raw,) in db.session.query(SavedSearch.params).filter(
        SavedSearch.is_active.is_(True)
    ).all():
        try:
            params = _json.loads(params_raw or "{}")
        except (ValueError, TypeError):
            continue
        loc = str(params.get("location") or "").strip()
        if loc and loc not in counts:
            counts[loc] = 0

    ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0].lower()))
    resp = jsonify([{"name": name, "count": count} for name, count in ordered])
    resp.headers["Cache-Control"] = "public, max-age=300"
    return resp


@public_bp.route("/sitemap-data", methods=["GET"])
def sitemap_data():
    """Lightweight listing index (id/title/updated_at) for XML sitemap generation."""
    rows = (
        Property.query.filter(
            public_visible_condition(),
        )
        .with_entities(Property.id, Property.title, Property.updated_at)
        .order_by(Property.updated_at.desc())
        .all()
    )
    resp = jsonify([
        {
            "id": p.id,
            "title": p.title,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in rows
    ])
    resp.headers["Cache-Control"] = "public, max-age=300"
    return resp


# =========================
# ACTIVE PRESET FEATURES (PUBLIC)
# =========================
@public_bp.route("/preset-features", methods=["GET"])
def get_active_features():
    from models.models import PresetFeature
    features = PresetFeature.query.filter_by(is_active=True).order_by(PresetFeature.sort_order.asc()).all()
    return jsonify([{"id": f.id, "label": f.label, "sentence": f.sentence} for f in features])
