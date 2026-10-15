import os
import sys


def _default_test_url():
    """Derive a *_test database URL from DATABASE_URL (env or backend/.env)."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        env_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"
        )
        if os.path.exists(env_path):
            with open(env_path, encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if line.startswith("DATABASE_URL="):
                        url = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    if url and "/" in url:
        head, _, _ = url.rpartition("/")
        return f"{head}/realtyhub_test"
    return "postgresql+psycopg2://postgres:postgres@localhost:5432/realtyhub_test"


# Point the app at an isolated test database BEFORE importing app/config so the
# engine never touches the real database. CI sets TEST_DATABASE_URL to its
# Postgres service; locally we derive the *_test database from DATABASE_URL.
os.environ["DATABASE_URL"] = os.environ.get("TEST_DATABASE_URL") or _default_test_url()
os.environ.setdefault("SECRET_KEY", "test-secret")
os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
os.environ.setdefault("FLASK_ENV", "testing")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

import pytest  # noqa: E402
from app import create_app  # noqa: E402
from extensions import db  # noqa: E402


@pytest.fixture(scope="session")
def app():
    flask_app = create_app()
    flask_app.config.update({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False,
    })
    yield flask_app
    with flask_app.app_context():
        db.session.remove()


@pytest.fixture
def client(app):
    return app.test_client()
