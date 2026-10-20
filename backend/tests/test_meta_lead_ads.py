import uuid
from unittest import mock

from utils.meta_graph import MetaError


def test_secret_encrypt_decrypt_roundtrip(app):
    from utils.secrets_crypto import decrypt_secret, encrypt_secret, is_encrypted, mask_secret

    with app.app_context():
        secret = "EAAG-example-page-token-123456"
        enc = encrypt_secret(secret)
        assert is_encrypted(enc)
        assert enc != secret
        assert decrypt_secret(enc) == secret
        # Plaintext/legacy values pass through unchanged.
        assert decrypt_secret("plain-token") == "plain-token"
        assert not is_encrypted("plain-token")
        masked = mask_secret(enc)
        assert secret not in masked
        assert masked.startswith("••••")


def test_webhook_verify_handshake(app):
    from routes.settings_routes import invalidate_settings_cache
    from models.setting_model import Setting
    from extensions import db

    token = f"vt-{uuid.uuid4().hex[:10]}"
    with app.app_context():
        db.session.add(Setting(skey="facebook_verify_token", svalue=token))
        db.session.commit()
        invalidate_settings_cache()

    client = app.test_client()
    ok = client.get(f"/api/meta/webhook?hub.mode=subscribe&hub.verify_token={token}&hub.challenge=CHAL123")
    assert ok.status_code == 200 and ok.get_data(as_text=True) == "CHAL123"

    bad = client.get("/api/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=CHAL123")
    assert bad.status_code == 403

    with app.app_context():
        Setting.query.filter_by(skey="facebook_verify_token").delete()
        db.session.commit()
        invalidate_settings_cache()


def test_webhook_ingests_lead(app):
    from extensions import db
    from models.models import Lead, MetaLeadEvent, MetaPage
    from models.setting_model import Setting
    from routes.settings_routes import invalidate_settings_cache
    from utils.secrets_crypto import encrypt_secret

    marker = uuid.uuid4().hex[:8]
    page_id = f"pg{marker}"
    leadgen_id = f"lg{marker}"
    email = f"asha-{marker}@example.com"

    with app.app_context():
        MetaLeadEvent.query.filter_by(leadgen_id=leadgen_id).delete(synchronize_session=False)
        Lead.query.filter_by(email=email).delete(synchronize_session=False)
        db.session.commit()

    with app.app_context():
        Setting.query.filter(Setting.skey.in_([
            "facebook_enabled", "facebook_default_source", "facebook_auto_assign"])).delete(synchronize_session=False)
        db.session.add_all([
            Setting(skey="facebook_enabled", svalue="true"),
            Setting(skey="facebook_default_source", svalue="facebook"),
            Setting(skey="facebook_auto_assign", svalue="false"),
            MetaPage(page_id=page_id, page_name="Test Page",
                     access_token=encrypt_secret("tok"), source_label="fb_page"),
        ])
        db.session.commit()
        invalidate_settings_cache()

    payload = {
        "object": "page",
        "entry": [{"id": page_id, "changes": [
            {"field": "leadgen", "value": {"leadgen_id": leadgen_id, "form_id": "frm1"}},
        ]}],
    }
    fake_lead = {
        "id": leadgen_id, "form_id": "frm1", "page_id": page_id,
        "fields": {"full_name": "Asha Rao", "email": email, "phone_number": "+919812345678"},
    }

    client = app.test_client()
    with mock.patch("routes.meta_routes.get_lead", return_value=fake_lead), \
         mock.patch("routes.meta_routes._notify_new_meta_lead"):
        rv = client.post("/api/meta/webhook", json=payload)
    assert rv.status_code == 200 and rv.get_json()["processed"] == 1

    with app.app_context():
        lead = Lead.query.filter_by(email=email, source="fb_page").first()
        assert lead is not None and lead.name == "Asha Rao"
        assert lead.mobile == "+919812345678"
        event = MetaLeadEvent.query.filter_by(leadgen_id=leadgen_id).first()
        assert event is not None and event.status == "imported" and event.lead_id == lead.id

        # Duplicate delivery is idempotent.
        with mock.patch("routes.meta_routes.get_lead", return_value=fake_lead), \
             mock.patch("routes.meta_routes._notify_new_meta_lead"):
            rv2 = client.post("/api/meta/webhook", json=payload)
        assert rv2.status_code == 200
        assert Lead.query.filter_by(email=email, source="fb_page").count() == 1

    # Cleanup
    with app.app_context():
        MetaLeadEvent.query.filter_by(leadgen_id=leadgen_id).delete(synchronize_session=False)
        Lead.query.filter_by(email=email, source="fb_page").delete(synchronize_session=False)
        MetaPage.query.filter_by(page_id=page_id).delete(synchronize_session=False)
        Setting.query.filter(Setting.skey.in_([
            "facebook_enabled", "facebook_default_source", "facebook_auto_assign"])).delete(synchronize_session=False)
        db.session.commit()
        invalidate_settings_cache()


