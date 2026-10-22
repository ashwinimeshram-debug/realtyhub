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
