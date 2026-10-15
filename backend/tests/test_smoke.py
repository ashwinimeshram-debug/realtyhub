from types import SimpleNamespace

from routes.leads_routes import _least_loaded_executive


def test_root_ok(client):
    rv = client.get("/")
    assert rv.status_code == 200


def test_public_properties_list(client):
    rv = client.get("/api/properties")
    assert rv.status_code == 200
    data = rv.get_json()
    assert isinstance(data, dict)
    assert "items" in data or "properties" in data


def test_settings_public(client):
    rv = client.get("/api/settings")
    assert rv.status_code == 200
    assert isinstance(rv.get_json(), dict)


def test_property_detail_missing_returns_404(client):
    rv = client.get("/api/property/99999999")
    assert rv.status_code == 404


def test_admin_route_requires_auth(client):
    rv = client.get("/api/admin/settings")
    assert rv.status_code in (401, 422)


def test_admin_login_rejects_bad_credentials(client):
    rv = client.post("/api/admin/login", json={"username": "nobody", "password": "wrong"})
    assert rv.status_code == 401


def test_cron_requires_key(client):
    rv = client.get("/api/cron/health")
    assert rv.status_code == 401


def test_cron_accepts_valid_key(client, app):
    app.config["CRON_KEY"] = "test-key"
    rv = client.get("/api/cron/health", headers={"X-Cron-Key": "test-key"})
    assert rv.status_code == 200
    assert rv.get_json()["status"] == "ok"


def test_least_loaded_executive_picks_lowest():
    executives = [
        SimpleNamespace(id=1),
        SimpleNamespace(id=2),
        SimpleNamespace(id=3),
    ]
    target = _least_loaded_executive(executives, {1: 5, 2: 0, 3: 3})
    assert target.id == 2


def test_least_loaded_executive_empty():
    assert _least_loaded_executive([], {}) is None
