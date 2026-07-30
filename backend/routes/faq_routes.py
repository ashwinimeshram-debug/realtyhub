from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from extensions import db
from models.models import Faq

faq_bp = Blueprint("faq", __name__)


@faq_bp.route("/admin/faqs", methods=["GET"])
@jwt_required()
def get_faqs():
    faqs = Faq.query.order_by(Faq.order).all()
    return jsonify([{"id": f.id, "question": f.question, "answer": f.answer,
                     "order": f.order, "is_active": f.is_active} for f in faqs])


@faq_bp.route("/admin/faqs", methods=["POST"])
@jwt_required()
def add_faq():
    data = request.json
    question = data.get("question", "")
    answer = data.get("answer", "")
    if len(question) > 500 or len(answer) > 5000:
        return jsonify({"error": "Input too long"}), 400
    faq = Faq(question=question, answer=answer,
              order=data.get("order", 0), is_active=True)
    db.session.add(faq)
    db.session.commit()
    return jsonify({"message": "FAQ added", "id": faq.id}), 201


@faq_bp.route("/admin/faqs/<int:id>", methods=["PUT"])
@jwt_required()
def update_faq(id):
    faq = Faq.query.get_or_404(id)
    data = request.json
    faq.question = data.get("question", faq.question)
    faq.answer = data.get("answer", faq.answer)
    faq.order = data.get("order", faq.order)
    db.session.commit()
    return jsonify({"message": "FAQ updated"})


@faq_bp.route("/admin/faqs/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_faq(id):
    faq = Faq.query.get_or_404(id)
    db.session.delete(faq)
    db.session.commit()
    return jsonify({"message": "FAQ deleted"})


@faq_bp.route("/admin/faqs/<int:id>/toggle", methods=["PATCH"])
@jwt_required()
def toggle_faq(id):
    faq = Faq.query.get_or_404(id)
    faq.is_active = not faq.is_active
    db.session.commit()
    return jsonify({"message": "Updated", "is_active": faq.is_active})


@faq_bp.route("/admin/faqs/reorder", methods=["POST"])
@jwt_required()
def reorder_faqs():
    data = request.json
    if not isinstance(data, list):
        return jsonify({"error": "Body must be a JSON array"}), 400
    for item in data:
        if "id" not in item or "order" not in item:
            return jsonify({"error": "Each item must have id and order"}), 400
        f = Faq.query.get(item["id"])
        if f:
            f.order = item["order"]
    db.session.commit()
    return jsonify({"message": "Reordered"})
