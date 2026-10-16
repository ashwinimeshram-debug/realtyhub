import uuid
from datetime import datetime, timedelta


def _mint_owner_token(app, owner_id):
    from flask_jwt_extended import create_access_token
    with app.app_context():
        return create_access_token(identity=f"owner:{owner_id}")


def _make_owner(app, verified=True):
    from extensions import db
    from models.models import Owner
    email = f"lifecycle-{uuid.uuid4().hex[:8]}@example.com"
    with app.app_context():
        owner = Owner(
            name="LC Owner", email=email, mobile="9000000099",
            password="x", is_active=True, is_verified=verified,
        )
        db.session.add(owner)
        db.session.commit()
        return owner.id


def _make_prop(app, owner_id, **kw):
    from extensions import db
    from models.models import Property
    defaults = dict(
        title="LC Flat", property_type="flat", location="Nagpur",
        transaction_type="sale", status="approved", is_active=True,
        owner_id=owner_id, payment_status="paid",
    )
    defaults.update(kw)
    with app.app_context():
        prop = Property(**defaults)
        db.session.add(prop)
        db.session.commit()
        return prop.id


def _set_prop(app, prop_id, **fields):
    from extensions import db
    from models.models import Property
    with app.app_context():
        prop = db.session.get(Property, prop_id)
        for key, value in fields.items():
            setattr(prop, key, value)
        db.session.commit()


def _set_setting(app, key, value):
    from extensions import db
    from models.setting_model import Setting
    from routes.settings_routes import invalidate_settings_cache
    with app.app_context():
        row = Setting.query.filter_by(skey=key).first()
        if row:
            row.svalue = str(value)
        else:
            db.session.add(Setting(skey=key, svalue=str(value)))
        db.session.commit()
        invalidate_settings_cache()


def _is_public(app, prop_id):
    from extensions import db
    from models.models import Property
    from utils.listing_lifecycle import public_visible_condition
    with app.app_context():
        return db.session.query(Property.id).filter(
            Property.id == prop_id, public_visible_condition()
        ).first() is not None


def _owner_headers(app, owner_id):
    return {"Authorization": f"Bearer {_mint_owner_token(app, owner_id)}"}


def _as_headers(app):
    """Switch JWT to header auth for the request (caller restores)."""
    prev_loc = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    return prev_loc, prev_csrf


def _restore(app, prev):
    app.config["JWT_TOKEN_LOCATION"] = prev[0]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = prev[1]


def _cleanup(app, prop_id, owner_id=None):
    from extensions import db
    from models.models import (
        Property, PropertyContact, Owner, ListingTransaction, ListingReminder,
    )
    with app.app_context():
        ListingTransaction.query.filter_by(property_id=prop_id).delete()
        ListingReminder.query.filter_by(property_id=prop_id).delete()
        PropertyContact.query.filter_by(property_id=prop_id).delete()
        prop = db.session.get(Property, prop_id)
        if prop:
            db.session.delete(prop)
        if owner_id:
            owner = db.session.get(Owner, owner_id)
            if owner:
                db.session.delete(owner)
        db.session.commit()


def test_unpaid_listing_hidden_until_paid(client, app):
    owner_id = _make_owner(app)
    prop_id = _make_prop(app, owner_id, payment_status="unpaid")
    try:
        assert _is_public(app, prop_id) is False
        _set_prop(app, prop_id, payment_status="paid")
        assert _is_public(app, prop_id) is True
    finally:
        _cleanup(app, prop_id, owner_id)


def test_grace_window_then_hidden(client, app):
    owner_id = _make_owner(app)
    now = datetime.utcnow()
    prop_id = _make_prop(app, owner_id, expires_at=now - timedelta(days=3))
    try:
        assert _is_public(app, prop_id) is True  # inside 7-day grace
        _set_prop(app, prop_id, expires_at=now - timedelta(days=10))
        assert _is_public(app, prop_id) is False  # past grace
    finally:
        _cleanup(app, prop_id, owner_id)


def test_renew_extends_expiry(client, app):
    owner_id = _make_owner(app)
    now = datetime.utcnow()
    prop_id = _make_prop(app, owner_id, expires_at=now + timedelta(days=2))
    try:
        from extensions import db
        from models.models import Property
        from utils.listing_lifecycle import renew_listing
        with app.app_context():
            prop = db.session.get(Property, prop_id)
            old_expiry = prop.expires_at
            renew_listing(prop, 30)
            db.session.commit()
            assert prop.expires_at > old_expiry
            assert (prop.expires_at - old_expiry).days == 30
            assert prop.renewal_count == 1
            assert prop.last_renewed_at is not None
    finally:
        _cleanup(app, prop_id, owner_id)


def test_expire_due_listings_hides_and_unfeatures(client, app):
    owner_id = _make_owner(app)
    now = datetime.utcnow()
    prop_id = _make_prop(
        app, owner_id,
        expires_at=now - timedelta(days=30),
        is_featured=True, featured_until=now - timedelta(days=1),
    )
    try:
        from extensions import db
        from models.models import Property
        from utils.listing_lifecycle import expire_due_listings
        with app.app_context():
            expire_due_listings()
        with app.app_context():
            prop = db.session.get(Property, prop_id)
            assert prop.status == "expired"
            assert prop.is_active is False
            assert prop.is_featured is False
    finally:
        _cleanup(app, prop_id, owner_id)


