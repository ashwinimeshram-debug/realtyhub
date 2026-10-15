from utils.messaging import (
    LogWhatsAppProvider,
    MetaWhatsAppProvider,
    TwilioWhatsAppProvider,
    _build_provider,
    normalize_phone,
)


def test_normalize_phone_local():
    assert normalize_phone("9876543210") == "+919876543210"


def test_normalize_phone_with_country_code():
    assert normalize_phone("+91 98765 43210") == "+919876543210"
    assert normalize_phone("919876543210") == "+919876543210"


def test_normalize_phone_empty():
    assert normalize_phone(None) == ""
    assert normalize_phone("abc") == ""


def test_build_provider_defaults_to_log():
    assert isinstance(_build_provider({"whatsapp_provider": "log"}), LogWhatsAppProvider)


def test_build_provider_meta_requires_credentials():
    assert isinstance(_build_provider({"whatsapp_provider": "meta"}), LogWhatsAppProvider)
    provider = _build_provider({
        "whatsapp_provider": "meta",
        "whatsapp_phone_number_id": "123",
        "whatsapp_access_token": "tok",
        "whatsapp_api_version": "v21.0",
    })
    assert isinstance(provider, MetaWhatsAppProvider)


def test_build_provider_twilio_requires_credentials():
    provider = _build_provider({
        "whatsapp_provider": "twilio",
        "twilio_account_sid": "AC123",
        "twilio_auth_token": "tok",
        "twilio_whatsapp_from": "+14155238886",
    })
    assert isinstance(provider, TwilioWhatsAppProvider)
