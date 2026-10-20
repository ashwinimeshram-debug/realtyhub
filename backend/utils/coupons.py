"""Coupon validation and redemption.

Validation is purely functional (returns a result dict) so it can be reused by
the public ``/owner/coupons/validate`` endpoint and by the checkout flow, which
always recomputes the discount server-side rather than trusting the client.
"""
from datetime import datetime

from extensions import db
from models.models import Coupon, CouponRedemption

VALID_APPLIES_TO = ("listing", "featured", "combo", "all")
VALID_DISCOUNT_TYPES = ("percent", "fixed")


def _now():
    return datetime.utcnow()


def _as_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _purpose_match(coupon, purpose):
    scope = (coupon.applies_to or "all").lower()
    if scope == "all":
        return True
    if purpose == "listing":
        return scope == "listing"
    return scope == purpose


def base_amount_for(prop, purpose):
    """Return the pre-coupon amount for a purpose (mirrors checkout pricing)."""
    from utils.listing_lifecycle import plan_for, featured_plan, combo_plan

    if purpose == "featured":
        return featured_plan()["price"]
    if purpose == "combo":
        return combo_plan(prop.transaction_type)["amount"]
    return plan_for(prop.transaction_type)["price"]


def compute_discount(coupon, base_amount):
    """Return the discount amount (never more than the base)."""
    base = _as_float(base_amount)
    if base <= 0:
        return 0.0
    if coupon.discount_type == "fixed":
        discount = _as_float(coupon.value)
    else:
        discount = base * _as_float(coupon.value) / 100.0
        cap = coupon.max_discount
        if cap is not None:
            discount = min(discount, _as_float(cap))
    discount = max(0.0, min(round(discount, 2), base))
    return discount


def find_coupon(code):
    if not code:
        return None
    return Coupon.query.filter(db.func.lower(Coupon.code) == str(code).strip().lower()).first()


def validate_coupon(code, purpose, base_amount, owner_id=None):
    """Validate a coupon against a purpose/base amount.

    Returns a result dict: ``{valid, code, discount_amount, new_total, message}``.
    """
    base = _as_float(base_amount)
    result = {
        "valid": False,
        "code": (code or "").strip().upper() or None,
        "discount_amount": 0.0,
        "new_total": round(base, 2),
        "message": "",
    }
    if not code:
        result["message"] = "Enter a coupon code"
        return result

    coupon = find_coupon(code)
    if not coupon:
        result["message"] = "Invalid coupon code"
        return result

    result["code"] = coupon.code.upper()
    if not coupon.is_active:
        result["message"] = "This coupon is no longer active"
        return result

    now = _now()
    if coupon.valid_from and coupon.valid_from > now:
        result["message"] = "This coupon is not yet valid"
        return result
    if coupon.valid_until and coupon.valid_until < now:
        result["message"] = "This coupon has expired"
        return result

    if not _purpose_match(coupon, purpose):
        result["message"] = f"This coupon cannot be used for a {purpose} purchase"
        return result

    if base < _as_float(coupon.min_amount):
        result["message"] = (
            f"Minimum order amount for this coupon is {_as_float(coupon.min_amount):.0f}"
        )
        return result

    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        result["message"] = "This coupon has reached its usage limit"
        return result

    if coupon.per_user_limit is not None and owner_id:
        used = CouponRedemption.query.filter_by(
            coupon_id=coupon.id, owner_id=owner_id
        ).count()
        if used >= coupon.per_user_limit:
            result["message"] = "You have already used this coupon"
            return result

    discount = compute_discount(coupon, base)
    if discount <= 0:
        result["message"] = "This coupon gives no discount on this order"
        return result

    result["valid"] = True
    result["discount_amount"] = discount
    result["new_total"] = round(base - discount, 2)
    result["message"] = "Coupon applied"
    return result


def redeem_coupon(txn):
    """Count a coupon as used once its transaction is paid (idempotent).

    Called from ``apply_paid_transaction``; safe to call more than once because
    the transaction's own paid-state guards the caller.
    """
    if txn is None or not getattr(txn, "coupon_id", None):
        return
    coupon = db.session.get(Coupon, txn.coupon_id)
    if not coupon:
        return
    already = CouponRedemption.query.filter_by(transaction_id=txn.id).first()
    if already:
        return
    db.session.add(CouponRedemption(
        coupon_id=coupon.id,
        owner_id=txn.owner_id,
        transaction_id=txn.id,
        amount=txn.coupon_discount or 0,
    ))
    coupon.used_count = (coupon.used_count or 0) + 1
