"""JWT revocation helpers (token blocklist)."""

import logging
import threading
import time

from flask_jwt_extended import get_jwt

from extensions import db
from models.models import TokenBlocklist

logger = logging.getLogger("realtyhub")

# The blocklist is consulted on every authenticated request. On shared hosting
# the database connection budget is tiny, so short-lived positive/negative
# caching in-process keeps the request rate low. Revocations therefore take
# effect within the cache window (a few seconds), which is acceptable.
_BLOCKLIST_CACHE_TTL = 5.0
_blocklist_cache: dict = {}
_blocklist_lock = threading.Lock()


def _invalidate_blocklist_cache(jti=None):
    with _blocklist_lock:
        if jti is None:
            _blocklist_cache.clear()
        else:
            _blocklist_cache.pop(jti, None)


def revoke_token(jti, token_type="access"):
    """Add the given jti to the blocklist. Never raises."""
    if not jti:
        return False
    try:
        if TokenBlocklist.query.filter_by(jti=jti).first():
            return True
        db.session.add(TokenBlocklist(jti=jti, token_type=token_type))
        db.session.commit()
        _invalidate_blocklist_cache(jti)
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

    now = time.time()
    with _blocklist_lock:
        cached = _blocklist_cache.get(jti)
        if cached is not None and cached[0] > now:
            return cached[1]

    try:
        revoked = TokenBlocklist.query.filter_by(jti=jti).first() is not None
    except Exception:  # pragma: no cover - defensive
        logger.exception("Blocklist lookup failed")
        return False

    with _blocklist_lock:
        if len(_blocklist_cache) > 1000:
            _blocklist_cache.clear()
        _blocklist_cache[jti] = (now + _BLOCKLIST_CACHE_TTL, revoked)
    return revoked
