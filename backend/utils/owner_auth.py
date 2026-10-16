"""Isolated session handling for the owner portal.

Admin and owner sessions used to share the single flask-jwt-extended
``access_token_cookie``. Because the admin panel signs users in/out against
that same cookie (and force-logs-out whenever an admin check-auth fails), a
signed-in owner could be silently clobbered:

* logging into ``/admin`` replaced the owner token with a numeric admin token,
  so owner-only endpoints returned "Owner login required"; and
* opening ``/admin`` with an owner token triggered ``/admin/logout``, which
  cleared the cookie the owner was still relying on.

Owner sessions therefore live in their own cookies, verified here, while the
flask-jwt-extended default cookie stays reserved for admin sessions. The two
can now coexist without interfering.
"""

import secrets

from flask import current_app, request
from flask_jwt_extended import create_access_token, decode_token

from utils.auth import is_token_revoked

OWNER_ACCESS_COOKIE = "owner_access_token"
OWNER_CSRF_COOKIE = "owner_csrf_token"
OWNER_CSRF_HEADER = "X-Owner-CSRF-TOKEN"

_SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def _max_age():
    """Cookie lifetime derived from the JWT access-token expiry."""
    expires = current_app.config.get("JWT_ACCESS_TOKEN_EXPIRES")
    try:
        return int(expires.total_seconds())
    except (AttributeError, TypeError):
        return None


def _secure():
    return bool(current_app.config.get("JWT_COOKIE_SECURE", False))


def issue_owner_session(resp, owner):
    """Attach the isolated owner access + CSRF cookies to a response."""
    csrf = secrets.token_urlsafe(32)
    token = create_access_token(
        identity=f"owner:{owner.id}", additional_claims={"csrf": csrf}
    )
    max_age = _max_age()
    resp.set_cookie(
        OWNER_ACCESS_COOKIE, token, max_age=max_age, httponly=True,
        samesite="Lax", secure=_secure(), path="/",
    )
    resp.set_cookie(
        OWNER_CSRF_COOKIE, csrf, max_age=max_age, httponly=False,
        samesite="Lax", secure=_secure(), path="/",
    )
    return resp


def clear_owner_session(resp):
    """Remove the owner access + CSRF cookies."""
    resp.delete_cookie(OWNER_ACCESS_COOKIE, path="/")
    resp.delete_cookie(OWNER_CSRF_COOKIE, path="/")
    return resp


def _token_from_header():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:].strip()
    return None


def load_owner_payload():
    """Return the verified owner JWT payload, or None when absent/invalid.

    The owner cookie is the primary source. An ``Authorization: Bearer`` header
    is also accepted so API clients (and the test suite) can authenticate
    without cookies; header-based tokens are exempt from the CSRF check.
    """
    token = request.cookies.get(OWNER_ACCESS_COOKIE) or _token_from_header()
    if not token:
        return None
    try:
        payload = decode_token(token)
    except Exception:
        return None
    if is_token_revoked(payload.get("jti")):
        return None
    if not str(payload.get("sub", "")).startswith("owner:"):
        return None
    return payload


def owner_id_from_payload(payload):
    """Extract the owner id from a verified owner payload, or None."""
    if not payload:
        return None
    try:
        return int(str(payload["sub"]).split(":", 1)[1])
    except (KeyError, ValueError, TypeError):
        return None


def get_owner_id():
    """Return the owner id from the owner session cookie, or None."""
    return owner_id_from_payload(load_owner_payload())


def owner_csrf_ok(payload):
    """Double-submit CSRF check for owner state-changing requests."""
    if request.method in _SAFE_METHODS:
        return True
    if not payload:
        return False
    # A token supplied via the Authorization header is not cookie-based and is
    # therefore not exposed to CSRF, mirroring flask-jwt-extended's behaviour.
    if not request.cookies.get(OWNER_ACCESS_COOKIE):
        return True
    header = request.headers.get(OWNER_CSRF_HEADER)
    return bool(header) and header == payload.get("csrf")
