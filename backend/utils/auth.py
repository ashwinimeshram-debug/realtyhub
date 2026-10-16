"""JWT revocation helpers (token blocklist)."""

import logging

from flask_jwt_extended import get_jwt

from extensions import db
from models.models import TokenBlocklist

logger = logging.getLogger("realtyhub")


def revoke_token(jti, token_type="access"):
    """Add the given jti to the blocklist. Never raises."""
    if not jti:
        return False
    try:
        if TokenBlocklist.query.filter_by(jti=jti).first():
            return True
        db.session.add(TokenBlocklist(jti=jti, token_type=token_type))
        db.session.commit()
        return True
    except Exception:  # pragma: no cover - defensive
        db.session.rollback()
        logger.exception("Failed to revoke token")
        return False


def revoke_current_token(token_type="access"):
    """Add the current JWT's jti to the blocklist. Never raises."""
    try:
        return revoke_token(get_jwt().get("jti"), token_type=token_type)
    except Exception:  # pragma: no cover - defensive
        logger.exception("Failed to revoke token")
        return False


def is_token_revoked(jti):
    """Return True when the given jti has been revoked."""
    if not jti:
        return False
    try:
        return TokenBlocklist.query.filter_by(jti=jti).first() is not None
    except Exception:  # pragma: no cover - defensive
        logger.exception("Blocklist lookup failed")
        return False
