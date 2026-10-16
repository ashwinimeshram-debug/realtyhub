"""Provider-agnostic payment abstraction (mirrors utils/messaging.py).

No gateway SDK is required to boot: with no keys configured the factory
returns a Mock provider so checkout and the lifecycle work end-to-end in
development. Adding real keys (settings table or env) switches the factory
to Razorpay (or Stripe) without touching any call site.

Provider selection is read from the settings table (falling back to env /
safe defaults):
    payment_provider        mock | razorpay | stripe
    payment_key_id          public key (Razorpay key_id)
    payment_key_secret      secret key
    payment_webhook_secret  webhook signing secret
"""
import hashlib
import hmac
import logging
import os
import urllib.parse
import urllib.request
import uuid
from flask import current_app

logger = logging.getLogger("realtyhub.payments")

_PAYMENT_KEYS = (
    "payment_provider", "payment_key_id", "payment_key_secret",
    "payment_webhook_secret", "payment_currency",
)

_PAYMENT_DEFAULTS = {
    "payment_provider": "mock",
    "payment_key_id": "",
    "payment_key_secret": "",
    "payment_webhook_secret": "",
    "payment_currency": "INR",
}


class PaymentConfigurationError(Exception):
    """Raised when a real provider is selected but not fully configured."""


def get_payment_settings():
    """Fresh payment settings from the DB, falling back to env then defaults."""
    from models.setting_model import Setting
    try:
        rows = {s.skey: s.svalue for s in Setting.query.filter(
            Setting.skey.in_(_PAYMENT_KEYS)).all()}
    except Exception:  # pragma: no cover - DB not ready
        rows = {}
    out = {}
    for key, default in _PAYMENT_DEFAULTS.items():
        value = (rows.get(key) or "").strip()
        if not value:
            value = (os.getenv(key.upper()) or os.getenv(
                {"payment_key_id": "RAZORPAY_KEY_ID",
                 "payment_key_secret": "RAZORPAY_KEY_SECRET",
                 "payment_webhook_secret": "RAZORPAY_WEBHOOK_SECRET",
                 "payment_provider": "PAYMENT_PROVIDER",
                 "payment_currency": "PAYMENT_CURRENCY"}.get(key, key.upper())) or "").strip()
        out[key] = value if value else default
    return out


def amount_to_minor(amount_rupees):
    """Rupees -> minor units (paise) for the gateway, rounded."""
    try:
        return int(round(float(amount_rupees) * 100))
    except (TypeError, ValueError):
        return 0


class BasePaymentProvider:
    name = "base"

    def create_order(self, amount, currency, receipt, notes=None):
        """Return {order_id, amount (minor), currency, public_key}. Raise on failure."""
        raise NotImplementedError

    def verify_webhook(self, raw_body, signature, event_payload=None):
        """Return True when the incoming webhook is authentic."""
        raise NotImplementedError

    @property
    def configured(self):
        return True

    @property
    def uses_client_js(self):
        """True when the frontend needs to load a checkout script."""
        return False

    @property
    def public_key(self):
        return ""


class MockPaymentProvider(BasePaymentProvider):
    """Development stand-in: no network, always authentic, instant success."""

    name = "mock"

    def create_order(self, amount, currency, receipt, notes=None):
        return {
            "order_id": f"mock_{uuid.uuid4().hex}",
            "amount": amount_to_minor(amount),
            "currency": currency,
            "public_key": "",
            "provider": self.name,
        }

    def verify_webhook(self, raw_body, signature, event_payload=None):
        return True

    @property
    def uses_client_js(self):
        return False


