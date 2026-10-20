import uuid


def _mint_admin_token(app, admin_id):
    from flask_jwt_extended import create_access_token

    with app.app_context():
        return create_access_token(identity=str(admin_id))


def _delete(client, app, admin_id, path):
    headers = {"Authorization": f"Bearer {_mint_admin_token(app, admin_id)}"}
    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    try:
        return client.delete(path, headers=headers)
    finally:
        app.config["JWT_TOKEN_LOCATION"] = prev_location
        app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf


def test_delete_user_detaches_assigned_leads(client, app):
    import bcrypt

    from extensions import db
    from models.models import Admin, Lead

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        pw = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
        deleter = Admin(username=f"del-{marker}", email=f"del-{marker}@t.com",
                        password=pw, role="admin")
        target = Admin(username=f"tgt-{marker}", email=f"tgt-{marker}@t.com",
                       password=pw, role="agent")
        db.session.add_all([deleter, target])
        db.session.commit()
        deleter_id, target_id = deleter.id, target.id

        lead = Lead(name="Assigned Lead", mobile="9000000000", assigned_to=target_id)
        db.session.add(lead)
        db.session.commit()
        lead_id = lead.id

    try:
        rv = _delete(client, app, deleter_id, f"/api/admin/users/{target_id}")
        assert rv.status_code == 200
        body = rv.get_json()
        assert body["unassigned_leads"] == 1
        assert "1 lead(s) unassigned" in body["message"]

        with app.app_context():
            assert db.session.get(Admin, target_id) is None
            assert db.session.get(Lead, lead_id).assigned_to is None
    finally:
        with app.app_context():
            lead = db.session.get(Lead, lead_id)
            if lead:
                db.session.delete(lead)
            for aid in (deleter_id, target_id):
                a = db.session.get(Admin, aid)
                if a:
                    db.session.delete(a)
            db.session.commit()


def test_delete_user_without_references_succeeds(client, app):
    import bcrypt

    from extensions import db
    from models.models import Admin

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        pw = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
        deleter = Admin(username=f"del2-{marker}", email=f"del2-{marker}@t.com",
                        password=pw, role="admin")
        target = Admin(username=f"tgt2-{marker}", email=f"tgt2-{marker}@t.com",
                       password=pw, role="agent")
        db.session.add_all([deleter, target])
        db.session.commit()
        deleter_id, target_id = deleter.id, target.id

    try:
        rv = _delete(client, app, deleter_id, f"/api/admin/users/{target_id}")
        assert rv.status_code == 200
        assert rv.get_json()["unassigned_leads"] == 0

        with app.app_context():
            assert db.session.get(Admin, target_id) is None
    finally:
        with app.app_context():
            for aid in (deleter_id, target_id):
                a = db.session.get(Admin, aid)
                if a:
                    db.session.delete(a)
            db.session.commit()


def test_admin_cannot_delete_self(client, app):
    import bcrypt

    from extensions import db
    from models.models import Admin

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        pw = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
        admin = Admin(username=f"self-{marker}", email=f"self-{marker}@t.com",
                      password=pw, role="admin")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id

    try:
        rv = _delete(client, app, admin_id, f"/api/admin/users/{admin_id}")
        assert rv.status_code == 400
        with app.app_context():
            assert db.session.get(Admin, admin_id) is not None
    finally:
        with app.app_context():
            a = db.session.get(Admin, admin_id)
            if a:
                db.session.delete(a)
            db.session.commit()
