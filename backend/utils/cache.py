"""Tiny in-process TTL cache for hot public read endpoints.

The shared cPanel deployment has no Redis/Memcached, so cross-request caching
has to live in the worker process. This mirrors the settings cache approach:
a dict keyed by a caller-supplied string holding ``(expires_at, value)``.

Entries expire lazily on read; ``clear_cache`` lets admin mutations drop stale
public payloads immediately.
"""
import time
import threading

_store = {}
_lock = threading.Lock()


def get_cached(key):
    """Return the cached value for ``key`` or ``None`` when missing/expired."""
    with _lock:
        entry = _store.get(key)
        if entry is None:
            return None
        expires_at, value = entry
        if expires_at < time.time():
            _store.pop(key, None)
            return None
        return value


def set_cached(key, value, ttl):
    """Cache ``value`` under ``key`` for ``ttl`` seconds."""
    with _lock:
        _store[key] = (time.time() + max(ttl, 0), value)


def clear_cache(prefix=None):
    """Drop entries matching ``prefix`` (or everything when omitted)."""
    with _lock:
        if prefix is None:
            _store.clear()
            return
        for key in [k for k in _store if k.startswith(prefix)]:
            _store.pop(key, None)
