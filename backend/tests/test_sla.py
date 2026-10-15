from datetime import datetime, timedelta

from utils.sla import add_business_minutes, apply_sla


def test_add_business_minutes_within_hours():
    # Monday 12:00 IST == 06:30 UTC
    start = datetime(2026, 6, 1, 6, 30, 0)
    due = add_business_minutes(start, 60)
    # 13:00 IST == 07:30 UTC
    assert due == datetime(2026, 6, 1, 7, 30, 0)


def test_add_business_minutes_rolls_to_next_day():
    # Monday 18:30 IST == 13:00 UTC; +60 min -> next day 10:30 IST == 05:00 UTC
    start = datetime(2026, 6, 1, 13, 0, 0)
    due = add_business_minutes(start, 60)
    assert due == datetime(2026, 6, 2, 5, 0, 0)


def test_add_business_minutes_skips_sunday():
    # Saturday 18:30 IST == 13:00 UTC; +60 min -> Monday 10:30 IST == 05:00 UTC
    start = datetime(2026, 6, 6, 13, 0, 0)
    due = add_business_minutes(start, 60)
    assert due == datetime(2026, 6, 8, 5, 0, 0)


def test_add_business_minutes_zero():
    start = datetime(2026, 6, 1, 6, 30, 0)
    assert add_business_minutes(start, 0) == start


def test_apply_sla_sets_due(client, app):
    from extensions import db
    from models.models import Admin, Lead

    with app.app_context():
        admin = Admin.query.filter_by(username="sla-admin").first()
        if not admin:
            admin = Admin(username="sla-admin", email="sla@example.com", password="x")
            db.session.add(admin)
            db.session.commit()

        lead = Lead(name="SLA Test", mobile="9000000000",
                    assigned_to=admin.id, created_at=datetime(2026, 6, 1, 13, 0, 0))
        apply_sla(lead, now=datetime(2026, 6, 1, 13, 0, 0))
        db.session.add(lead)
        db.session.commit()

        # Default SLA is 15 min: Monday 18:30 IST +15 -> 18:45 IST = 13:15 UTC
        assert lead.sla_due_at == datetime(2026, 6, 1, 13, 15, 0)
        assert lead.first_response_at is None

        # Make it overdue and clear any prior reminder.
        lead.sla_due_at = datetime.utcnow() - timedelta(hours=1)
        lead.sla_reminded_at = None
        db.session.commit()

        app.config["CRON_KEY"] = "test-key"
        rv = client.post("/api/cron/leads/reminders", headers={"X-Cron-Key": "test-key"})
        assert rv.status_code == 200
        data = rv.get_json()
        assert data["overdue"] >= 1
        assert data["reminded"] >= 1

        db.session.refresh(lead)
        assert lead.sla_reminded_at is not None

        db.session.delete(lead)
        db.session.commit()
