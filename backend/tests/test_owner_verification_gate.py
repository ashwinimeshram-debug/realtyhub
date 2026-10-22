import uuid


def _mint_owner_token(app, owner_id):
    from flask_jwt_extended import create_access_token
    with app.app_context():
        return create_access_token(identity=f"owner:{owner_id}")


def _patch_auth(app):
    prev_loc = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    return prev_loc, prev_csrf


def _restore(app, prev_loc, prev_csrf):
    app.config["JWT_TOKEN_LOCATION"] = prev_loc
    app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf


def _mk_owner(app, verified):
    from extensions import db
    from models.models import Owner
    with app.app_context():
        o = Owner(name="Gate Owner", email=f"gate-{uuid.uuid4().hex[:8]}@example.com",
                  mobile=f"9{uuid.uuid4().int % 1000000000:09d}", password="x",
                  is_active=True, is_verified=verified)
        db.session.add(o)
        db.session.commit()
        return o.id


def _cleanup(app, owner_id):
    from extensions import db
    from models.models import Owner
    with app.app_context():
        o = db.session.get(Owner, owner_id)
        if o:
            db.session.delete(o)
            db.session.commit()


def test_unverified_owner_blocked_from_dashboard_reads(client, app):
    owner_id = _mk_owner(app, verified=False)
    prev_loc, prev_csrf = _patch_auth(app)
    headers = {"Authorization": f"Bearer {_mint_owner_token(app, owner_id)}"}
    try:
        for method, path in [
            ("get", "/api/owner/properties"),
            ("get", "/api/owner/leads"),
            ("get", "/api/owner/transactions"),
            ("get", "/api/owner/plans"),
            ("get", "/api/owner/data-export"),
        ]:
            rv = getattr(client, method)(path, headers=headers)
            assert rv.status_code == 403, (path, rv.status_code, rv.get_json())
            body = rv.get_json()
            assert body.get("code") == "email_unverified", (path, body)
    finally:
        _restore(app, prev_loc, prev_csrf)
        _cleanup(app, owner_id)


def test_unverified_owner_can_check_auth_and_resend(client, app, monkeypatch):
    from utils import mailer
    owner_id = _mk_owner(app, verified=False)
    prev_loc, prev_csrf = _patch_auth(app)
    headers = {"Authorization": f"Bearer {_mint_owner_token(app, owner_id)}"}
    monkeypatch.setattr(mailer.mail, "send", lambda msg: None)
    try:
        rv = client.get("/api/owner/check-auth", headers=headers)
        assert rv.status_code == 200, rv.get_json()
        assert rv.get_json()["is_verified"] is False

        rv = client.post("/api/owner/resend-verification", headers=headers)
        assert rv.status_code == 200, rv.get_json()
    finally:
        _restore(app, prev_loc, prev_csrf)
        _cleanup(app, owner_id)


def test_verified_owner_can_read_dashboard(client, app):
    owner_id = _mk_owner(app, verified=True)
    prev_loc, prev_csrf = _patch_auth(app)
    headers = {"Authorization": f"Bearer {_mint_owner_token(app, owner_id)}"}
    try:
        rv = client.get("/api/owner/properties", headers=headers)
        assert rv.status_code == 200, rv.get_json()
        rv = client.get("/api/owner/plans", headers=headers)
        assert rv.status_code == 200, rv.get_json()
    finally:
        _restore(app, prev_loc, prev_csrf)
        _cleanup(app, owner_id)
