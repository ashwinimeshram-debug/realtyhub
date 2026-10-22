from datetime import datetime, timedelta

import pytest


def _mint_owner_token(app, owner_id):
    from flask_jwt_extended import create_access_token
    with app.app_context():
        return create_access_token(identity=f"owner:{owner_id}")


def _make_property(title="DPDP Test Flat"):
    from extensions import db
    from models.models import Property
    prop = Property(
        title=title, property_type="flat", location="Nagpur, Nagpur",
        transaction_type="sale", status="approved", is_active=True, price=2500000,
    )
    db.session.add(prop)
    db.session.commit()
    return prop.id


def test_contact_requires_consent(client):
    rv = client.post("/api/contact", json={
        "name": "Test", "email": "t@example.com", "phone": "9876543210",
        "message": "Hello there",
    })
    assert rv.status_code == 400
    assert "privacy" in rv.get_json()["error"].lower()


def test_contact_records_consent(client):
    from extensions import db
    from models.contactus import Contactus
    from models.models import ConsentRecord

    rv = client.post("/api/contact", json={
        "name": "Test", "email": "consent@example.com", "phone": "9876543210",
        "message": "Hello there", "consent": True,
    })
    assert rv.status_code == 201

    with client.application.app_context():
        row = ConsentRecord.query.filter_by(email="consent@example.com", purpose="contact").first()
        assert row is not None
        assert row.granted is True
        assert row.version
        # cleanup
        Contactus.query.filter_by(email="consent@example.com").delete()
        db.session.delete(row)
        db.session.commit()


def test_property_contact_requires_consent(client, app):
    with app.app_context():
        prop_id = _make_property("Consent Flat")
    try:
        rv = client.post(f"/api/property/{prop_id}/contact", json={
            "name": "Buyer", "mobile": "9876500000", "email": "b@example.com",
        })
        assert rv.status_code == 400
    finally:
        from extensions import db
        from models.models import Property
        with app.app_context():
            db.session.delete(db.session.get(Property, prop_id))
            db.session.commit()


def test_register_requires_consent(client):
    rv = client.post("/api/owner/register", json={
        "name": "Owner One", "email": "owner-consent@example.com",
        "mobile": "9876511111", "password": "supersecret1",
    })
    assert rv.status_code == 400
    assert "privacy" in rv.get_json()["error"].lower()


def test_register_records_consent(client):
    from extensions import db
    from models.models import Owner, ConsentRecord

    rv = client.post("/api/owner/register", json={
        "name": "Owner Two", "email": "owner-consent2@example.com",
        "mobile": "9876522222", "password": "supersecret1", "consent": True,
    })
    assert rv.status_code == 201

    with client.application.app_context():
        owner = Owner.query.filter_by(email="owner-consent2@example.com").first()
        assert owner is not None
        rec = ConsentRecord.query.filter_by(subject_type="owner", subject_id=owner.id).first()
        assert rec is not None and rec.purpose == "registration"
        # cleanup
        ConsentRecord.query.filter_by(subject_type="owner", subject_id=owner.id).delete()
        db.session.delete(owner)
        db.session.commit()


def test_retention_cleanup(client, app):
    from extensions import db
    from models.contactus import Contactus
    from models.models import ConsentRecord, Lead, PropertyContact, Property
    from models.setting_model import Setting
    from routes.settings_routes import invalidate_settings_cache

    old = datetime.utcnow() - timedelta(days=400)
    with app.app_context():
        prop_id = _make_property("Retention Flat")
        db.session.add(PropertyContact(
            property_id=prop_id, type="visitor", name="Old Visitor",
            email="old@example.com", mobile="9000000000", created_at=old,
        ))
        db.session.add(Contactus(
            name="Old Msg", email="oldmsg@example.com", phone="9000000001",
            message="old", created_at=old,
        ))
        lead = Lead(name="Old Lead", email="oldlead@example.com", mobile="9000000002",
                    property_id=prop_id, created_at=old)
        db.session.add(lead)
        db.session.add(ConsentRecord(
            subject_type="visitor", email="oldc@example.com", purpose="contact",
            version="2026-01", created_at=old,
        ))
        existing = Setting.query.filter_by(skey="data_retention_days").first()
        if existing:
            existing.svalue = "365"
        else:
            db.session.add(Setting(skey="data_retention_days", svalue="365"))
        db.session.commit()
        lead_id = lead.id
        invalidate_settings_cache()

        app.config["CRON_KEY"] = "test-key"
        rv = client.post("/api/cron/retention/cleanup", headers={"X-Cron-Key": "test-key"})
        assert rv.status_code == 200
        data = rv.get_json()
        assert data["property_contacts_deleted"] >= 1
        assert data["contact_messages_deleted"] >= 1
        assert data["leads_anonymized"] >= 1
        assert data["consent_records_deleted"] >= 1

        refreshed = db.session.get(Lead, lead_id)
        assert refreshed.name == "Redacted"
        assert refreshed.email is None and refreshed.mobile is None

        # cleanup
        db.session.delete(refreshed)
        db.session.delete(db.session.get(Property, prop_id))
        Setting.query.filter_by(skey="data_retention_days").delete()
        db.session.commit()
        invalidate_settings_cache()


