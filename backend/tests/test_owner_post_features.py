import uuid


def _mint_owner_token(app, owner_id):
    from flask_jwt_extended import create_access_token
    with app.app_context():
        return create_access_token(identity=f"owner:{owner_id}")


def _setup(app):
    from extensions import db
    from models.models import Owner, Property

    def mk(mobile):
        with app.app_context():
            o = Owner(name="Feat Owner", email=f"fo-{uuid.uuid4().hex[:8]}@example.com",
                      mobile=mobile, password="x", is_active=True, is_verified=True)
            db.session.add(o)
            db.session.commit()
            return o.id

    owner_id = mk("9000000099")
    other_id = mk("9000000098")
    with app.app_context():
        prop = Property(title="Feat Flat", property_type="flat", location="Nagpur",
                        transaction_type="sale", status="approved", owner_id=owner_id,
                        is_active=True)
        db.session.add(prop)
        db.session.commit()
        prop_id = prop.id
    return owner_id, other_id, prop_id


def _patch_auth(app):
    prev_loc = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    return prev_loc, prev_csrf


def _restore(app, prev_loc, prev_csrf):
    app.config["JWT_TOKEN_LOCATION"] = prev_loc
    app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf


def _cleanup(app, owner_ids, prop_id):
    from extensions import db
    from models.models import Owner, Property, PropertyContact, PropertyImage, PresetFeature
    with app.app_context():
        PropertyImage.query.filter_by(property_id=prop_id).delete()
        PropertyContact.query.filter_by(property_id=prop_id).delete()
        prop = db.session.get(Property, prop_id)
        if prop:
            db.session.delete(prop)
        for oid in owner_ids:
            o = db.session.get(Owner, oid)
            if o:
                db.session.delete(o)
        PresetFeature.query.filter_by(label="Terrace Garden").delete()
        db.session.commit()


def test_owner_quick_add_feature(client, app):
    owner_id, other_id, prop_id = _setup(app)
    prev_loc, prev_csrf = _patch_auth(app)
    headers = {"Authorization": f"Bearer {_mint_owner_token(app, owner_id)}"}
    try:
        rv = client.post("/api/owner/preset-features", headers=headers, json={"label": "Terrace Garden"})
        assert rv.status_code == 201, rv.get_json()
        data = rv.get_json()
        assert data["label"] == "Terrace Garden"
        assert data["sentence"]

        rv2 = client.post("/api/owner/preset-features", headers=headers, json={"label": "terrace garden"})
        assert rv2.status_code == 200, rv2.get_json()
        assert rv2.get_json()["existing"] is True

        rv3 = client.post("/api/owner/preset-features", headers=headers, json={"label": ""})
        assert rv3.status_code == 400

        rv4 = client.post("/api/owner/preset-features", json={"label": "No Auth"})
        assert rv4.status_code == 401
    finally:
        _restore(app, prev_loc, prev_csrf)
        _cleanup(app, [owner_id, other_id], prop_id)


def test_owner_gallery_and_reorder(client, app):
    owner_id, other_id, prop_id = _setup(app)
    prev_loc, prev_csrf = _patch_auth(app)
    headers = {"Authorization": f"Bearer {_mint_owner_token(app, owner_id)}"}
    other_headers = {"Authorization": f"Bearer {_mint_owner_token(app, other_id)}"}
    try:
        rv = client.post(f"/api/owner/properties/{prop_id}/gallery-images", headers=headers,
                         json={"urls": ["https://img.example.com/a.jpg", "https://img.example.com/b.jpg"]})
        assert rv.status_code == 201, rv.get_json()

        rv = client.post(f"/api/owner/properties/{prop_id}/gallery-images", headers=headers, json={"urls": []})
        assert rv.status_code == 400

        rv = client.post(f"/api/owner/properties/{prop_id}/gallery-images", headers=other_headers,
                         json={"urls": ["https://img.example.com/x.jpg"]})
        assert rv.status_code == 404

        detail = client.get(f"/api/owner/properties/{prop_id}", headers=headers).get_json()
        imgs = detail["images"]
        assert len(imgs) == 2

        payload = [{"id": imgs[0]["id"], "order": 5}, {"id": imgs[1]["id"], "order": 1}]
        rv = client.post(f"/api/owner/properties/{prop_id}/reorder-images", headers=headers, json=payload)
        assert rv.status_code == 200, rv.get_json()

        rv = client.post(f"/api/owner/properties/{prop_id}/reorder-images", headers=headers, json={"bad": 1})
        assert rv.status_code == 400
    finally:
        _restore(app, prev_loc, prev_csrf)
        _cleanup(app, [owner_id, other_id], prop_id)
