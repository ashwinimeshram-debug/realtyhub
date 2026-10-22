import os
import secrets
import time
from datetime import timedelta

_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


def _build_connect_creator(url_string, attempts=5, delay=0.5):
    """Return a DBAPI connection factory that retries transient failures.

    Shared Postgres hosts (e.g. HostyCare) run one PostgreSQL instance for
    every account on the server. When other tenants exhaust the server's
    ``max_connections``, PostgreSQL refuses *new* connections immediately
    ("remaining connection slots are reserved for non-replication superuser
    connections") and psycopg2 raises without waiting.

    A short retry loop turns that hard failure into a brief wait that
    succeeds as soon as a slot is released. Returns ``None`` when the driver
    or URL is not supported, in which case SQLAlchemy's normal connect path
    is used.
    """
    try:
        import psycopg2
        from sqlalchemy.engine import make_url
    except Exception:  # pragma: no cover - psycopg2 always present in prod
        return None

    try:
        url = make_url(url_string)
    except Exception:
        return None

    if not url.drivername.startswith("postgresql"):
        return None

    connect_args = {
        "host": url.host,
        "port": url.port or 5432,
        "user": url.username,
        "password": url.password,
        "dbname": url.database,
    }
    # Preserve query-string options such as sslmode.
    for key, value in (url.query or {}).items():
        if isinstance(value, (list, tuple)):
            value = value[-1] if value else None
        if value is not None:
            connect_args[key] = value

    def creator():
        last_exc = None
        for attempt in range(attempts):
            try:
                return psycopg2.connect(**connect_args)
            except Exception as exc:  # noqa: BLE001 - retried below
                last_exc = exc
                time.sleep(delay * (attempt + 1))
        raise last_exc

    return creator


def _load_env_file():
    """Load key=value pairs from .env into os.environ (without overriding existing env vars)."""
    if not os.path.isfile(_ENV_PATH):
        return
    with open(_ENV_PATH, "r") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip("\"'")
            if key and key not in os.environ:
                os.environ[key] = value


def _persist_env_key(key: str, value: str):
    """Append a key=value pair to .env if it doesn't already exist."""
    lines = []
    if os.path.isfile(_ENV_PATH):
        with open(_ENV_PATH, "r") as f:
            lines = f.readlines()
    existing_keys = {l.split("=", 1)[0].strip() for l in lines if "=" in l}
    if key not in existing_keys:
        with open(_ENV_PATH, "a") as f:
            f.write(f"{key}={value}\n")


_load_env_file()


class Config:
    _secret = os.getenv("SECRET_KEY")
    _jwt_secret = os.getenv("JWT_SECRET_KEY")

    if not _secret:
        _secret = secrets.token_hex(32)
        _persist_env_key("SECRET_KEY", _secret)
    if not _jwt_secret:
        _jwt_secret = secrets.token_hex(32)
        _persist_env_key("JWT_SECRET_KEY", _jwt_secret)

    SECRET_KEY = _secret
    JWT_SECRET_KEY = _jwt_secret

    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_ACCESS_COOKIE_NAME = "access_token_cookie"
    JWT_COOKIE_SECURE = os.getenv("FLASK_ENV") == "production"
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    _is_production = os.getenv("FLASK_ENV") == "production"

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/realtyhub"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    _engine_options = {
        "pool_recycle": 1800,
        "pool_pre_ping": True,
        # Passenger runs a small number of workers on shared cPanel; keep the
        # pool very modest so total connections stay within the shared Postgres
        # limit (hosts often cap at a handful of slots, some reserved for
        # superusers). 2+0 keeps two connections per worker and never
        # overflows, so the worst case is bounded by the worker count.
        "pool_size": int(os.getenv("DB_POOL_SIZE", "2")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "0")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "20")),
    }

    # Retry transient "no connection slots available" failures instead of
    # failing the request instantly.
    _creator = _build_connect_creator(
        SQLALCHEMY_DATABASE_URI,
        attempts=int(os.getenv("DB_CONNECT_RETRIES", "5")),
        delay=float(os.getenv("DB_CONNECT_RETRY_DELAY", "0.5")),
    )
    if _creator is not None:
        _engine_options["creator"] = _creator

    SQLALCHEMY_ENGINE_OPTIONS = _engine_options

    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "realtyhub-images")

    # Absolute path so uploads work regardless of the process working
    # directory (Passenger/cPanel does not guarantee the app dir).
    UPLOAD_FOLDER = os.getenv(
        "UPLOAD_FOLDER",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads"),
    )
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
    MAX_FILE_SIZE = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "avif"}

    CORS_ORIGINS = [
        o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()
    ]
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

    MAIL_SERVER = os.getenv("MAIL_SERVER", "mail.plotandroof.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "465"))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "false").lower() in ("1", "true", "yes")
    MAIL_USE_SSL = os.getenv("MAIL_USE_SSL", "true").lower() in ("1", "true", "yes")
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "info@plotandroof.com")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
    MAIL_SENDER = os.getenv("MAIL_SENDER") or os.getenv("MAIL_USERNAME", "info@plotandroof.com")
    MAIL_ENABLED = os.getenv("MAIL_ENABLED", "true").lower() in ("1", "true", "yes")

    RATELIMIT_DEFAULT = os.getenv("RATELIMIT_DEFAULT", "200 per minute")
    # Rate-limit counters default to in-process memory. A shared Postgres
    # backend ("db://") is more accurate across workers, but on shared cPanel
    # hosting every counter hit draws a DB connection from a very small pool
    # and quickly exhausts the limited Postgres connection slots. Opt into the
    # DB backend explicitly with RATELIMIT_STORAGE_URI=db:// when the host
    # allows enough connections (e.g. a Redis/Postgres with headroom).
    RATELIMIT_STORAGE_URI = os.getenv("RATELIMIT_STORAGE_URI", "memory://")

    # Shared secret for external cron/scheduler callbacks (X-Cron-Key header).
    CRON_KEY = os.getenv("CRON_KEY", "")

    # Lead first-response SLA (minutes) used by reminders (Phase 1.2).
    LEAD_SLA_MINUTES = int(os.getenv("LEAD_SLA_MINUTES", "15"))

    VALID_PAGES = ["about", "privacy", "terms", "contact"]
