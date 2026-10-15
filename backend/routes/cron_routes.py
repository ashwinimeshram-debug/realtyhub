import json
from datetime import datetime, timedelta

from flask import Blueprint, request, jsonify, current_app
from config import Config

from models.models import (
    Lead, Admin, Property, SavedSearch, PropertyContact, ConsentRecord,
    TokenBlocklist,
)
from models.contactus import Contactus
from extensions import db
from utils.mailer import (
    send_email_async, lead_sla_reminder_email, saved_search_alert_email,
    frontend_url,
)
from utils.messaging import send_whatsapp_async
from utils.search import apply_property_filters

cron_bp = Blueprint("cron", __name__)

_DESCRIBE_KEYS = (
    ("q", "keyword"), ("location", "locality"), ("type", "listing"),
    ("category", "type"), ("min_price", "min budget"), ("max_price", "max budget"),
    ("timeline", "timeline"),
)


def _describe_params(params):
    parts = []
    for key, label in _DESCRIBE_KEYS:
        value = params.get(key)
        if value:
            parts.append(f"{label}: {value}")
    return ", ".join(parts)


def _check_cron_key():
    key = request.headers.get("X-Cron-Key") or request.args.get("key")
    expected = current_app.config.get("CRON_KEY") or getattr(Config, "CRON_KEY", None) or ""
    if not expected:
        return False, "cron key not configured"
    if not key or key != expected:
        return False, "unauthorized"
    return True, None


@cron_bp.route("/health", methods=["GET", "POST"])
def cron_health():
    ok, err = _check_cron_key()
    if not ok:
        return jsonify({"error": err}), 401
    return jsonify({"status": "ok"})


@cron_bp.route("/leads/reminders", methods=["POST"])
def cron_leads_reminders():
    ok, err = _check_cron_key()
    if not ok:
        return jsonify({"error": err}), 401

    now = datetime.utcnow()
    overdue = Lead.query.filter(
        Lead.first_response_at.is_(None),
        Lead.sla_reminded_at.is_(None),
        Lead.sla_due_at.isnot(None),
        Lead.sla_due_at < now,
        Lead.lead_status == "ACTIVE",
    ).order_by(Lead.sla_due_at.asc()).all()

    if not overdue:
        return jsonify({"status": "ok", "reminded": 0, "overdue": 0})

    admin_ids = {l.assigned_to for l in overdue if l.assigned_to}
    admins = {
        a.id: a for a in Admin.query.filter(Admin.id.in_(admin_ids)).all()
    } if admin_ids else {}

    reminded = 0
    skipped = 0
    for lead in overdue:
        admin = admins.get(lead.assigned_to)
        minutes_overdue = int((now - lead.sla_due_at).total_seconds() // 60)
        if admin and admin.email:
            admin_name = admin.name or admin.username
            send_email_async(
                "Lead awaiting first response",
                [admin.email],
                lead_sla_reminder_email(lead, lead.property, admin_name, minutes_overdue),
            )
            reminded += 1
        else:
            skipped += 1
        lead.sla_reminded_at = now

    db.session.commit()
    return jsonify({
        "status": "ok",
        "reminded": reminded,
        "skipped": skipped,
        "overdue": len(overdue),
    })


@cron_bp.route("/search/alerts", methods=["POST"])
def cron_search_alerts():
    ok, err = _check_cron_key()
    if not ok:
        return jsonify({"error": err}), 401

    from routes.public_routes import _owner_visible_condition

    now = datetime.utcnow()
    saved_searches = SavedSearch.query.filter(
        SavedSearch.is_active.is_(True),
        SavedSearch.notify.is_(True),
    ).all()

    notified = 0
    total_matches = 0
    for saved in saved_searches:
        try:
            params = json.loads(saved.params or "{}")
        except (ValueError, TypeError):
            params = {}
        if not params:
            continue

        base = Property.query.filter(
            Property.status == "approved",
            Property.is_active == True,
            Property.is_closed == False,
            _owner_visible_condition(),
        )
        query, filter_err, _ = apply_property_filters(base, params)
        if filter_err:
            continue

        since = saved.last_notified_at or saved.created_at or (now - timedelta(days=1))
        matches = query.filter(Property.created_at > since).order_by(
            Property.created_at.desc()
        ).limit(10).all()
        if not matches:
            continue

        description = _describe_params(params)
        if saved.email:
            send_email_async(
                "New properties match your saved search",
                [saved.email],
                saved_search_alert_email(
                    saved, matches,
                    frontend_url(f"search-alerts/unsubscribe?token={saved.unsubscribe_token}"),
                    description,
                ),
            )
        if saved.phone:
            lines = [f"Nagpur Realty Hub: {len(matches)} new match(es)"
                     + (f" ({description})" if description else "") + ":"]
            for prop in matches[:5]:
                lines.append(f"- {prop.title} - {prop.location}")
            send_whatsapp_async(saved.phone, "\n".join(lines))

        saved.last_notified_at = now
        notified += 1
        total_matches += len(matches)

    db.session.commit()
    return jsonify({
        "status": "ok",
        "searches": len(saved_searches),
        "notified": notified,
        "matches": total_matches,
    })


@cron_bp.route("/retention/cleanup", methods=["POST"])
def cron_retention_cleanup():
    ok, err = _check_cron_key()
    if not ok:
        return jsonify({"error": err}), 401

    from routes.settings_routes import get_setting_int

    days = get_setting_int("data_retention_days", 365)
    if days <= 0:
        return jsonify({"status": "ok", "skipped": True, "reason": "retention disabled", "days": days})

    cutoff = datetime.utcnow() - timedelta(days=days)

    # Connect/enquiry requests carry visitor PII in dedicated tables -> hard delete.
    contacts_deleted = PropertyContact.query.filter(
        PropertyContact.created_at < cutoff
    ).delete(synchronize_session=False)

    messages_deleted = Contactus.query.filter(
        Contactus.created_at < cutoff
    ).delete(synchronize_session=False)

    # Leads are kept for pipeline analytics -> anonymize personal fields only.
    leads_anonymized = Lead.query.filter(
        Lead.created_at < cutoff,
        db.or_(Lead.email.isnot(None), Lead.mobile.isnot(None), Lead.notes.isnot(None),
               Lead.name != "Redacted"),
    ).update(
        {
            Lead.name: "Redacted",
            Lead.email: None,
            Lead.mobile: None,
            Lead.notes: None,
        },
        synchronize_session=False,
    )

    consents_deleted = ConsentRecord.query.filter(
        ConsentRecord.created_at < cutoff
    ).delete(synchronize_session=False)

    # Revoked-token rows are only needed until the token itself would expire.
    blocklist_purge_before = datetime.utcnow() - timedelta(days=2)
    blocklist_deleted = TokenBlocklist.query.filter(
        TokenBlocklist.created_at < blocklist_purge_before
    ).delete(synchronize_session=False)

    db.session.commit()
    return jsonify({
        "status": "ok",
        "days": days,
        "cutoff": cutoff.isoformat(),
        "property_contacts_deleted": contacts_deleted,
        "contact_messages_deleted": messages_deleted,
        "leads_anonymized": leads_anonymized,
        "consent_records_deleted": consents_deleted,
        "blocklist_purged": blocklist_deleted,
    })
