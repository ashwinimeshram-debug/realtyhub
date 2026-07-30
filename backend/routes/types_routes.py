from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from extensions import db
from models.models import PropertyType

types_bp = Blueprint("types", __name__)


@types_bp.route("/admin/types", methods=["GET"])
@jwt_required()
def admin_get_types():
    category = request.args.get("category")
    query = PropertyType.query
    if category:
        query = query.filter_by(category=category)
    types = query.order_by(PropertyType.sort_order).all()
    return jsonify([{"id": t.id, "name": t.name, "value": t.value,
                     "category": t.category, "is_active": t.is_active, "sort_order": t.sort_order} for t in types])


@types_bp.route("/admin/types", methods=["POST"])
@jwt_required()
def create_type():
    data = request.json
    value = data.get("value", "").strip()
    if not value:
        return jsonify({"error": "Type value is required"}), 400
    if PropertyType.query.filter_by(value=value).first():
        return jsonify({"error": "Type with this value already exists"}), 409
    t = PropertyType(name=data.get("name"), value=value,
                     category=data.get("category"), sort_order=data.get("sort_order", 0))
    if "is_active" in data:
        t.is_active = data["is_active"]
    db.session.add(t)
    db.session.commit()
    return jsonify({"message": "Type created", "id": t.id}), 201


@types_bp.route("/admin/types/<int:id>", methods=["PUT"])
@jwt_required()
def update_type(id):
    t = PropertyType.query.get_or_404(id)
    data = request.json
    t.name = data.get("name", t.name)
    t.value = data.get("value", t.value)
    t.is_active = data.get("is_active", t.is_active)
    t.sort_order = data.get("sort_order", t.sort_order)
    db.session.commit()
    return jsonify({"message": "Type updated"})


@types_bp.route("/admin/types/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_type(id):
    t = PropertyType.query.get_or_404(id)
    db.session.delete(t)
    db.session.commit()
    return jsonify({"message": "Type deleted"})
