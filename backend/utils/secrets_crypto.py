"""Symmetric encryption for secrets stored at rest (e.g. Meta page tokens).

The key is derived deterministically from the app's ``SECRET_KEY`` so encrypted
values survive restarts as long as the secret is stable. Values are stored as
URL-safe base64 ``Fernet`` tokens prefixed with ``enc:`` so plaintext legacy
values (or env-provided values) can coexist and are transparently recognised.
"""
import base64
import hashlib
import logging

logger = logging.getLogger("realtyhub")

_PREFIX = "enc:"


def _fernet():
    try:
        from cryptography.fernet import Fernet
    except ImportError:  # pragma: no cover
        return None
    try:
        from flask import current_app
        secret = current_app.config.get("SECRET_KEY") or ""
    except Exception:
        import os
        secret = os.getenv("SECRET_KEY") or ""
    if not secret:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(value):
    """Encrypt a plaintext secret for storage. Returns ``enc:<token>``.

    Falls back to returning the raw value unchanged when encryption is
    unavailable, so the app never crashes on a missing dependency.
    """
    if value is None or value == "":
        return value
    f = _fernet()
    if f is None:
        return value
    try:
        token = f.encrypt(str(value).encode("utf-8")).decode("ascii")
        return f"{_PREFIX}{token}"
    except Exception as exc:  # pragma: no cover
        logger.warning("Secret encryption failed: %s", exc)
        return value


def decrypt_secret(value):
    """Decrypt an ``enc:`` value; plaintext/legacy/None values pass through."""
    if not value:
        return value
    if not str(value).startswith(_PREFIX):
        return value
    f = _fernet()
    if f is None:
        return value
    try:
        from cryptography.fernet import InvalidToken
    except ImportError:  # pragma: no cover
        InvalidToken = Exception  # type: ignore
    token = str(value)[len(_PREFIX):]
    try:
        return f.decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        logger.warning("Stored secret could not be decrypted (secret key changed?)")
        return ""
    except Exception as exc:  # pragma: no cover
        logger.warning("Secret decryption failed: %s", exc)
        return ""


def is_encrypted(value):
    return bool(value) and str(value).startswith(_PREFIX)


def mask_secret(value):
    """Return a masked preview for admin display; never reveals the secret."""
    if not value:
        return ""
    plain = decrypt_secret(value)
    if not plain:
        return "••••••••"
    tail = plain[-4:] if len(plain) >= 4 else ""
    return f"••••••••{tail}"
