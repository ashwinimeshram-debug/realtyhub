import uuid


def _mint_owner_token(app, owner_id):
    from flask_jwt_extended import create_access_token
    with app.app_context():
        return create_access_token(identity=f"owner:{owner_id}")


def _setup(app, status):
    from extensions import db
    from models.models import Owner, Property

    email = f"edit-owner-{uuid.uuid4().hex[:8]}@example.com"
    with app.app_context():
        owner = Owner(
            name="Edit Owner", email=email, mobile="9000000077",
            password="x", is_active=True, is_verified=True,
        )
        db.session.add(owner)
        db.session.commit()
        owner_id = owner.id

        prop = Property(
            title="Edit Flat", property_type="flat", location="Nagpur",
            transaction_type="sale", status=status, owner_id=owner_id,
            is_active=(status == "approved"),
        )
        db.session.add(prop)
        db.session.commit()
        prop_id = prop.id
    return owner_id, prop_id


def _edit(client, app, prop_id, owner_id):
    headers = {"Authorization": f"Bearer {_mint_owner_token(app, owner_id)}"}
    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    try:
        return client.put(
            f"/api/owner/properties/{prop_id}",
            headers=headers,
            json={"title": "Edit Flat Updated", "location": "Nagpur"},
        )
    finally:
        app.config["JWT_TOKEN_LOCATION"] = prev_location
        app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf


def _cleanup(app, owner_id, prop_id):
    from extensions import db
    from models.models import Owner, Property, PropertyContact
    with app.app_context():
        PropertyContact.query.filter_by(property_id=prop_id).delete()
        prop = db.session.get(Property, prop_id)
        if prop:
            db.session.delete(prop)
        owner = db.session.get(Owner, owner_id)
        if owner:
            db.session.delete(owner)
        db.session.commit()


def test_edit_approved_property_stays_approved(client, app):
    owner_id, prop_id = _setup(app, "approved")
    try:
        rv = _edit(client, app, prop_id, owner_id)
        assert rv.status_code == 200
        data = rv.get_json()
        assert data["status"] == "approved"
        assert data["re_review"] is False

        from extensions import db
        from models.models import Property
        with app.app_context():
            prop = db.session.get(Property, prop_id)
            assert prop.status == "approved"
            assert prop.is_active is True
            assert prop.title == "Edit Flat Updated"
    finally:
        _cleanup(app, owner_id, prop_id)


def test_edit_rejected_property_goes_pending(client, app):
    owner_id, prop_id = _setup(app, "rejected")
    try:
        rv = _edit(client, app, prop_id, owner_id)
        assert rv.status_code == 200
        data = rv.get_json()
        assert data["status"] == "pending"
        assert data["re_review"] is True

        from extensions import db
        from models.models import Property
        with app.app_context():
            prop = db.session.get(Property, prop_id)
            assert prop.status == "pending"
            assert prop.is_active is False
    finally:
        _cleanup(app, owner_id, prop_id)
