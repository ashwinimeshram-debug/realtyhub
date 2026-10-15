from datetime import datetime, timedelta


def test_create_guest_saved_search(client):
    rv = client.post("/api/saved-searches", json={
        "email": "buyer@example.com",
        "name": "3BHK Nagpur",
        "params": {"location": "Nagpur", "max_price": "5000000", "q": "flat"},
    })
    assert rv.status_code == 201
    data = rv.get_json()
    assert data["id"]
    assert data["unsubscribe_token"]

    from extensions import db
    from models.models import SavedSearch
    with client.application.app_context():
        row = db.session.get(SavedSearch, data["id"])
        db.session.delete(row)
        db.session.commit()


def test_create_saved_search_requires_filters(client):
    rv = client.post("/api/saved-searches", json={"email": "buyer@example.com", "params": {}})
    assert rv.status_code == 400


def test_create_saved_search_requires_contact(client):
    rv = client.post("/api/saved-searches", json={"params": {"location": "Nagpur"}})
    assert rv.status_code == 400


def test_create_saved_search_timeline_alone_rejected(client):
    rv = client.post("/api/saved-searches", json={
        "email": "buyer3@example.com",
        "params": {"timeline": "Immediately"},
    })
    assert rv.status_code == 400


def test_create_saved_search_with_timeline(client):
    rv = client.post("/api/saved-searches", json={
        "email": "buyer4@example.com",
        "params": {"location": "Nagpur", "timeline": "1-3 months"},
    })
    assert rv.status_code == 201

    import json

    from extensions import db
    from models.models import SavedSearch
    data = rv.get_json()
    with client.application.app_context():
        row = db.session.get(SavedSearch, data["id"])
        assert json.loads(row.params)["timeline"] == "1-3 months"
        db.session.delete(row)
        db.session.commit()


def test_unsubscribe_by_token(client):
    rv = client.post("/api/saved-searches", json={
        "email": "buyer2@example.com", "params": {"location": "Nagpur"},
    })
    token = rv.get_json()["unsubscribe_token"]
    saved_id = rv.get_json()["id"]

    rv2 = client.post("/api/saved-searches/unsubscribe", json={"token": token})
    assert rv2.status_code == 200

    from extensions import db
    from models.models import SavedSearch
    with client.application.app_context():
        row = db.session.get(SavedSearch, saved_id)
        assert row.is_active is False
        assert row.notify is False
        db.session.delete(row)
        db.session.commit()


def test_cron_search_alerts(client, app):
    from extensions import db
    from models.models import Property, SavedSearch

    with app.app_context():
        prop = Property(
            title="Cron Match Flat in Nagpur", property_type="flat",
            location="Nagpur, Nagpur", transaction_type="sale",
            status="approved", is_active=True, price=3000000,
            created_at=datetime.utcnow(),
        )
        db.session.add(prop)
        db.session.flush()

        saved = SavedSearch(
            email="alert@example.com", phone="9876543210",
            params='{"location": "Nagpur"}',
            unsubscribe_token="test-token-cron",
            created_at=datetime.utcnow() - timedelta(hours=1),
        )
        db.session.add(saved)
        db.session.commit()
        saved_id = saved.id
        prop_id = prop.id

        app.config["CRON_KEY"] = "test-key"
        rv = client.post("/api/cron/search/alerts", headers={"X-Cron-Key": "test-key"})
        assert rv.status_code == 200
        data = rv.get_json()
        assert data["notified"] >= 1
        assert data["matches"] >= 1

        db.session.refresh(saved)
        assert saved.last_notified_at is not None

        db.session.delete(saved)
        db.session.delete(db.session.get(Property, prop_id))
        db.session.commit()
