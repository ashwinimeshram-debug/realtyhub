"""Paid-listing lifecycle: validity, grace, expiry, reminders, featured boosts.

The source of truth for public visibility lives here so the public list,
location counts, sitemap, property detail and the cron search-alert job all
share one predicate and cannot drift apart.
"""
import logging
import math
from datetime import datetime, timedelta

from sqlalchemy import and_, or_, func

from extensions import db
from models.models import Property, Owner, ListingReminder, ListingTransaction

logger = logging.getLogger("realtyhub.lifecycle")

# Seed defaults (all overridable via the settings table).
DEFAULTS = {
    "require_listing_payment": False,   # False = free-listing bypass (promotion)
    "listing_sell_price": 999,
    "listing_sell_days": 90,
    "listing_rent_price": 499,
    "listing_rent_days": 30,
    "featured_price": 299,
    "featured_days": 30,
    "featured_bundle_discount_percent": 30,
    "section_featured_count": 20,
    "listing_grace_days": 7,
    "listing_expiry_reminder_days": "15,7,3,1",
    "payment_currency": "INR",
}

ACTIVE_PAYMENT_STATUSES = ("paid", "waived")


class FeaturedSlotsFullError(Exception):
    """Raised when every public featured slot is already occupied."""


def _now():
    return datetime.utcnow()


def _settings():
    from routes.settings_routes import get_all_settings
    return get_all_settings()


def _setting_bool(key, default=False):
    from routes.settings_routes import is_setting_enabled
    return is_setting_enabled(key, default=default)


def _setting_int(key, default=0):
    from routes.settings_routes import get_setting_int
    return get_setting_int(key, default)


# =========================
# CONFIGURATION
# =========================
def payment_required():
    """True when owners must pay to publish; False = free-listing bypass."""
    return _setting_bool("require_listing_payment", DEFAULTS["require_listing_payment"])


def grace_days():
    days = _setting_int("listing_grace_days", DEFAULTS["listing_grace_days"])
    return days if days >= 0 else 0


def currency():
    return (_settings().get("payment_currency") or DEFAULTS["payment_currency"]).strip().upper()


def reminder_days():
    raw = _settings().get("listing_expiry_reminder_days")
    if not raw:
        raw = DEFAULTS["listing_expiry_reminder_days"]
    days = []
    for chunk in str(raw).replace(";", ",").split(","):
        chunk = chunk.strip()
        if chunk.isdigit():
            value = int(chunk)
            if value > 0 and value not in days:
                days.append(value)
    return sorted(days, reverse=True)


def plan_for(transaction_type):
    """Return {price, duration_days} for a listing of the given transaction type."""
    tt = (transaction_type or "sell").strip().lower()
    if tt == "rent":
        price = _setting_int("listing_rent_price", DEFAULTS["listing_rent_price"])
        days = _setting_int("listing_rent_days", DEFAULTS["listing_rent_days"])
    else:
        price = _setting_int("listing_sell_price", DEFAULTS["listing_sell_price"])
        days = _setting_int("listing_sell_days", DEFAULTS["listing_sell_days"])
    return {
        "transaction_type": "rent" if tt == "rent" else "sell",
        "price": max(price, 0),
        "duration_days": max(days, 1),
    }


def featured_plan():
    return {
        "purpose": "featured",
        "price": max(_setting_int("featured_price", DEFAULTS["featured_price"]), 0),
        "duration_days": max(_setting_int("featured_days", DEFAULTS["featured_days"]), 1),
    }


def bundle_discount_percent():
    """Admin-configurable discount (%) applied to the featured charge in a combo."""
    pct = _setting_int("featured_bundle_discount_percent",
                       DEFAULTS["featured_bundle_discount_percent"])
    return min(max(pct, 0), 100)


