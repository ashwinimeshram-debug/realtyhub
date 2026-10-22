import os
import secrets
from datetime import timedelta

_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


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
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 1800,
        "pool_pre_ping": True,
        # Passenger runs a small number of workers on shared cPanel; keep the
        # pool very modest so total connections stay within the shared Postgres
        # limit (hosts often cap at a handful of slots, some reserved for
        # superusers). 1+1 keeps a permanent connection plus one burst.
        "pool_size": int(os.getenv("DB_POOL_SIZE", "2")),
        "max_overflow": int(os.getenv("DB_MAX_OVERFLOW", "1")),
        "pool_timeout": int(os.getenv("DB_POOL_TIMEOUT", "10")),
    }

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

    MAIL_SERVER = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
    MAIL_USE_TLS = os.getenv("MAIL_USE_TLS", "true").lower() in ("1", "true", "yes")
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "info@nagpurrealtyhub.com")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "your_app_password")
    MAIL_SENDER = os.getenv("MAIL_SENDER") or os.getenv("MAIL_USERNAME", "info@nagpurrealtyhub.com")
    MAIL_ENABLED = os.getenv("MAIL_ENABLED", "false").lower() in ("1", "true", "yes")

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
