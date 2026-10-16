import json
import secrets

from flask import Blueprint, request, jsonify

from extensions import db, limiter
from models.models import SavedSearch, Owner
from utils.owner_auth import load_owner_payload, owner_csrf_ok, get_owner_id

saved_search_bp = Blueprint("saved_search", __name__)

ALLOWED_PARAMS = (
    "q", "location", "type", "category", "min_price", "max_price",
    "featured", "near", "radius_km",
    # Buyer-intent field (not used to match properties, only stored/shown).
    "timeline",
)

# Keys that actually narrow the property search. A saved search must set at
# least one of these (timeline alone would otherwise alert on every listing).
FILTER_PARAMS = (
    "q", "location", "type", "category", "min_price", "max_price",
    "featured", "near", "radius_km",
)


def _clean_params(raw):
    if not isinstance(raw, dict):
        return {}
    return {
        k: str(v).strip()
        for k, v in raw.items()
        if k in ALLOWED_PARAMS and v is not None and str(v).strip() != ""
    }


def _current_owner():
    """Return the logged-in Owner when a valid owner session is present."""
    owner_id = get_owner_id()
    return Owner.query.get(owner_id) if owner_id else None


def _serialize(saved):
    try:
        params = json.loads(saved.params or "{}")
    except (ValueError, TypeError):
        params = {}
    return {
        "id": saved.id,
        "name": saved.name,
        "email": saved.email,
        "phone": saved.phone,
        "params": params,
        "notify": saved.notify,
        "is_active": saved.is_active,
        "last_notified_at": saved.last_notified_at.isoformat() if saved.last_notified_at else None,
        "created_at": saved.created_at.isoformat() if saved.created_at else None,
    }


@saved_search_bp.route("/saved-searches", methods=["POST"])
@limiter.limit("20/hour")
def create_saved_search():
    data = request.get_json(silent=True) or {}
    params = _clean_params(data.get("params"))
    if not any(k in params for k in FILTER_PARAMS):
        return jsonify({"error": "At least one search filter (area, type, budget or keyword) is required"}), 400

    owner = _current_owner()
    email = (data.get("email") or "").strip() or None
    phone = (data.get("phone") or "").strip() or None
    if owner:
        email = email or owner.email
    if not email and not phone:
        return jsonify({"error": "An email or mobile number is required for alerts"}), 400

    saved = SavedSearch(
        owner_id=owner.id if owner else None,
        email=email,
        phone=phone,
        name=(data.get("name") or "").strip() or None,
        params=json.dumps(params),
        unsubscribe_token=secrets.token_urlsafe(32),
    )
    db.session.add(saved)
    db.session.commit()
    return jsonify({
        "message": "Alerts saved",
        "id": saved.id,
        "unsubscribe_token": saved.unsubscribe_token,
    }), 201


@saved_search_bp.route("/saved-searches", methods=["GET"])
def list_saved_searches():
    owner_id = get_owner_id()
    if not owner_id:
        return jsonify({"error": "Owner login required"}), 401
    rows = SavedSearch.query.filter_by(owner_id=owner_id).order_by(
        SavedSearch.created_at.desc()
    ).all()
    return jsonify({"items": [_serialize(s) for s in rows]})


@saved_search_bp.route("/saved-searches/<int:id>", methods=["DELETE"])
def delete_saved_search(id):
    payload = load_owner_payload()
    owner_id = get_owner_id()
    if not payload or not owner_id or not owner_csrf_ok(payload):
        return jsonify({"error": "Owner login required"}), 401
    saved = SavedSearch.query.get(id)
    if not saved or saved.owner_id != owner_id:
        return jsonify({"error": "Saved search not found"}), 404
    db.session.delete(saved)
    db.session.commit()
    return jsonify({"message": "Deleted"})


@saved_search_bp.route("/saved-searches/unsubscribe", methods=["POST", "GET"])
def unsubscribe_saved_search():
    token = None
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        token = data.get("token")
    token = token or request.args.get("token")
    if not token:
        return jsonify({"error": "Missing token"}), 400
    saved = SavedSearch.query.filter_by(unsubscribe_token=token).first()
    if not saved:
        return jsonify({"error": "Saved search not found"}), 404
    saved.is_active = False
    saved.notify = False
    db.session.commit()
    return jsonify({"message": "Unsubscribed"})