def combo_plan(transaction_type):
    """Listing validity + featured add-on bought together, with the bundle discount.

    Returns the listing plan, the featured portion and the combined price
    (``amount``) after discounting only the featured charge.
    """
    listing = plan_for(transaction_type)
    featured = featured_plan()
    pct = bundle_discount_percent()
    featured_price = featured["price"]
    featured_discounted = round(featured_price * (100 - pct) / 100.0, 2)
    savings = round(featured_price - featured_discounted, 2)
    return {
        "purpose": "combo",
        "transaction_type": listing["transaction_type"],
        "duration_days": listing["duration_days"],
        "featured_days": featured["duration_days"],
        "listing_price": listing["price"],
        "featured_price": featured_price,
        "discount_percent": pct,
        "featured_discounted": featured_discounted,
        "savings": savings,
        "amount": round(listing["price"] + featured_discounted, 2),
    }


def plans_payload():
    """Plans for the owner checkout UI."""
    capacity = featured_capacity()
    used = featured_slots_used()
    return {
        "currency": currency(),
        "payment_required": payment_required(),
        "grace_days": grace_days(),
        "sell": plan_for("sell"),
        "rent": plan_for("rent"),
        "featured": featured_plan(),
        "featured_bundle_discount_percent": bundle_discount_percent(),
        "featured_capacity": capacity,
        "featured_slots_used": used,
        "featured_slots_available": max(0, capacity - used),
        "reminder_days": sorted(reminder_days()),
    }


# =========================
# VISIBILITY
# =========================
def owner_visible_condition():
    """Property has no owner (staff/imported) or its owner is still active."""
    return or_(Property.owner_id.is_(None), Property.owner.has(Owner.is_active == True))


def validity_condition(now=None, grace=None):
    """Unexpired, or within the grace window after expiry."""
    now = now or _now()
    if grace is None:
        grace = grace_days()
    return or_(Property.expires_at.is_(None), Property.expires_at > (now - timedelta(days=grace)))


def public_visible_condition(now=None, grace=None):
    """The single predicate deciding whether a listing is publicly listed."""
    now = now or _now()
    return and_(
        Property.status == "approved",
        Property.is_active == True,
        Property.is_closed == False,
        Property.payment_status.in_(ACTIVE_PAYMENT_STATUSES),
        validity_condition(now, grace),
        owner_visible_condition(),
    )


def listing_state(prop, now=None):
    """Owner-facing state string for a listing card."""
    now = now or _now()
    if prop.is_closed:
        return "closed"
    if prop.payment_status == "unpaid":
        return "payment_pending"
    if prop.status == "rejected":
        return "rejected"
    if prop.status == "pending":
        return "pending"
    if prop.status == "expired":
        return "expired"
    if prop.expires_at is None:
        return "active"
    if prop.expires_at <= now:
        return "grace"
    return "active"


def lead_details_locked(prop, lead, now=None):
    """Whether a lead's contact details must be hidden from its owner.

    The owner only sees a lead's name/mobile/email once the listing is live
    (paid and not past its validity) or if the lead arrived while the listing
    was still live (before it expired). Leads on unpaid listings and leads that
    arrive after a listing expires stay locked until the owner pays/renews.
    A listing closed by the owner keeps showing its leads.
    """
    now = now or _now()
    if prop is None:
        return True
    if prop.is_closed:
        return False
    is_live = prop.payment_status in ACTIVE_PAYMENT_STATUSES and (
        prop.expires_at is None or prop.expires_at > now
    )
    if is_live:
        return False
    if prop.expires_at and lead.created_at and lead.created_at <= prop.expires_at:
        return False
    return True


