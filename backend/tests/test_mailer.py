"""Tests for the DB-backed mailer: SSL config, enable gate, dispatch."""

from utils import mailer
from utils.mailer import send_email_async
from models.setting_model import Setting
from extensions import db


def _set(app, key, value):
    with app.app_context():
        row = Setting.query.filter_by(skey=key).first()
        if row:
            row.svalue = value
        else:
            db.session.add(Setting(skey=key, svalue=value))
        db.session.commit()


def test_configure_mail_uses_ssl_for_port_465(app):
    opts = {
        "mail_server": "mail.plotandroof.com",
        "mail_port": "465",
        "mail_username": "info@plotandroof.com",
        "mail_password": "secret",
        "mail_sender": "info@plotandroof.com",
        "mail_use_tls": "false",
        "mail_use_ssl": "true",
    }
    with app.app_context():
        mailer._configure_mail(app, opts)
        assert app.config["MAIL_SERVER"] == "mail.plotandroof.com"
        assert app.config["MAIL_PORT"] == 465
        assert app.config["MAIL_USE_SSL"] is True
        assert app.config["MAIL_USE_TLS"] is False
        assert app.config["MAIL_USERNAME"] == "info@plotandroof.com"


def test_configure_mail_starttls_for_port_587(app):
    opts = {
        "mail_server": "smtp.example.com",
        "mail_port": "587",
        "mail_username": "u@example.com",
        "mail_password": "p",
        "mail_sender": "u@example.com",
        "mail_use_tls": "true",
        "mail_use_ssl": "false",
    }
    with app.app_context():
        mailer._configure_mail(app, opts)
        assert app.config["MAIL_PORT"] == 587
        assert app.config["MAIL_USE_SSL"] is False
        assert app.config["MAIL_USE_TLS"] is True


def test_send_email_dispatches_when_enabled(app, monkeypatch):
    _set(app, "mail_enabled", "true")
    _set(app, "mail_server", "mail.plotandroof.com")
    _set(app, "mail_port", "465")
    _set(app, "mail_use_ssl", "true")
    _set(app, "mail_username", "info@plotandroof.com")
    _set(app, "mail_password", "secret")
    _set(app, "mail_sender", "info@plotandroof.com")

    sent = {}

    def fake_send(msg):
        sent["subject"] = msg.subject
        sent["recipients"] = list(msg.recipients)

    monkeypatch.setattr(mailer.mail, "send", fake_send)

    with app.app_context():
        send_email_async("Test Subject", ["user@example.com"], "<p>hi</p>", block=True)

    assert sent.get("subject") == "Test Subject"
    assert sent.get("recipients") == ["user@example.com"]


def test_send_email_skipped_when_disabled(app, monkeypatch):
    _set(app, "mail_enabled", "false")

    called = {"n": 0}

    def fake_send(msg):
        called["n"] += 1

    monkeypatch.setattr(mailer.mail, "send", fake_send)

    with app.app_context():
        send_email_async("Test Subject", ["user@example.com"], "<p>hi</p>", block=True)

    assert called["n"] == 0


def test_owner_register_sends_verification_email(app, monkeypatch):
    """End-to-end: POST /api/owner/register must dispatch a verification email."""
    import uuid
    from extensions import db
    from models.models import Owner

    _set(app, "mail_enabled", "true")
    _set(app, "mail_server", "mail.plotandroof.com")
    _set(app, "mail_port", "465")
    _set(app, "mail_use_ssl", "true")
    _set(app, "mail_username", "info@plotandroof.com")
    _set(app, "mail_password", "secret")
    _set(app, "mail_sender", "info@plotandroof.com")

    sent = {}
    monkeypatch.setattr(mailer.mail, "send",
                        lambda msg: sent.update(subject=msg.subject, recipients=list(msg.recipients),
                                                has_link="verify-email/" in (msg.html or "")))

    email = f"reg-{uuid.uuid4().hex[:8]}@example.com"
    payload = {"name": "Reg Tester", "email": email, "mobile": "9876500123",
               "password": "Secret123!", "consent": True}
    client = app.test_client()
    resp = client.post("/api/owner/register", json=payload)
    assert resp.status_code == 201, resp.get_data(as_text=True)

    assert sent.get("recipients") == [email], sent
    assert sent.get("has_link") is True, sent

    with app.app_context():
        owner = Owner.query.filter_by(email=email).first()
        if owner:
            db.session.delete(owner)
            db.session.commit()

