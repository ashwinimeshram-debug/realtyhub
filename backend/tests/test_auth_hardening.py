def test_security_headers_present(client):
    rv = client.get("/api/types")
    assert rv.status_code == 200
    assert rv.headers.get("X-Content-Type-Options") == "nosniff"
    assert rv.headers.get("X-Frame-Options") == "DENY"
    assert rv.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert "Content-Security-Policy" in rv.headers
    assert "frame-ancestors 'none'" in rv.headers["Content-Security-Policy"]


def test_logout_revokes_token(client, app):
    import uuid

    from flask_jwt_extended import create_access_token

    from extensions import db
    from models.models import Owner

    with app.app_context():
        owner = Owner(
            name="Blocklist Owner",
            email=f"blocklist-{uuid.uuid4().hex[:8]}@example.com",
            mobile="9000000001", password="x",
        )
        db.session.add(owner)
        db.session.commit()
        owner_id = owner.id
        token = create_access_token(identity=f"owner:{owner_id}")

    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    headers = {"Authorization": f"Bearer {token}"}
    try:
        rv = client.get("/api/owner/data-export", headers=headers)
        assert rv.status_code == 200

        rv2 = client.post("/api/owner/logout", headers=headers)
        assert rv2.status_code == 200

        # The same token must now be rejected.
        rv3 = client.get("/api/owner/data-export", headers=headers)
        assert rv3.status_code == 401
    finally:
        app.config["JWT_TOKEN_LOCATION"] = prev_location
        app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf
        with app.app_context():
            from models.models import TokenBlocklist
            TokenBlocklist.query.delete()
            owner = db.session.get(Owner, owner_id)
            if owner:
                db.session.delete(owner)
            db.session.commit()
