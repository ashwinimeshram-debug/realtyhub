import uuid
from datetime import datetime, timedelta


def _mint_admin_token(app, admin_id):
    from flask_jwt_extended import create_access_token

    with app.app_context():
        return create_access_token(identity=str(admin_id))


def _admin_client(app, admin_id):
    headers = {"Authorization": f"Bearer {_mint_admin_token(app, admin_id)}"}
    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    client = app.test_client()
    return client, headers, (prev_location, prev_csrf)


def _reset(app, prev):
    app.config["JWT_TOKEN_LOCATION"], app.config["JWT_COOKIE_CSRF_PROTECT"] = prev


def _make_admin(marker):
    import bcrypt

    from models.models import Admin

    pw = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
    return Admin(username=f"cp-{marker}", email=f"cp-{marker}@t.com", password=pw, role="admin")


def test_coupon_validation_percent_and_fixed():
    from utils.coupons import compute_discount

    from models.models import Coupon

    percent = Coupon(code="P10", discount_type="percent", value=10, min_amount=0, applies_to="all")
    assert compute_discount(percent, 1000) == 100.0

    capped = Coupon(code="P50CAP", discount_type="percent", value=50, max_discount=100,
                    min_amount=0, applies_to="all")
    assert compute_discount(capped, 1000) == 100.0  # capped
    assert compute_discount(capped, 100) == 50.0

    fixed = Coupon(code="F200", discount_type="fixed", value=200, min_amount=0, applies_to="all")
    assert compute_discount(fixed, 1000) == 200.0
    # Never discounts more than the base.
    assert compute_discount(fixed, 150) == 150.0


def test_validate_coupon_rules(app):
    from extensions import db
    from models.models import Coupon
    from utils.coupons import validate_coupon

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        good = Coupon(code=f"GOOD{marker}", discount_type="percent", value=20,
                      min_amount=500, applies_to="listing", usage_limit=2,
                      valid_until=datetime.utcnow() + timedelta(days=1))
        expired = Coupon(code=f"EXP{marker}", discount_type="fixed", value=100,
                         applies_to="all", valid_until=datetime.utcnow() - timedelta(days=1))
        inactive = Coupon(code=f"OFF{marker}", discount_type="fixed", value=100,
                          applies_to="all", is_active=False)
        wrong_scope = Coupon(code=f"SCOPE{marker}", discount_type="percent", value=10,
                             applies_to="featured")
        db.session.add_all([good, expired, inactive, wrong_scope])
        db.session.commit()

    with app.app_context():
        r = validate_coupon(f"GOOD{marker}", "listing", 1000)
        assert r["valid"] and r["discount_amount"] == 200.0 and r["new_total"] == 800.0

        assert not validate_coupon(f"GOOD{marker}", "listing", 100)["valid"]  # below min
        assert not validate_coupon(f"EXP{marker}", "listing", 1000)["valid"]  # expired
        assert not validate_coupon(f"OFF{marker}", "listing", 1000)["valid"]  # inactive
        assert not validate_coupon(f"SCOPE{marker}", "listing", 1000)["valid"]  # scope
        assert not validate_coupon("NOPE", "listing", 1000)["valid"]  # unknown

    with app.app_context():
        Coupon.query.filter(Coupon.code.like(f"%{marker}")).delete(synchronize_session=False)
        db.session.commit()


def test_redeem_counts_only_on_paid(app):
    from extensions import db
    from models.models import Coupon, CouponRedemption, ListingTransaction, Property
    from utils.coupons import redeem_coupon

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        coupon = Coupon(code=f"RDM{marker}", discount_type="fixed", value=50, applies_to="all")
        prop = Property(title=f"Coupon Prop {marker}", property_type="flat",
                        transaction_type="sell", price=1000, location="Nagpur")
        db.session.add_all([coupon, prop])
        db.session.commit()
        coupon_id = coupon.id
        prop_id = prop.id
        txn = ListingTransaction(property_id=prop_id, owner_id=None, purpose="listing",
                                 amount=100, coupon_id=coupon_id, coupon_code=coupon.code,
                                 coupon_discount=50, status="paid")
        db.session.add(txn)
        db.session.commit()
        txn_id = txn.id

    try:
        with app.app_context():
            txn = db.session.get(ListingTransaction, txn_id)
            redeem_coupon(txn)
            db.session.commit()
            assert db.session.get(Coupon, coupon_id).used_count == 1
            assert CouponRedemption.query.filter_by(transaction_id=txn_id).count() == 1

            # Idempotent: a second call must not double-count.
            redeem_coupon(txn)
            db.session.commit()
            assert db.session.get(Coupon, coupon_id).used_count == 1
    finally:
        with app.app_context():
            CouponRedemption.query.filter_by(transaction_id=txn_id).delete(synchronize_session=False)
            t = db.session.get(ListingTransaction, txn_id)
            if t:
                db.session.delete(t)
            c = db.session.get(Coupon, coupon_id)
            if c:
                db.session.delete(c)
            p = db.session.get(Property, prop_id)
            if p:
                db.session.delete(p)
            db.session.commit()


def test_admin_coupon_crud(app):
    from extensions import db
    from models.models import Admin, Coupon

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        admin = _make_admin(marker)
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id

    client, headers, prev = _admin_client(app, admin_id)
    try:
        code = f"SAVE{marker}"
        rv = client.post("/api/admin/coupons", headers=headers, json={
            "code": code, "discount_type": "percent", "value": 15, "applies_to": "all",
        })
        assert rv.status_code == 201, rv.get_json()
        coupon_id = rv.get_json()["id"]

        # Duplicate code rejected.
        dup = client.post("/api/admin/coupons", headers=headers, json={"code": code.lower(), "value": 5})
        assert dup.status_code == 400

        rv2 = client.get("/api/admin/coupons", headers=headers)
        assert rv2.status_code == 200
        assert any(c["id"] == coupon_id for c in rv2.get_json()["items"])

        rv3 = client.put(f"/api/admin/coupons/{coupon_id}", headers=headers, json={"value": 25})
        assert rv3.status_code == 200 and rv3.get_json()["value"] == 25

        rv4 = client.delete(f"/api/admin/coupons/{coupon_id}", headers=headers)
        assert rv4.status_code == 200
        with app.app_context():
            assert db.session.get(Coupon, coupon_id) is None
    finally:
        _reset(app, prev)
        with app.app_context():
            Coupon.query.filter(Coupon.code.like(f"%{marker}%")).delete(synchronize_session=False)
            a = db.session.get(Admin, admin_id)
            if a:
                db.session.delete(a)
            db.session.commit()
