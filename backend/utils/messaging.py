"""Provider-agnostic outgoing messaging.

Email lives in utils/mailer.py. This module adds WhatsApp via a small provider
abstraction so the deployment can switch between the Meta WhatsApp Cloud API,
Twilio, or a no-op logger without touching call sites.

Configuration is read from the DB settings table (falling back to safe
defaults) exactly like the mailer, so admins can change it at runtime.
"""
import json
import logging
import threading
import urllib.parse
import urllib.request

from flask import current_app

logger = logging.getLogger("realtyhub.messaging")

_WHATSAPP_KEYS = (
    "whatsapp_enabled", "whatsapp_provider", "whatsapp_phone_number_id",
    "whatsapp_access_token", "whatsapp_from", "whatsapp_api_version",
    "twilio_account_sid", "twilio_auth_token", "twilio_whatsapp_from",
)

_WHATSAPP_DEFAULTS = {
    "whatsapp_enabled": "false",
    "whatsapp_provider": "log",  # log | meta | twilio
    "whatsapp_phone_number_id": "",
    "whatsapp_access_token": "",
    "whatsapp_from": "",
    "whatsapp_api_version": "v21.0",
    "twilio_account_sid": "",
    "twilio_auth_token": "",
    "twilio_whatsapp_from": "",
}


def get_whatsapp_settings():
    """Fresh WhatsApp settings from the DB settings table (no caching)."""
    from models.setting_model import Setting
    rows = {s.skey: s.svalue for s in Setting.query.filter(
        Setting.skey.in_(_WHATSAPP_KEYS)).all()}
    out = {}
    for key, default in _WHATSAPP_DEFAULTS.items():
        value = (rows.get(key) or "").strip()
        out[key] = value if value else default
    return out


def normalize_phone(raw, default_cc="91"):
    """Best-effort E.164 normalization (defaults to India +91)."""
    if raw is None:
        return ""
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    if not digits:
        return ""
    if len(digits) == 10:  # local Indian number
        digits = default_cc + digits
    return "+" + digits


class BaseWhatsAppProvider:
    name = "base"

    def send(self, to, message):
        raise NotImplementedError


class LogWhatsAppProvider(BaseWhatsAppProvider):
    name = "log"

    def send(self, to, message):
        logger.info("[WhatsApp disabled/log] To=%s Body=%s", to, message)


class MetaWhatsAppProvider(BaseWhatsAppProvider):
    """Meta WhatsApp Cloud API (graph.facebook.com)."""
    name = "meta"

    def __init__(self, phone_number_id, access_token, api_version="v21.0"):
        self.phone_number_id = phone_number_id
        self.access_token = access_token
        self.api_version = api_version or "v21.0"

    def send(self, to, message):
        url = (
            f"https://graph.facebook.com/{self.api_version}/"
            f"{self.phone_number_id}/messages"
        )
        payload = json.dumps({
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to,
            "type": "text",
            "text": {"preview_url": False, "body": message},
        }).encode("utf-8")
        req = urllib.request.Request(
            url, data=payload, method="POST",
            headers={
                "Authorization": f"Bearer {self.access_token}",
                "Content-Type": "application/json",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status


class TwilioWhatsAppProvider(BaseWhatsAppProvider):
    """Twilio Programmable Messaging for WhatsApp."""
    name = "twilio"

    def __init__(self, account_sid, auth_token, from_number):
        self.account_sid = account_sid
        self.auth_token = auth_token
        self.from_number = from_number

    def send(self, to, message):
        import base64
        url = (
            "https://api.twilio.com/2010-04-01/Accounts/"
            f"{self.account_sid}/Messages.json"
        )
        data = urllib.parse.urlencode({
            "From": f"whatsapp:{self.from_number}",
            "To": f"whatsapp:{to}",
            "Body": message,
        }).encode("utf-8")
        auth = base64.b64encode(
            f"{self.account_sid}:{self.auth_token}".encode("utf-8")
        ).decode("ascii")
        req = urllib.request.Request(
            url, data=data, method="POST",
            headers={
                "Authorization": f"Basic {auth}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status


def _build_provider(settings):
    provider = (settings.get("whatsapp_provider") or "log").lower()
    if provider == "meta" and settings.get("whatsapp_phone_number_id") and settings.get("whatsapp_access_token"):
        return MetaWhatsAppProvider(
            settings["whatsapp_phone_number_id"],
            settings["whatsapp_access_token"],
            settings.get("whatsapp_api_version"),
        )
    if provider == "twilio" and settings.get("twilio_account_sid") and settings.get("twilio_auth_token"):
        return TwilioWhatsAppProvider(
            settings["twilio_account_sid"],
            settings["twilio_auth_token"],
            settings.get("twilio_whatsapp_from") or settings.get("whatsapp_from"),
        )
    return LogWhatsAppProvider()


def send_whatsapp(to, message):
    """Send a WhatsApp text message. Returns True when dispatched."""
    settings = get_whatsapp_settings()
    enabled = settings.get("whatsapp_enabled", "false").lower() in ("1", "true", "yes", "on")
    recipient = normalize_phone(to)
    if not recipient:
        logger.info("WhatsApp skipped: no recipient")
        return False
    if not enabled:
        logger.info("[WhatsApp disabled] To=%s Body=%s", recipient, message)
        return False
    provider = _build_provider(settings)
    try:
        provider.send(recipient, message)
        logger.info("WhatsApp sent via %s To=%s", provider.name, recipient)
        return True
    except Exception as exc:
        logger.error("WhatsApp failed via %s To=%s Error=%s", provider.name, recipient, exc)
        return False


def send_whatsapp_async(to, message):
    """Fire-and-forget WhatsApp send. Never blocks the calling request."""
    if not to:
        return
    app = current_app._get_current_object()

    def _run():
        with app.app_context():
            try:
                send_whatsapp(to, message)
            except Exception as exc:  # pragma: no cover - defensive
                logger.error("WhatsApp async error To=%s Error=%s", to, exc)

    threading.Thread(target=_run, daemon=True).start()


def notify(to_email=None, email_subject=None, email_html=None,
           to_phone=None, whatsapp_message=None):
    """Send a notification over every provided channel (best effort)."""
    if to_email and email_subject and email_html:
        from utils.mailer import send_email_async
        send_email_async(email_subject, [to_email], email_html)
    if to_phone and whatsapp_message:
        send_whatsapp_async(to_phone, whatsapp_message)
