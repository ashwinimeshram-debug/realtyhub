"""DPDP (Digital Personal Data Protection Act) consent helpers.

Records an audit trail whenever a data principal (visitor or owner) explicitly
consents to their personal data being collected for a stated purpose.
"""

import logging

from flask import request

from extensions import db
from models.models import ConsentRecord

logger = logging.getLogger("realtyhub")

# Bump when the consent notice text materially changes.
CONSENT_VERSION = "2026-01"

PURPOSES = {"enquiry", "contact", "registration"}


def _client_ip():
    fwd = request.headers.get("X-Forwarded-For", "")
    if fwd:
        return fwd.split(",")[0].strip()[:45]
    return (request.remote_addr or "")[:45]


def record_consent(purpose, subject_type, email=None, subject_id=None, granted=True):
    """Persist a consent event. Never raises — consent logging must not break a submit."""
    if purpose not in PURPOSES:
        logger.warning("record_consent: unknown purpose %r", purpose)
    try:
        rec = ConsentRecord(
            subject_type=(subject_type or "visitor")[:20],
            subject_id=subject_id,
            email=(email or None) and str(email).strip().lower()[:150],
            purpose=purpose[:50],
            version=CONSENT_VERSION,
            granted=bool(granted),
            ip=_client_ip(),
            user_agent=(request.headers.get("User-Agent") or "")[:255] or None,
        )
        db.session.add(rec)
        db.session.commit()
        return rec.id
    except Exception:  # pragma: no cover - defensive
        db.session.rollback()
        logger.exception("Failed to record consent for purpose=%s", purpose)
        return None


def consent_given():
    """Read the boolean consent flag from a JSON payload."""
    data = request.get_json(silent=True) or {}
    value = data.get("consent")
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "on"}
    return bool(value)
