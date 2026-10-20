import uuid


def _mint_admin_token(app, admin_id):
    from flask_jwt_extended import create_access_token

    with app.app_context():
        return create_access_token(identity=str(admin_id))


def _as_admin(app, method, path, admin_id, **kwargs):
    headers = {"Authorization": f"Bearer {_mint_admin_token(app, admin_id)}"}
    prev_location = app.config.get("JWT_TOKEN_LOCATION")
    prev_csrf = app.config.get("JWT_COOKIE_CSRF_PROTECT")
    app.config["JWT_TOKEN_LOCATION"] = ["headers"]
    app.config["JWT_COOKIE_CSRF_PROTECT"] = False
    try:
        return getattr(app.test_client(), method)(path, headers=headers, **kwargs)
    finally:
        app.config["JWT_TOKEN_LOCATION"] = prev_location
        app.config["JWT_COOKIE_CSRF_PROTECT"] = prev_csrf


def _make_admin(marker, role="agent"):
    import bcrypt

    from models.models import Admin

    pw = bcrypt.hashpw(b"secret", bcrypt.gensalt()).decode()
    return Admin(username=f"u-{marker}", email=f"u-{marker}@t.com", password=pw, role=role)


def test_delete_user_keeps_closed_leads_state(client, app):
    from extensions import db
    from models.models import Admin, Lead, LeadTransfer

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        deleter = _make_admin(f"del-{marker}", role="admin")
        target = _make_admin(f"tgt-{marker}")
        db.session.add_all([deleter, target])
        db.session.commit()
        deleter_id, target_id = deleter.id, target.id

        open_lead = Lead(name="Open", mobile="9000000001", assigned_to=target_id,
                         stage="SITE_VISIT", lead_status="ACTIVE")
        closed_lead = Lead(name="Closed", mobile="9000000002", assigned_to=target_id,
                           stage="CLOSED", lead_status="WON")
        db.session.add_all([open_lead, closed_lead])
        db.session.commit()
        open_id, closed_id = open_lead.id, closed_lead.id

    try:
        rv = _as_admin(app, "delete", f"/api/admin/users/{target_id}", deleter_id)
        assert rv.status_code == 200
        body = rv.get_json()
        assert body["unassigned_leads"] == 1
        assert body["closed_leads"] == 1
        assert "1 lead(s) unassigned" in body["message"]
        assert "1 closed lead(s) kept as-is" in body["message"]

        with app.app_context():
            assert db.session.get(Admin, target_id) is None

            closed = db.session.get(Lead, closed_id)
            assert closed.assigned_to is None
            # Closed lead keeps its state "as is".
            assert closed.stage == "CLOSED"
            assert closed.lead_status == "WON"

            openl = db.session.get(Lead, open_id)
            assert openl.assigned_to is None
            # Open lead preserves the stage it had reached.
            assert openl.stage == "SITE_VISIT"

            # A transfer row is recorded for each (source user -> free).
            rows = LeadTransfer.query.filter(LeadTransfer.to_admin_id.is_(None)).all()
            assert len(rows) == 2
            assert all(r.from_admin_name for r in rows)
    finally:
        with app.app_context():
            for lid in (open_id, closed_id):
                lead = db.session.get(Lead, lid)
                if lead:
                    db.session.delete(lead)
            for aid in (deleter_id, target_id):
                a = db.session.get(Admin, aid)
                if a:
                    db.session.delete(a)
            db.session.commit()


def test_reassign_preserves_stage_and_records_transfer(client, app):
    from extensions import db
    from models.models import Admin, Lead, LeadTransfer

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        admin = _make_admin(f"a-{marker}", role="admin")
        emp_a = _make_admin(f"a{marker}")
        emp_b = _make_admin(f"b{marker}")
        db.session.add_all([admin, emp_a, emp_b])
        db.session.commit()
        admin_id, emp_a_id, emp_b_id = admin.id, emp_a.id, emp_b.id

        lead = Lead(name="Transfer Me", mobile="9000000003", assigned_to=emp_a_id,
                    stage="CONTACTED", lead_status="ACTIVE")
        db.session.add(lead)
        db.session.commit()
        lead_id = lead.id

    try:
        rv = _as_admin(app, "post", f"/api/admin/leads/{lead_id}/assign", admin_id,
                       json={"user_id": emp_b_id, "reason": "Handover"})
        assert rv.status_code == 200

        with app.app_context():
            lead = db.session.get(Lead, lead_id)
            assert lead.assigned_to == emp_b_id
            # Stage is preserved across transfer.
            assert lead.stage == "CONTACTED"

            transfers = LeadTransfer.query.filter_by(lead_id=lead_id).order_by(
                LeadTransfer.id.asc()
            ).all()
            assert len(transfers) == 1
            t = transfers[0]
            assert t.from_admin_id == emp_a_id
            assert t.to_admin_id == emp_b_id
            assert t.reason == "Handover"
            assert t.from_admin_name and t.to_admin_name
    finally:
        with app.app_context():
            lead = db.session.get(Lead, lead_id)
            if lead:
                db.session.delete(lead)
            for aid in (admin_id, emp_a_id, emp_b_id):
                a = db.session.get(Admin, aid)
                if a:
                    db.session.delete(a)
            db.session.commit()


def test_closed_lead_not_in_unassigned_scope(client, app):
    from extensions import db
    from models.models import Admin, Lead

    marker = uuid.uuid4().hex[:8]
    with app.app_context():
        admin = _make_admin(f"s-{marker}", role="admin")
        db.session.add(admin)
        db.session.commit()
        admin_id = admin.id

        open_lead = Lead(name="Pool", mobile="9000000004", assigned_to=None,
                         stage="NEW", lead_status="ACTIVE")
        closed_lead = Lead(name="WonUnassigned", mobile="9000000005", assigned_to=None,
                           stage="CLOSED", lead_status="WON")
        db.session.add_all([open_lead, closed_lead])
        db.session.commit()
        open_id, closed_id = open_lead.id, closed_lead.id

    try:
        rv = _as_admin(app, "post", "/api/admin/leads/auto-assign", admin_id,
                       json={"lead_ids": []})
        assert rv.status_code == 200

        with app.app_context():
            # The open lead is eligible, so it gets picked up by some executive.
            assert db.session.get(Lead, open_id).assigned_to is not None
            # The closed lead must never enter the auto-assignment pool.
            assert db.session.get(Lead, closed_id).assigned_to is None
    finally:
        with app.app_context():
            for lid in (open_id, closed_id):
                lead = db.session.get(Lead, lid)
                if lead:
                    db.session.delete(lead)
            a = db.session.get(Admin, admin_id)
            if a:
                db.session.delete(a)
            db.session.commit()