def test_expiry_reminders_are_idempotent(client, app):
    owner_id = _make_owner(app)
    now = datetime.utcnow()
    prop_id = _make_prop(app, owner_id, expires_at=now + timedelta(days=2))
    try:
        from extensions import db
        from models.models import ListingReminder
        from utils.listing_lifecycle import send_expiry_reminders

        with app.app_context():
            send_expiry_reminders()
        with app.app_context():
            first = ListingReminder.query.filter_by(property_id=prop_id).all()
            assert len(first) == 1
            stage = first[0].stage_days
            assert stage == 3  # days_left=2 falls in the 3-day band

        with app.app_context():
            send_expiry_reminders()
        with app.app_context():
            rows = ListingReminder.query.filter_by(property_id=prop_id).all()
            assert len(rows) == 1  # same band not re-sent
    finally:
        _cleanup(app, prop_id, owner_id)


def test_submit_publishes_with_free_bypass(client, app):
    _set_setting(app, "require_listing_payment", "false")
    owner_id = _make_owner(app)
    prev = _as_headers(app)
    try:
        rv = client.post(
            "/api/submit-property",
            headers=_owner_headers(app, owner_id),
            data={
                "title": "Bypass Flat", "transaction_type": "sale",
                "property_type": "flat", "location": "Nagpur",
            },
        )
        assert rv.status_code == 200, rv.get_json()
        body = rv.get_json()
        assert body.get("published_now") is True
        prop_id = body["property_id"]
        assert _is_public(app, prop_id) is True
        from extensions import db
        from models.models import Property
        with app.app_context():
            prop = db.session.get(Property, prop_id)
            assert prop.payment_status == "waived"
            assert prop.status == "approved"
            assert prop.expires_at is not None
    finally:
        _restore(app, prev)
        if "prop_id" in locals():
            _cleanup(app, prop_id, owner_id)


def test_submit_requires_payment_then_checkout(client, app):
    _set_setting(app, "require_listing_payment", "true")
    owner_id = _make_owner(app)
    prev = _as_headers(app)
    prop_id = None
    try:
        rv = client.post(
            "/api/submit-property",
            headers=_owner_headers(app, owner_id),
            data={
                "title": "Paid Flat", "transaction_type": "sale",
                "property_type": "flat", "location": "Nagpur",
            },
        )
        assert rv.status_code == 200, rv.get_json()
        body = rv.get_json()
        assert body.get("payment_required") is True
        assert body.get("published_now") is False
        prop_id = body["property_id"]
        assert _is_public(app, prop_id) is False

        headers = _owner_headers(app, owner_id)
        co = client.post(
            f"/api/owner/properties/{prop_id}/checkout",
            headers=headers, json={"purpose": "listing"},
        )
        assert co.status_code == 201, co.get_json()
        txn_id = co.get_json()["transaction_id"]

        done = client.post(
            "/api/payments/mock/complete",
            headers=headers, json={"transaction_id": txn_id},
        )
        assert done.status_code == 200, done.get_json()
        assert done.get_json()["status"] == "ok"

        assert _is_public(app, prop_id) is True
        from extensions import db
        from models.models import Property, ListingTransaction
        with app.app_context():
            prop = db.session.get(Property, prop_id)
            assert prop.payment_status == "paid"
            assert prop.published_at is not None
            txn = db.session.get(ListingTransaction, txn_id)
            assert txn.status == "paid"
            assert txn.paid_at is not None
    finally:
        _restore(app, prev)
        _set_setting(app, "require_listing_payment", "false")
        if prop_id:
            _cleanup(app, prop_id, owner_id)


def test_featured_cap_blocks_new_feature(client, app):
    from utils.listing_lifecycle import featured_slots_used, featured_slots_available
    owner_id = _make_owner(app)
    with app.app_context():
        used = featured_slots_used()
    _set_setting(app, "section_featured_count", str(used + 1))  # one free slot

    prop1 = _make_prop(
        app, owner_id,
        is_featured=True, featured_until=datetime.utcnow() + timedelta(days=30),
    )
    prop2 = _make_prop(app, owner_id)
    prev = _as_headers(app)
    try:
        with app.app_context():
            assert featured_slots_available() == 0
        headers = _owner_headers(app, owner_id)
        rv = client.post(f"/api/owner/properties/{prop2}/feature", headers=headers)
        assert rv.status_code == 409, rv.get_json()
        assert rv.get_json().get("code") == "featured_full"
    finally:
        _restore(app, prev)
        _set_setting(app, "section_featured_count", "20")
        _cleanup(app, prop1, owner_id)
        _cleanup(app, prop2)


def test_featured_cap_allows_extending_already_featured(client, app):
    from utils.listing_lifecycle import featured_slots_used
    owner_id = _make_owner(app)
    with app.app_context():
        used = featured_slots_used()
    _set_setting(app, "section_featured_count", str(used + 1))  # one free slot

    prop_id = _make_prop(app, owner_id, is_featured=True)
    prev = _as_headers(app)
    try:
        headers = _owner_headers(app, owner_id)
        # Already occupying the single slot: extending it must be allowed.
        rv = client.post(f"/api/owner/properties/{prop_id}/checkout",
                         headers=headers, json={"purpose": "featured"})
        assert rv.status_code == 201, rv.get_json()
    finally:
        _restore(app, prev)
        _set_setting(app, "section_featured_count", "20")
        _cleanup(app, prop_id, owner_id)
