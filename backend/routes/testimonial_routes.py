from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from extensions import db
from models.testimonial_model import Testimonial
import bleach

testimonial_bp = Blueprint("testimonial", __name__)


@testimonial_bp.route("/testimonials", methods=["GET"])
def get_testimonials():
    testimonials = Testimonial.query.filter_by(is_active=True).order_by(Testimonial.created_at.desc()).all()
    return jsonify([{
        "id": t.id, "name": t.name, "location": t.location,
        "description": t.description, "image": t.image,
    } for t in testimonials])


@testimonial_bp.route("/admin/testimonials", methods=["GET"])
@jwt_required()
def admin_get_testimonials():
    testimonials = Testimonial.query.order_by(Testimonial.created_at.desc()).all()
    return jsonify([{
        "id": t.id, "name": t.name, "location": t.location,
        "description": t.description, "image": t.image, "is_active": t.is_active
    } for t in testimonials])


@testimonial_bp.route("/admin/testimonials", methods=["POST"])
@jwt_required()
def add_testimonial():
    data = request.json
    description = data.get("description", "")
    description = bleach.clean(description, tags=[], strip=True)
    t = Testimonial(name=data.get("name"), location=data.get("location"),
                    description=description, image=data.get("image"), is_active=True)
    db.session.add(t)
    db.session.commit()
    return jsonify({"message": "Testimonial added"}), 201


@testimonial_bp.route("/admin/testimonials/<int:id>", methods=["PUT"])
@jwt_required()
def update_testimonial(id):
    t = Testimonial.query.get_or_404(id)
    data = request.json
    t.name = data.get("name", t.name)
    t.location = data.get("location", t.location)
    description = data.get("description", t.description)
    t.description = bleach.clean(description, tags=[], strip=True)
    t.image = data.get("image", t.image)
    db.session.commit()
    return jsonify({"message": "Testimonial updated"})


@testimonial_bp.route("/admin/testimonials/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_testimonial(id):
    t = Testimonial.query.get_or_404(id)
    db.session.delete(t)
    db.session.commit()
    return jsonify({"message": "Testimonial deleted"})


@testimonial_bp.route("/admin/testimonials/<int:id>/toggle", methods=["PATCH"])
@jwt_required()
def toggle_testimonial(id):
    t = Testimonial.query.get_or_404(id)
    t.is_active = not t.is_active
    db.session.commit()
    return jsonify({"message": "Updated", "is_active": t.is_active})