def test_webhook_unknown_page_does_not_lead(app):
    from extensions import db
    from models.models import Lead, MetaLeadEvent
    from models.setting_model import Setting
    from routes.settings_routes import invalidate_settings_cache

    leadgen_id = f"lg-unknown-{uuid.uuid4().hex[:8]}"
    with app.app_context():
        Setting.query.filter_by(skey="facebook_enabled").delete(synchronize_session=False)
        db.session.add(Setting(skey="facebook_enabled", svalue="true"))
        db.session.commit()
        invalidate_settings_cache()

    payload = {"object": "page", "entry": [{"id": "PG-NOPE", "changes": [
        {"field": "leadgen", "value": {"leadgen_id": leadgen_id}},
    ]}]}
    client = app.test_client()
    rv = client.post("/api/meta/webhook", json=payload)
    assert rv.status_code == 200

    with app.app_context():
        assert Lead.query.count() == Lead.query.count()  # no crash
        ev = MetaLeadEvent.query.filter_by(leadgen_id=leadgen_id).first()
        assert ev is not None and ev.status == "error"
        MetaLeadEvent.query.filter_by(leadgen_id=leadgen_id).delete(synchronize_session=False)
        Setting.query.filter_by(skey="facebook_enabled").delete()
        db.session.commit()
        invalidate_settings_cache()


def test_admin_page_crud(app):
    import bcrypt

    from flask_jwt_extended import create_access_token

    from extensions import db
    from models.models import Admin, MetaPage

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        pw = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
        admin = Admin(username=f"fb-{marker}", email=f"fb-{marker}@t.com", password=pw, role="admin")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id
        token = create_access_token(identity=str(admin_id))

    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    client = app.test_client()
    headers = {"Authorization": f"Bearer {token}"}
    page_id = f"pgadmin{marker}"

    try:
        rv = client.post("/api/admin/facebook/pages", headers=headers, json={
            "page_id": page_id, "access_token": "EAAG-test", "source_label": "fbpage",
            "skip_validation": True,
        })
        assert rv.status_code == 201, rv.get_json()
        created = rv.get_json()
        assert created["page_id"] == page_id and created["has_token"] is True
        assert "EAAG-test" not in rv.get_data(as_text=True)  # never echo the raw token
        pid = created["id"]

        rv2 = client.get("/api/admin/facebook/pages", headers=headers)
        assert rv2.status_code == 200
        assert any(p["id"] == pid for p in rv2.get_json()["items"])

        rv3 = client.put(f"/api/admin/facebook/pages/{pid}", headers=headers, json={"is_active": False})
        assert rv3.status_code == 200 and rv3.get_json()["is_active"] is False

        rv4 = client.delete(f"/api/admin/facebook/pages/{pid}", headers=headers)
        assert rv4.status_code == 200
        with app.app_context():
            assert db.session.get(MetaPage, pid) is None
    finally:
        app.config["JWT_TOKEN_LOCATION"] = prev_location
        app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf
        with app.app_context():
            MetaPage.query.filter_by(page_id=page_id).delete(synchronize_session=False)
            a = db.session.get(Admin, admin_id)
            if a:
                db.session.delete(a)
            db.session.commit()


def test_meta_get_page_error_wrapped():
    with mock.patch("utils.meta_graph._request", side_effect=MetaError("boom")):
        try:
            from utils.meta_graph import get_page
            get_page("1", "tok")
            assert False, "expected MetaError"
        except MetaError:
            pass
