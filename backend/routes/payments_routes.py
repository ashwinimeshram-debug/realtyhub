"""Payment webhooks, mock completion and verification endpoints."""
import logging

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.models import ListingTransaction, Owner
from utils import payments as payment_gateway
from utils.listing_lifecycle import apply_paid_transaction

logger = logging.getLogger("realtyhub.payments")

payments_bp = Blueprint("payments", __name__)


def _owner_from_identity():
    ident = str(get_jwt_identity() or "")
    if not ident.startswith("owner:"):
        return None
    try:
        return Owner.query.get(int(ident.split(":", 1)[1]))
    except (ValueError, TypeError):
        return None


def _extract_order_id(payload):
    if not isinstance(payload, dict):
        return None
    entity = (((payload.get("payload") or {}).get("payment") or {}).get("entity"))
    if isinstance(entity, dict) and entity.get("order_id"):
        return entity["order_id"]
    if payload.get("order_id"):
        return payload.get("order_id")
    if payload.get("orderId"):
        return payload.get("orderId")
    obj = (payload.get("data") or {}).get("object") if isinstance(payload.get("data"), dict) else None
    if isinstance(obj, dict) and obj.get("id"):
        return obj.get("id")
    return None


def _extract_payment_id(payload):
    if not isinstance(payload, dict):
        return None
    entity = (((payload.get("payload") or {}).get("payment") or {}).get("entity"))
    if isinstance(entity, dict) and entity.get("id"):
        return entity["id"]
    obj = (payload.get("data") or {}).get("object") if isinstance(payload.get("data"), dict) else None
    if isinstance(obj, dict) and obj.get("id"):
        return obj.get("id")
    return payload.get("payment_id") or None


def _finish_payment(txn, provider_payment_id, method, provider_name):
    apply_paid_transaction(txn, provider_payment_id=provider_payment_id,
                           method=method, provider=provider_name)
    prop = txn.property
    if prop is not None:
        try:
            from utils.listing_lifecycle import _notify_paid
            _notify_paid(prop, txn)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("paid notify failed txn=%s: %s", txn.id, exc)


@payments_bp.route("/webhook/<string:provider_name>", methods=["POST"])
def payment_webhook(provider_name):
    """Gateway webhook. Signature-verified and idempotent."""
    provider = payment_gateway.get_payment_provider()
    if provider_name != provider.name:
        return jsonify({"error": "Provider mismatch"}), 404

    raw = request.get_data()
    signature = (request.headers.get("X-Payments-Signature")
                 or request.headers.get("X-Razorpay-Signature")
                 or request.headers.get("Stripe-Signature") or "")
    payload = request.get_json(silent=True) or {}

    if not provider.verify_webhook(raw, signature, payload):
        return jsonify({"error": "Invalid signature"}), 401

    order_id = _extract_order_id(payload)
    if not order_id:
        return jsonify({"status": "ignored"}), 200

    txn = ListingTransaction.query.filter_by(provider_order_id=order_id).first()
    if not txn:
        return jsonify({"status": "ignored"}), 200

    _finish_payment(txn, _extract_payment_id(payload), "online", provider.name)
    return jsonify({"status": "ok", "transaction_id": txn.id}), 200


@payments_bp.route("/mock/complete", methods=["POST"])
@jwt_required()
def mock_complete():
    """Development-only: simulate a successful payment (mock provider only)."""
    if payment_gateway.active_provider_name() != "mock":
        return jsonify({"error": "Mock payments are disabled"}), 403

    owner = _owner_from_identity()
    if not owner:
        return jsonify({"error": "Owner login required"}), 401

    data = request.json or {}
    txn_id = data.get("transaction_id")
    txn = ListingTransaction.query.get(txn_id) if txn_id else None
    if not txn or txn.owner_id != owner.id:
        return jsonify({"error": "Transaction not found"}), 404

    if txn.status == "paid":
        return jsonify({"status": "ok", "transaction_id": txn.id, "already_paid": True})

    _finish_payment(txn, f"mockpay_{txn.id}", "online", "mock")
    return jsonify({"status": "ok", "transaction_id": txn.id})


@payments_bp.route("/verify", methods=["GET"])
@jwt_required()
def verify_payment():
    owner = _owner_from_identity()
    if not owner:
        return jsonify({"error": "Owner login required"}), 401

    order_id = request.args.get("order_id")
    txn = ListingTransaction.query.filter_by(provider_order_id=order_id).first() if order_id else None
    if not txn or txn.owner_id != owner.id:
        return jsonify({"error": "Transaction not found"}), 404

    return jsonify({
        "transaction_id": txn.id,
        "status": txn.status,
        "purpose": txn.purpose,
        "paid_at": txn.paid_at.isoformat() if txn.paid_at else None,
    })
