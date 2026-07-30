from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from extensions import db
from models.models import TeamMember

team_bp = Blueprint("team", __name__)


@team_bp.route("/admin/team", methods=["GET"])
@jwt_required()
def get_team():
    members = TeamMember.query.filter_by(is_active=True).order_by(TeamMember.sort_order.asc()).all()
    return jsonify([{
        "id": m.id, "name": m.name, "role": m.role, "bio": m.bio,
        "email": m.email, "social_links": m.social_links or {},
        "photo_url": m.photo or "", "is_leader": m.is_leader,
        "sort_order": m.sort_order,
    } for m in members])


@team_bp.route("/admin/team", methods=["POST"])
@jwt_required()
def create_member():
    data = request.json
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    social_links = data.get("social_links", {})
    if not isinstance(social_links, dict):
        return jsonify({"error": "social_links must be a JSON object"}), 400
    member = TeamMember(
        name=name,
        role=data.get("role", ""),
        bio=data.get("bio", ""),
        email=data.get("email", ""),
        social_links=social_links,
        photo=data.get("photo_url", ""),
        is_leader=data.get("is_leader", False),
        sort_order=data.get("sort_order", 0),
    )
    db.session.add(member)
    db.session.commit()
    return jsonify({
        "id": member.id, "name": member.name, "role": member.role,
        "bio": member.bio, "email": member.email,
        "social_links": member.social_links or {},
        "photo_url": member.photo or "", "is_leader": member.is_leader,
        "sort_order": member.sort_order,
    }), 201


@team_bp.route("/admin/team/<int:id>", methods=["PUT"])
@jwt_required()
def update_member(id):
    member = TeamMember.query.get_or_404(id)
    data = request.json
    member.name = data.get("name", member.name)
    member.role = data.get("role", member.role)
    member.bio = data.get("bio", member.bio)
    member.email = data.get("email", member.email)
    if "social_links" in data:
        sl = data["social_links"]
        if not isinstance(sl, dict):
            return jsonify({"error": "social_links must be a JSON object"}), 400
        member.social_links = sl
    if "photo_url" in data:
        member.photo = data["photo_url"]
    if "is_leader" in data:
        member.is_leader = data["is_leader"]
    if "sort_order" in data:
        member.sort_order = data["sort_order"]
    db.session.commit()
    return jsonify({
        "id": member.id, "name": member.name, "role": member.role,
        "bio": member.bio, "email": member.email,
        "social_links": member.social_links or {},
        "photo_url": member.photo or "", "is_leader": member.is_leader,
        "sort_order": member.sort_order,
    })


@team_bp.route("/admin/team/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_member(id):
    member = TeamMember.query.get_or_404(id)
    db.session.delete(member)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@team_bp.route("/admin/team/reorder", methods=["POST"])
@jwt_required()
def reorder_members():
    data = request.json
    if not isinstance(data, list):
        return jsonify({"error": "Body must be a JSON array"}), 400
    for item in data:
        if "id" not in item or "sort_order" not in item:
            return jsonify({"error": "Each item must have id and sort_order"}), 400
        m = TeamMember.query.get(item["id"])
        if m:
            m.sort_order = item["sort_order"]
    db.session.commit()
    return jsonify({"message": "Reordered"})
