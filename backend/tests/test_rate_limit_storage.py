import time

import bcrypt

from extensions import db
from models.models import Admin, RateLimitCounter
from rate_limit_storage import DBRateLimitStorage


def test_db_rate_limit_storage_increments_and_persists(app):
    with app.app_context():
        storage = DBRateLimitStorage()
        key = "1.2.3.4:GET:/api/test"
        storage.clear(key)

        assert storage.get(key) == 0
        assert storage.incr(key, expiry=60) == 1
        assert storage.incr(key, expiry=60) == 2
        assert storage.get(key) == 2

        # The counter really lives in the DB, so it is shared across
        # processes/workers (unlike the memory:// backend).
        row = RateLimitCounter.query.filter_by(key=key).first()
        assert row is not None
        assert row.value == 2
        assert storage.get_expiry(key) > time.time()

        storage.clear(key)
        assert storage.get(key) == 0
        assert RateLimitCounter.query.filter_by(key=key).first() is None


def test_db_rate_limit_storage_restarts_expired_window(app):
    with app.app_context():
        storage = DBRateLimitStorage()
        key = "test:expiring"
        storage.clear(key)

        assert storage.incr(key, expiry=0) == 1
        time.sleep(0.01)
        # Window expired: the next hit must restart the counter, not append.
        assert storage.incr(key, expiry=60) == 1
        storage.clear(key)


def test_db_rate_limit_storage_reset_and_check(app):
    with app.app_context():
        storage = DBRateLimitStorage()
        storage.clear("reset-a")
        storage.incr("reset-a", expiry=60)
        assert storage.check() is True
        storage.clear("reset-a")


def test_no_account_uses_the_removed_default_password(app):
    """The admin/admin123 auto-seed was removed; ensure nothing still uses it."""
    with app.app_context():
        for admin in Admin.query.all():
            try:
                is_default = bcrypt.checkpw(
                    b"admin123", (admin.password or "").encode("utf-8")
                )
            except ValueError:
                # Not a bcrypt hash at all (legacy/placeholder) -> not the
                # removed default account.
                is_default = False
            assert not is_default, (
                f"admin '{admin.username}' still uses the default admin123 password"
            )