def test_owner_data_export_csv_zip(client, app):
    import csv
    import io
    import uuid
    import zipfile

    from extensions import db
    from models.models import Owner, Property

    email = f"csv-owner-{uuid.uuid4().hex[:8]}@example.com"
    with app.app_context():
        owner = Owner(
            name="CSV Owner", email=email, mobile="9000000011",
            password="x", is_active=True, is_verified=True,
        )
        db.session.add(owner)
        db.session.commit()
        owner_id = owner.id
        prop = Property(
            title="CSV Flat", property_type="flat", location="Nagpur",
            transaction_type="sale", status="approved", owner_id=owner_id,
        )
        db.session.add(prop)
        db.session.commit()
        prop_id = prop.id

    token = _mint_owner_token(app, owner_id)
    headers = {"Authorization": f"Bearer {token}"}
    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    try:
        rv = client.get("/api/owner/data-export?format=csv", headers=headers)
        assert rv.status_code == 200
        assert rv.mimetype == "application/zip"

        with zipfile.ZipFile(io.BytesIO(rv.data)) as zf:
            names = set(zf.namelist())
            assert names == {"account.csv", "properties.csv", "leads.csv",
                             "saved_searches.csv", "consents.csv"}
            account = list(csv.DictReader(
                io.StringIO(zf.read("account.csv").decode("utf-8-sig"))))
            properties = list(csv.DictReader(
                io.StringIO(zf.read("properties.csv").decode("utf-8-sig"))))
    finally:
        app.config["JWT_TOKEN_LOCATION"] = prev_location
        app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf

    assert account[0]["email"] == email
    assert len(properties) == 1
    assert properties[0]["title"] == "CSV Flat"

    with app.app_context():
        db.session.delete(db.session.get(Property, prop_id))
        db.session.delete(db.session.get(Owner, owner_id))
        db.session.commit()


def test_owner_data_export_and_delete(client, app):
    import uuid

    from extensions import db
    from models.models import Lead, Owner, Property, SavedSearch

    email = f"export-owner-{uuid.uuid4().hex[:8]}@example.com"
    with app.app_context():
        owner = Owner(
            name="Export Owner", email=email,
            mobile="9000000099", password="x",
            is_active=True, is_verified=True,
        )
        db.session.add(owner)
        db.session.commit()
        owner_id = owner.id

        prop = Property(
            title="Export Flat", property_type="flat", location="Nagpur",
            transaction_type="sale", status="approved", owner_id=owner_id,
        )
        db.session.add(prop)
        db.session.commit()
        prop_id = prop.id
        db.session.add(Lead(name="Buyer X", email="bx@example.com", mobile="9000000088",
                            property_id=prop_id))
        db.session.commit()

    token = _mint_owner_token(app, owner_id)
    headers = {"Authorization": f"Bearer {token}"}

    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    try:
        rv = client.get("/api/owner/data-export", headers=headers)
        assert rv.status_code == 200
        data = rv.get_json()
        assert data["account"]["email"] == email
        assert len(data["properties"]) == 1
        assert len(data["leads"]) == 1

        rv2 = client.post("/api/owner/delete-account", headers=headers)
        assert rv2.status_code == 200
    finally:
        app.config["JWT_TOKEN_LOCATION"] = prev_location
        app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf

    with app.app_context():
        owner = db.session.get(Owner, owner_id)
        assert owner.is_active is False
        assert owner.name == "Deleted user"
        assert owner.email.startswith("deleted+")
        lead = Lead.query.filter_by(property_id=prop_id).first()
        assert lead.name == "Redacted"
        assert lead.email is None

        # cleanup
        db.session.delete(lead)
        prop = db.session.get(Property, prop_id)
        if prop:
            db.session.delete(prop)
        SavedSearch.query.filter_by(owner_id=owner_id).delete()
        db.session.delete(owner)
        db.session.commit()