def days_until_expiry(prop, now=None):
    now = now or _now()
    if not prop.expires_at:
        return None
    return int((prop.expires_at - now).total_seconds() // 86400)


def is_effectively_featured(prop, now=None):
    now = now or _now()
    if not prop.is_featured:
        return False
    return prop.featured_until is None or prop.featured_until > now


# =========================
# FEATURED CAPACITY
# =========================
def featured_capacity():
    """Max number of simultaneously featured listings (admin-configurable)."""
    cap = _setting_int("section_featured_count", DEFAULTS["section_featured_count"])
    return cap if cap > 0 else DEFAULTS["section_featured_count"]


def featured_slots_used(now=None, grace=None):
    """Occupied public featured slots — matches what the homepage actually shows."""
    now = now or _now()
    return int(
        db.session.query(func.count(Property.id))
        .filter(
            public_visible_condition(now, grace),
            Property.is_featured == True,  # noqa: E712
        )
        .scalar()
        or 0
    )


def featured_slots_available(now=None, grace=None):
    return max(0, featured_capacity() - featured_slots_used(now, grace))


def can_feature_another(now=None, grace=None):
    return featured_slots_available(now, grace) > 0


# =========================
# STATE TRANSITIONS
# =========================
def publish_listing(prop, duration_days, now=None):
    """Make an unpaid listing live for the first time."""
    now = now or _now()
    prop.status = "approved"
    prop.is_active = True
    prop.payment_status = "paid"
    prop.published_at = prop.published_at or now
    prop.expires_at = now + timedelta(days=duration_days)


def waive_listing(prop, duration_days, now=None):
    """Free-listing promotion / staff listing: live without payment."""
    now = now or _now()
    prop.status = "approved"
    prop.is_active = True
    prop.payment_status = "waived"
    prop.published_at = prop.published_at or now
    if duration_days:
        prop.expires_at = now + timedelta(days=duration_days)
    # duration_days None => never expires (staff listing)


def renew_listing(prop, duration_days, now=None):
    """Extend an existing listing's validity from now or its current expiry."""
    now = now or _now()
    base = now
    if prop.expires_at and prop.expires_at > now:
        base = prop.expires_at
    prop.expires_at = base + timedelta(days=duration_days)
    prop.last_renewed_at = now
    prop.renewal_count = (prop.renewal_count or 0) + 1
    if prop.payment_status != "paid":
        prop.payment_status = "paid"
    if prop.status in ("expired", "pending"):
        prop.status = "approved"
    prop.is_active = True


def add_featured_days(prop, duration_days, now=None):
    """Extend featured placement from now or the current featured_until."""
    now = now or _now()
    base = now
    if prop.featured_until and prop.featured_until > now:
        base = prop.featured_until
    prop.featured_until = base + timedelta(days=duration_days)
    prop.is_featured = True


# =========================
# CRON JOBS
# =========================
def _already_sent(property_id, kind, stage_days):
    return ListingReminder.query.filter_by(
        property_id=property_id, kind=kind, stage_days=stage_days
    ).first() is not None


def _record(property_id, kind, stage_days, now):
    db.session.add(ListingReminder(
        property_id=property_id, kind=kind, stage_days=stage_days, sent_at=now,
    ))


def _owner_channels(prop):
    owner = prop.owner
    if not owner:
        return None, None
    return owner.email, owner.mobile


def expire_due_listings():
    """Hide listings past expiry+grace and drop expired featured boosts."""
    now = _now()
    cutoff = now - timedelta(days=grace_days())

    due = Property.query.filter(
        Property.status == "approved",
        Property.is_closed == False,
        Property.expires_at.isnot(None),
        Property.expires_at < cutoff,
    ).all()

    expired_ids = []
    notified = 0
    for prop in due:
        already = _already_sent(prop.id, "expired", 0)
        prop.status = "expired"
        prop.is_active = False
        if not already:
            expired_ids.append(prop.id)
            email, phone = _owner_channels(prop)
            if email or phone:
                try:
                    _notify_expired(prop, email, phone)
                    notified += 1
                except Exception as exc:  # pragma: no cover - defensive
                    logger.warning("expiry notify failed property=%s: %s", prop.id, exc)
            _record(prop.id, "expired", 0, now)

    unfeatured = Property.query.filter(
        Property.is_featured == True,
        Property.featured_until.isnot(None),
        Property.featured_until < now,
    ).all()
    for prop in unfeatured:
        prop.is_featured = False

    db.session.commit()
    return {
        "status": "ok",
        "expired": len(due),
        "expired_ids": expired_ids,
        "unfeatured": len(unfeatured),
        "notified": notified,
    }


def _notify_expired(prop, email, phone):
    from utils.mailer import send_email_async, listing_expired_email
    from utils.messaging import send_whatsapp_async
    if email:
        send_email_async(
            f"Your listing has expired - {prop.title}",
            [email],
            listing_expired_email(prop),
        )
    if phone:
        send_whatsapp_async(
            phone,
            f"Your listing \"{prop.title}\" ({prop.listing_id or prop.id}) has expired and is "
            f"no longer visible. Renew to go live again: { _renew_link(prop) }",
        )


def send_expiry_reminders():
    """Send one reminder per listing per run for the nearest crossed stage."""
    now = _now()
    days_list = reminder_days()
    if not days_list:
        return {"status": "ok", "sent": 0, "skipped": True}

    candidates = Property.query.filter(
        Property.status == "approved",
        Property.is_closed == False,
        Property.payment_status.in_(ACTIVE_PAYMENT_STATUSES),
        Property.expires_at.isnot(None),
        Property.expires_at > now,
        Property.owner_id.isnot(None),
    ).all()

    sent = 0
    for prop in candidates:
        days_left = int(math.ceil((prop.expires_at - now).total_seconds() / 86400))
        # Pick the nearest reminder band we've crossed (ascending: 1,3,7,15...).
        applicable = None
        for stage in sorted(days_list):
            if days_left <= stage:
                applicable = stage
                break
        if applicable is None or _already_sent(prop.id, "expiry", applicable):
            continue
        email, phone = _owner_channels(prop)
        try:
            _notify_reminder(prop, email, phone, applicable, days_left)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("reminder failed property=%s: %s", prop.id, exc)
        _record(prop.id, "expiry", applicable, now)
        sent += 1

    db.session.commit()
    return {"status": "ok", "sent": sent, "candidates": len(candidates)}


def _renew_link(prop):
    from utils.mailer import frontend_url
    return frontend_url(f"checkout/{prop.id}?purpose=listing")


def _notify_reminder(prop, email, phone, stage, days_left):
    from utils.mailer import send_email_async, expiry_reminder_email
    from utils.messaging import send_whatsapp_async
    renew_url = _renew_link(prop)
    if email:
        send_email_async(
            f"Renew soon: your listing expires in {days_left} day(s)",
            [email],
            expiry_reminder_email(prop, days_left, renew_url),
        )
    if phone:
        send_whatsapp_async(
            phone,
            f"Reminder: your listing \"{prop.title}\" ({prop.listing_id or prop.id}) expires in "
            f"{days_left} day(s). Renew to keep it live: {renew_url}",
        )


# =========================
# PAYMENT APPLICATION
# =========================
def apply_paid_transaction(txn, provider_payment_id=None, method="online", provider=None):
    """Mark a transaction paid and apply its entitlement (publish / renew / feature).

    Idempotent: returns False when the transaction was already paid.
    """
    now = _now()
    if txn.status == "paid":
        return False

    txn.status = "paid"
    txn.method = method or txn.method or "online"
    if provider:
        txn.provider = provider
    if provider_payment_id:
        txn.provider_payment_id = provider_payment_id
    txn.paid_at = now

    prop = Property.query.get(txn.property_id)
    if not prop:
        db.session.commit()
        return True

    if txn.purpose == "combo":
        # Single payment: publish/renew the listing AND add the featured boost.
        if prop.published_at is None:
            publish_listing(prop, txn.duration_days, now)
        else:
            renew_listing(prop, txn.duration_days, now)
        add_featured_days(prop, txn.featured_days or 0, now)
    elif txn.purpose == "featured":
        add_featured_days(prop, txn.duration_days, now)
    elif prop.published_at is None:
        publish_listing(prop, txn.duration_days, now)
    else:
        renew_listing(prop, txn.duration_days, now)

    # Count the coupon as redeemed only now that payment succeeded.
    try:
        from utils.coupons import redeem_coupon
        redeem_coupon(txn)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("coupon redeem failed txn=%s: %s", txn.id, exc)

    db.session.commit()
    return True


def _notify_paid(prop, txn):
    """Email the owner a receipt after a successful payment."""
    owner = prop.owner
    if not owner:
        return
    try:
        from utils.mailer import get_site_name, send_email_async, payment_receipt_email
        send_email_async(
            f"Payment received - {get_site_name()}",
            [owner.email],
            payment_receipt_email(prop, txn, owner.name),
        )
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("payment receipt failed property=%s: %s", prop.id, exc)
