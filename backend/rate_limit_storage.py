from __future__ import annotations

import math
import time

from limits.storage.base import (
    MovingWindowSupport,
    SlidingWindowCounterSupport,
    Storage,
    TimestampedSlidingWindow,
)


class DBRateLimitStorage(
    Storage, MovingWindowSupport, SlidingWindowCounterSupport, TimestampedSlidingWindow
):
    """PostgreSQL-backed rate-limit storage.

    Persists counters in the ``rate_limit_counters`` table (see
    ``models.models.RateLimitCounter`` and the ``f6a7b8c9d0e1`` migration) so
    limits are shared across multiple Passenger worker processes instead of
    living per-process in memory.

    Registered as the ``db://`` scheme; enable it with
    ``RATELIMIT_STORAGE_URI=db://``.
    """

    STORAGE_SCHEME = ["db", "postgres", "postgresql"]

    def __init__(self, uri: str | None = None, wrap_exceptions: bool = False, **_: str):
        self.wrap_exceptions = wrap_exceptions
        super().__init__(uri, wrap_exceptions=wrap_exceptions, **_)

    @property
    def base_exceptions(self):
        try:
            from sqlalchemy.exc import SQLAlchemyError

            return (SQLAlchemyError,)
        except Exception:  # pragma: no cover - sqlalchemy always present
            return (Exception,)

    def _session(self):
        from extensions import db

        return db.session

    def _model(self):
        from models.models import RateLimitCounter

        return RateLimitCounter

    def incr(self, key: str, expiry: float, amount: int = 1) -> int:
        model = self._model()
        session = self._session()
        now = time.time()
        counter = session.query(model).filter_by(key=key).first()
        if counter is None:
            counter = model(key=key, value=amount, expires_at=now + float(expiry))
            session.add(counter)
        elif counter.expires_at <= now:
            # Expired: restart the window instead of appending to a stale row.
            counter.value = amount
            counter.expires_at = now + float(expiry)
        else:
            counter.value = (counter.value or 0) + amount
        session.commit()
        return int(counter.value)

    def decr(self, key: str, amount: int = 1) -> int:
        model = self._model()
        session = self._session()
        counter = session.query(model).filter_by(key=key).first()
        if counter is None:
            return 0
        counter.value = max((counter.value or 0) - amount, 0)
        session.commit()
        return int(counter.value)

    def get(self, key: str) -> int:
        model = self._model()
        session = self._session()
        now = time.time()
        counter = session.query(model).filter_by(key=key).first()
        if counter is None or counter.expires_at <= now:
            return 0
        return int(counter.value)

    def get_expiry(self, key: str) -> float:
        model = self._model()
        session = self._session()
        counter = session.query(model).filter_by(key=key).first()
        if counter is None:
            return time.time()
        return float(counter.expires_at)

    def clear(self, key: str) -> None:
        model = self._model()
        session = self._session()
        session.query(model).filter_by(key=key).delete()
        session.commit()

    def reset(self):
        model = self._model()
        session = self._session()
        count = session.query(model).count()
        session.query(model).delete()
        session.commit()
        return count

    def check(self) -> bool:
        try:
            session = self._session()
            session.query(self._model()).limit(1).all()
            return True
        except Exception:
            return False

    # -- moving-window support (best-effort) -------------------------------
    def acquire_entry(self, key: str, limit: int, expiry: int, amount: int = 1) -> bool:
        if amount > limit:
            return False
        if self.get(key) + amount > limit:
            return False
        self.incr(key, float(expiry), amount)
        return True

    def get_moving_window(self, key: str, limit: int, expiry: int):
        return (time.time(), self.get(key))

    def acquire_sliding_window_entry(
        self, key: str, limit: int, expiry: int, amount: int = 1
    ) -> bool:
        if amount > limit:
            return False
        now = time.time()
        prev_key, curr_key = self.sliding_window_keys(key, expiry, now)
        prev_count = self.get(prev_key)
        curr_count = self.get(curr_key)
        prev_ttl = ((1 - (((now - expiry) / expiry) % 1)) * expiry) if prev_count else 0.0
        weighted = prev_count * prev_ttl / expiry + curr_count
        if math.floor(weighted) + amount > limit:
            return False
        self.incr(curr_key, 2.0 * expiry, amount)
        return True

    def get_sliding_window(self, key: str, expiry: int):
        now = time.time()
        prev_key, curr_key = self.sliding_window_keys(key, expiry, now)
        prev_count = self.get(prev_key)
        curr_count = self.get(curr_key)
        prev_ttl = ((1 - (((now - expiry) / expiry) % 1)) * expiry) if prev_count else 0.0
        curr_ttl = (1 - ((now / expiry) % 1)) * expiry + expiry
        return (prev_count, prev_ttl, curr_count, curr_ttl)

    def clear_sliding_window(self, key: str, expiry: int) -> None:
        now = time.time()
        prev_key, curr_key = self.sliding_window_keys(key, expiry, now)
        self.clear(prev_key)
        self.clear(curr_key)