class RazorpayPaymentProvider(BasePaymentProvider):
    """Razorpay (key_id/key_secret). Requires the `razorpay` package."""

    name = "razorpay"

    def __init__(self, key_id, key_secret, webhook_secret=""):
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret

    @property
    def public_key(self):
        return self.key_id

    @property
    def configured(self):
        return bool(self.key_id and self.key_secret)

    @property
    def uses_client_js(self):
        return True

    def _client(self):
        try:
            import razorpay  # lazy: only needed when actually paying
        except ImportError as exc:  # pragma: no cover - env dependent
            raise PaymentConfigurationError(
                "The razorpay package is not installed. Run: pip install razorpay"
            ) from exc
        return razorpay.Client(auth=(self.key_id, self.key_secret))

    def create_order(self, amount, currency, receipt, notes=None):
        client = self._client()
        resp = client.order.create({
            "amount": amount_to_minor(amount),
            "currency": currency,
            "receipt": receipt,
            "notes": notes or {},
        })
        return {
            "order_id": resp["id"],
            "amount": resp.get("amount", amount_to_minor(amount)),
            "currency": resp.get("currency", currency),
            "public_key": self.key_id,
            "provider": self.name,
        }

    def verify_webhook(self, raw_body, signature, event_payload=None):
        secret = self.webhook_secret
        if not secret:
            logger.warning("Razorpay webhook received but no webhook secret configured")
            return False
        if isinstance(raw_body, str):
            raw_body = raw_body.encode("utf-8")
        expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature or "")


class StripePaymentProvider(BasePaymentProvider):
    """Stripe (publishable/secret). Requires the `stripe` package."""

    name = "stripe"

    def __init__(self, public_key, secret_key, webhook_secret=""):
        self.public_key = public_key
        self.secret_key = secret_key
        self.webhook_secret = webhook_secret

    @property
    def configured(self):
        return bool(self.public_key and self.secret_key)

    @property
    def uses_client_js(self):
        return True

    def create_order(self, amount, currency, receipt, notes=None):
        try:
            import stripe  # lazy
        except ImportError as exc:  # pragma: no cover - env dependent
            raise PaymentConfigurationError(
                "The stripe package is not installed. Run: pip install stripe"
            ) from exc
        stripe.api_key = self.secret_key
        intent = stripe.PaymentIntent.create(
            amount=amount_to_minor(amount),
            currency=currency.lower(),
            receipt=receipt,
            metadata=notes or {},
        )
        return {
            "order_id": intent["id"],
            "amount": intent["amount"],
            "currency": intent["currency"].upper(),
            "public_key": self.public_key,
            "provider": self.name,
        }

    def verify_webhook(self, raw_body, signature, event_payload=None):
        secret = self.webhook_secret
        if not secret:
            return False
        try:
            import stripe  # lazy
        except ImportError:  # pragma: no cover
            return False
        try:
            stripe.Webhook.construct_event(raw_body, signature, secret)
            return True
        except Exception as exc:
            logger.warning("Stripe webhook signature invalid: %s", exc)
            return False


def _build_provider(settings):
    name = (settings.get("payment_provider") or "mock").lower()
    if name == "razorpay":
        provider = RazorpayPaymentProvider(
            settings.get("payment_key_id", ""),
            settings.get("payment_key_secret", ""),
            settings.get("payment_webhook_secret", ""),
        )
        if provider.configured:
            return provider
        logger.info("Razorpay selected but keys missing -> falling back to mock")
        return MockPaymentProvider()
    if name == "stripe":
        provider = StripePaymentProvider(
            settings.get("payment_key_id", ""),
            settings.get("payment_key_secret", ""),
            settings.get("payment_webhook_secret", ""),
        )
        if provider.configured:
            return provider
        logger.info("Stripe selected but keys missing -> falling back to mock")
        return MockPaymentProvider()
    return MockPaymentProvider()


def get_payment_provider():
    return _build_provider(get_payment_settings())


def is_payment_configured():
    """True when a real (non-mock) provider is selected and has keys."""
    settings = get_payment_settings()
    name = (settings.get("payment_provider") or "mock").lower()
    if name == "mock":
        return False
    return bool(settings.get("payment_key_id") and settings.get("payment_key_secret"))


def active_provider_name():
    """The provider that will actually serve a request (after fallback)."""
    return get_payment_provider().name
