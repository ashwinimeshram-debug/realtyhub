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

    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/realtyhub"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_recycle": 3600,
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
    }

    SUPABASE_URL = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY", "")
    SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "realtyhub-images")

    UPLOAD_FOLDER = os.path.join(os.getcwd(), "uploads")
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024
    MAX_FILE_SIZE = 10 * 1024 * 1024
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "avif"}

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

    MAIL_SERVER = "smtp.gmail.com"
    MAIL_PORT = 587
    MAIL_USE_TLS = True
    MAIL_USERNAME = os.getenv("MAIL_USERNAME", "info@nagpurrealtyhub.com")
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "your_app_password")
    MAIL_SENDER = os.getenv("MAIL_SENDER") or os.getenv("MAIL_USERNAME", "info@nagpurrealtyhub.com")
    MAIL_ENABLED = os.getenv("MAIL_ENABLED", "false").lower() in ("1", "true", "yes")

    RATELIMIT_DEFAULT = "200/minute"
    RATELIMIT_STORAGE_URI = "memory://"

    VALID_PAGES = ["about", "privacy", "terms", "contact"]
