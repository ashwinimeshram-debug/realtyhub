from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from extensions import db, limiter
from models.contactus import Contactus
from models.models import Admin, PropertyContact, Property
from sqlalchemy.orm import joinedload
from utils.consent import consent_given, record_consent
from utils.mailer import contactus_admin_email, send_email_async

contact_bp = Blueprint("contact", __name__)


@contact_bp.route("/contact", methods=["POST"])
@limiter.limit("10/hour")
def create_contact():
    data = request.get_json()
    if not all([data.get("name"), data.get("email"), data.get("phone"), data.get("message")]):
        return jsonify({"error": "All fields required"}), 400
    if len(data.get("name", "")) > 100 or len(data.get("email", "")) > 120 or len(data.get("phone", "")) > 20 or len(data.get("message", "")) > 2000:
        return jsonify({"error": "Input too long"}), 400
    if not consent_given():
        return jsonify({"error": "Please accept the privacy notice to continue"}), 400
    new_contact = Contactus(name=data["name"], email=data["email"], phone=data["phone"], message=data["message"])
    db.session.add(new_contact)
    db.session.commit()
    record_consent("contact", "visitor", email=data.get("email"))

    admins = Admin.query.filter_by(role="admin", is_active=True).all()
    for admin in admins:
        send_email_async(
            "New contact form message - Nagpur Realty Hub",
            [admin.email],
            contactus_admin_email(new_contact, admin.name or admin.username),
        )
    return jsonify({"message": "Submitted successfully"}), 201


@contact_bp.route("/admin/contacts", methods=["GET"])
@jwt_required()
def admin_get_contacts():
    contacts = PropertyContact.query.order_by(PropertyContact.created_at.desc()).all()
    contact_prop_ids = {c.property_id for c in contacts if c.property_id}
    all_props = Property.query.order_by(Property.created_at.desc()).options(
        db.joinedload(Property.uploaded_admin)
    ).all()
    prop_map = {p.id: {"title": p.title, "uploader_user_id": p.uploaded_admin.user_id if p.uploaded_admin else None} for p in all_props}

    result = []
    seen_props = set()
    for c in contacts:
        seen_props.add(c.property_id)
        prop_data = prop_map.get(c.property_id, {})
        result.append({
            "id": c.id, "property_id": c.property_id, "property_title": prop_data.get("title"),
            "user_id": prop_data.get("uploader_user_id"),
            "type": c.type, "name": c.name or "", "email": c.email, "mobile": c.mobile,
            "created_at": c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else None
        })
    # Include properties without any owner contact (blank — needs filling)
    for p in all_props:
        if p.id not in seen_props:
            result.append({
                "id": -p.id, "property_id": p.id, "property_title": p.title,
                "user_id": prop_map.get(p.id, {}).get("uploader_user_id"),
                "type": "owner", "name": "", "email": None, "mobile": None,
                "created_at": p.created_at.strftime("%Y-%m-%d %H:%M:%S") if p.created_at else None,
            })
    result.sort(key=lambda r: (r["user_id"] is None, r["user_id"] or ""))
    return jsonify({"contacts": result})


@contact_bp.route("/admin/contactus", methods=["GET"])
@jwt_required()
def admin_get_contactus():
    messages = Contactus.query.order_by(Contactus.created_at.desc()).all()
    return jsonify({"messages": [{
        "id": m.id, "name": m.name, "email": m.email, "phone": m.phone, "message": m.message,
        "created_at": m.created_at.strftime("%Y-%m-%d %H:%M:%S") if m.created_at else None
    } for m in messages]})


@contact_bp.route("/admin/contactus/<int:id>", methods=["DELETE"])
@jwt_required()
def admin_delete_contactus(id):
    m = Contactus.query.get_or_404(id)
    db.session.delete(m)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@contact_bp.route("/admin/contactus/unread-count", methods=["GET"])
@jwt_required()
def admin_contactus_unread_count():
    count = Contactus.query.filter_by(is_read=False).count()
    return jsonify({"count": count})


@contact_bp.route("/admin/contactus/mark-read", methods=["POST"])
@jwt_required()
def admin_contactus_mark_read():
    Contactus.query.filter_by(is_read=False).update({Contactus.is_read: True})
    db.session.commit()
    return jsonify({"message": "Marked as read"})
