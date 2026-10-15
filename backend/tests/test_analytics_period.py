import uuid

from datetime import datetime, timedelta


def _admin_headers(app):
    from flask_jwt_extended import create_access_token
    with app.app_context():
        token = create_access_token(identity="1")
    return {"Authorization": f"Bearer {token}"}


def _get(client, app, path):
    headers = _admin_headers(app)
    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    try:
        return client.get(path, headers=headers)
    finally:
        app.config["JWT_TOKEN_LOCATION"] = prev_location
        app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf


def test_analytics_cards_are_period_scoped(client, app):
    from extensions import db
    from models.analytics_model import PageVisit

    marker = f"test-{uuid.uuid4().hex[:8]}"
    now = datetime.utcnow()

    with app.app_context():
        for i in range(3):  # today
            db.session.add(PageVisit(page_url="/", visitor_ip=f"{marker}-today-{i}",
                                     created_at=now - timedelta(minutes=i)))
        for i in range(5):  # ~15 days ago (outside a 1-day window, inside 30)
            db.session.add(PageVisit(page_url="/", visitor_ip=f"{marker}-old-{i}",
                                     created_at=now - timedelta(days=15, minutes=i)))
        db.session.commit()

    try:
        rv1 = _get(client, app, "/api/admin/analytics?days=1")
        rv30 = _get(client, app, "/api/admin/analytics?days=30")
        assert rv1.status_code == 200
        assert rv30.status_code == 200

        d1 = rv1.get_json()
        d30 = rv30.get_json()

        # 1-day window must exclude the 15-day-old visits.
        assert d30["visits_period"] - d1["visits_period"] >= 5
        # Card value drives the number displayed for the selected period.
        assert d1["visits_period"] >= 3

        # Daily series length follows the selected period.
        assert len(d1["daily_visits"]) == 1
        assert len(d30["daily_visits"]) == 30
    finally:
        with app.app_context():
            PageVisit.query.filter(PageVisit.visitor_ip.like(f"{marker}%")).delete(
                synchronize_session=False
            )
            db.session.commit()
