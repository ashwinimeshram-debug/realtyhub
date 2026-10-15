from flask import Blueprint, request, jsonify, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from extensions import db
from models.models import Lead, LeadStatus, LeadHistory, PropertyContact, Admin, Property
from sqlalchemy import func
from datetime import datetime, timedelta
from utils.helpers import paginate
from utils.permissions import has_permission
from utils.sla import apply_sla, mark_first_response

leads_bp = Blueprint("leads", __name__)


def _get_executives():
    """Staff users whose role has the leads.auto_assign permission."""
    return [a for a in Admin.query.filter(Admin.is_active == True).all()
            if has_permission(a, "leads.auto_assign")]


def _least_loaded_executive(executives, lead_count_map=None):
    """Return the executive with the fewest assigned leads."""
    if lead_count_map is None:
        lead_count_map = {}
        if executives:
            exec_ids = [e.id for e in executives]
            counts = db.session.query(
                Lead.assigned_to, func.count(Lead.id)
            ).filter(
                Lead.assigned_to.in_(exec_ids)
            ).group_by(Lead.assigned_to).all()
            lead_count_map = {uid: cnt for uid, cnt in counts}
    best = None
    best_count = -1
    for e in executives:
        count = lead_count_map.get(e.id, 0)
        if best is None or count < best_count:
            best = e
            best_count = count
    return best


def _auto_assign_lead(lead):
    """If auto_assign_leads setting is true, assign the lead to the least-loaded executive."""
    from models.setting_model import Setting
    setting = Setting.query.filter_by(skey="auto_assign_leads").first()
    if not setting or setting.svalue != "true":
        return
    if lead.assigned_to is not None:
        return
    executives = _get_executives()
    if not executives:
        return
    target = _least_loaded_executive(executives)
    if target:
        lead.assigned_to = target.id
        new_status = LeadStatus.query.filter_by(name="New").first()
        if new_status and not lead.status:
            lead.status = new_status.id


def _followup_date_for_lead(lead_id, followup_map=None):
    if followup_map is not None:
        return followup_map.get(lead_id)
    last = LeadHistory.query.filter(
        LeadHistory.lead_id == lead_id, LeadHistory.followup_date.isnot(None)
    ).order_by(LeadHistory.followup_date.desc()).first()
    return last.followup_date.isoformat() if last and last.followup_date else None


def _build_admin_map(admin_ids):
    if not admin_ids:
        return {}
    admins = Admin.query.filter(Admin.id.in_(admin_ids)).all()
    return {a.id: (a.name or a.username) for a in admins}


def _lead_dict(l, admin_map=None, followup_map=None):
    assigned_name = None
    if l.assigned_to:
        if admin_map is not None:
            assigned_name = admin_map.get(l.assigned_to)
        else:
            admin = Admin.query.get(l.assigned_to)
            assigned_name = (admin.name or admin.username) if admin else None
    return {
        "id": l.id, "name": l.name, "email": l.email, "mobile": l.mobile,
        "source": l.source, "current_status_id": l.status,
        "status_name": l.status_obj.name if l.status_obj else None,
        "status_color": l.status_obj.color if l.status_obj else None,
        "property_id": l.property_id,
        "property_title": l.property.title if l.property else None,
        "follow_up_date": _followup_date_for_lead(l.id, followup_map) or (l.follow_up_at.isoformat() if l.follow_up_at else None),
        "assigned_to": l.assigned_to,
        "assigned_name": assigned_name,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "stage": l.stage,
        "lead_status": l.lead_status,
        "rejection_reason": l.rejection_reason,
        "archived_at": l.archived_at.isoformat() if l.archived_at else None,
        "notes": l.notes,
        "first_response_at": l.first_response_at.isoformat() if l.first_response_at else None,
        "sla_due_at": l.sla_due_at.isoformat() if l.sla_due_at else None,
        "sla_overdue": bool(
            l.sla_due_at is not None
            and l.first_response_at is None
            and l.sla_due_at < datetime.utcnow()
        ),
    }


def _get_current_admin():
    admin_id = get_jwt_identity()
    if not admin_id:
        return None
    return Admin.query.get(int(admin_id))


def _require_admin():
    admin = _get_current_admin()
    if not admin or admin.role != "admin":
        return False
    return True


def _perm(code):
    admin = _get_current_admin()
    if not has_permission(admin, code):
        abort(403, description="Permission denied")
    return admin


def _can_access_lead(lead, admin):
    """Admins see all leads; owners of a listing (manage_own) see their own
    property leads; everyone else sees only leads assigned to them."""
    if not admin:
        return False
    if admin.role_obj and admin.role_obj.slug == "admin":
        return True
    if has_permission(admin, "properties.manage_own") and lead.property and lead.property.uploaded_by == admin.id:
        return True
    if lead.assigned_to is None and has_permission(admin, "leads.update"):
        return True
    return lead.assigned_to == admin.id


def _lead_scope(allowed_admin):
    """Builder-aware non-admin lead scope (assigned to me, or on my listings)."""
    uid = int(get_jwt_identity())
    if has_permission(allowed_admin, "properties.manage_own"):
        return db.or_(
            Lead.assigned_to == uid,
            Lead.property.has(Property.uploaded_by == uid),
        )
    return Lead.assigned_to == uid


def _lead_detail_dict(l):
    d = _lead_dict(l)
    admin = Admin.query.get(l.assigned_to) if l.assigned_to else None
    d["assigned_name"] = (admin.name or admin.username) if admin else None

    history = LeadHistory.query.filter_by(lead_id=l.id).order_by(LeadHistory.created_at.desc()).all()
    d["history"] = []
    for h in history:
        new_status = LeadStatus.query.get(h.status) if h.status else None
        creator = Admin.query.get(h.created_by) if h.created_by else None
        d["history"].append({
            "id": h.id,
            "previous_status": None,
            "new_status": new_status.name if new_status else None,
            "remarks": h.remarks,
            "interaction_type": h.type,
            "follow_up_date": h.followup_date.isoformat() if h.followup_date else None,
            "created_by": h.created_by,
            "created_by_name": (creator.name or creator.username) if creator else None,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        })
    return d


# =========================
# GET ALL LEADS
# =========================
@leads_bp.route("/admin/leads", methods=["GET"])
@jwt_required()
def get_leads():
    _perm("leads.view")
    status = request.args.get("status")
    source = request.args.get("source")
    assigned_to = request.args.get("assigned_to")
    user_id = request.args.get("user_id")
    stage = request.args.get("stage")
    include_archived = request.args.get("archived", "").lower() == "true"

    admin_id = get_jwt_identity()
    current_admin = Admin.query.get(int(admin_id))
    is_admin = current_admin and current_admin.role == "admin"

    query = Lead.query

    # Non-admins default to their assigned leads (builders also see own-listing leads);
    # scope=unassigned surfaces the open lead pool so staff can claim leads.
    if not is_admin:
        if request.args.get("scope") == "unassigned":
            query = query.filter(Lead.assigned_to.is_(None))
        else:
            query = query.filter(_lead_scope(current_admin))
    elif user_id:
        try:
            query = query.filter_by(assigned_to=int(user_id))
        except (ValueError, TypeError):
            pass
    elif assigned_to:
        try:
            query = query.filter_by(assigned_to=int(assigned_to))
        except (ValueError, TypeError):
            pass

    if status:
        try:
            query = query.filter_by(status=int(status))
        except (ValueError, TypeError):
            pass
    if source:
        query = query.filter_by(source=source)
    if stage:
        query = query.filter_by(stage=stage)

    # Default: exclude archived unless explicitly requested
    if not include_archived:
        query = query.filter(Lead.archived_at.is_(None))

    leads, total, page, per_page = paginate(query.order_by(Lead.created_at.desc()), request.args.get("page", 1), request.args.get("per_page", 200))

    admin_ids = {l.assigned_to for l in leads if l.assigned_to}
    admin_map = _build_admin_map(admin_ids)

    lead_ids = [l.id for l in leads]
    followups = db.session.query(
        LeadHistory.lead_id,
        func.max(LeadHistory.followup_date).label("max_followup")
    ).filter(
        LeadHistory.lead_id.in_(lead_ids), LeadHistory.followup_date.isnot(None)
    ).group_by(LeadHistory.lead_id).all()
    followup_map = {f[0]: f[1].isoformat() for f in followups}

    return jsonify({
        "items": [_lead_dict(l, admin_map=admin_map, followup_map=followup_map) for l in leads],
        "total": total,
        "page": page,
        "per_page": per_page,
    })


# =========================
# GET SINGLE LEAD
# =========================
@leads_bp.route("/admin/leads/<int:id>", methods=["GET"])
@jwt_required()
def get_lead(id):
    _perm("leads.view")
    lead = Lead.query.get(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    if not _can_access_lead(lead, _get_current_admin()):
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(_lead_detail_dict(lead))


# =========================
# CREATE LEAD
# =========================
@leads_bp.route("/admin/leads", methods=["POST"])
@jwt_required()
def create_lead():
    _perm("leads.update")
    data = request.json
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Name is required"}), 400
    lead = Lead(name=name, email=data.get("email"), mobile=data.get("mobile"),
                source=data.get("source", "website"), property_id=data.get("property_id"),
                status=data.get("status"))
    apply_sla(lead)
    db.session.add(lead)
    db.session.commit()
    _auto_assign_lead(lead)
    db.session.commit()
    return jsonify({"message": "Lead created", "id": lead.id}), 201


# =========================
# ASSIGN LEAD
# =========================
@leads_bp.route("/admin/leads/<int:id>/assign", methods=["POST"])
@jwt_required()
def assign_lead(id):
    admin = _get_current_admin()
    lead = Lead.query.get(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    data = request.json or {}
    user_id = data.get("user_id")
    if has_permission(admin, "leads.assign"):
        lead.assigned_to = user_id if user_id else None
    else:
        # Staff can only claim an unassigned lead for themselves
        if not has_permission(admin, "leads.update"):
            abort(403, description="Permission denied")
        if lead.assigned_to is not None:
            return jsonify({"error": "Lead is already assigned"}), 400
        if not user_id or int(user_id) != admin.id:
            return jsonify({"error": "You can only claim leads for yourself"}), 403
        lead.assigned_to = admin.id
    db.session.commit()

    new_status = LeadStatus.query.filter_by(name="New").first()
    if new_status and not lead.status:
        lead.status = new_status.id
        db.session.commit()

    return jsonify({"message": "Lead assigned"})


# =========================
# AUTO-ASSIGN LEADS
# =========================
@leads_bp.route("/admin/leads/auto-assign", methods=["POST"])
@jwt_required()
def auto_assign():
    _perm("leads.assign")
    data = request.json or {}
    lead_ids = data.get("lead_ids", [])
    executives = _get_executives()
    if not executives:
        return jsonify({"message": "No executives available"}), 400

    query = Lead.query.filter(Lead.assigned_to.is_(None))
    if lead_ids:
        query = query.filter(Lead.id.in_(lead_ids))

    unassigned = query.all()
    if not unassigned:
        return jsonify({"message": "No unassigned leads"}), 200

    lead_count_map = {}
    exec_ids = [e.id for e in executives]
    counts = db.session.query(
        Lead.assigned_to, func.count(Lead.id)
    ).filter(
        Lead.assigned_to.in_(exec_ids)
    ).group_by(Lead.assigned_to).all()
    lead_count_map = {uid: cnt for uid, cnt in counts}

    new_status = LeadStatus.query.filter_by(name="New").first()
    for lead in unassigned:
        target = _least_loaded_executive(executives, lead_count_map)
        lead.assigned_to = target.id
        lead_count_map[target.id] = lead_count_map.get(target.id, 0) + 1
        if new_status and not lead.status:
            lead.status = new_status.id

    db.session.commit()
    return jsonify({"message": f"Assigned {len(unassigned)} leads"})


# =========================
# ADD INTERACTION
# =========================
@leads_bp.route("/admin/leads/<int:id>/interactions", methods=["POST"])
@jwt_required()
def add_interaction(id):
    _perm("leads.update")
    lead = Lead.query.get(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    if not _can_access_lead(lead, _get_current_admin()):
        return jsonify({"error": "Forbidden"}), 403
    data = request.json

    followup_date = None
    if data.get("follow_up_date"):
        try:
            followup_date = datetime.fromisoformat(data["follow_up_date"].replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            try:
                followup_date = datetime.strptime(data["follow_up_date"], "%Y-%m-%dT%H:%M")
            except (ValueError, TypeError):
                pass

    history = LeadHistory(
        lead_id=id,
        status=data.get("status_id") or data.get("status"),
        type=data.get("interaction_type") or data.get("type"),
        remarks=data.get("remarks"),
        followup_date=followup_date,
        created_by=int(get_jwt_identity()),
    )
    db.session.add(history)
    mark_first_response(lead)
    if data.get("status_id") or data.get("status"):
        lead.status = data.get("status_id") or data["status"]
    if data.get("follow_up_date") and followup_date:
        lead.follow_up_at = followup_date
    if data.get("stage"):
        lead.stage = data["stage"]
    if data.get("lead_status"):
        lead.lead_status = data["lead_status"]
    db.session.commit()
    return jsonify({"message": "Interaction added"}), 201


# =========================
# UPDATE LEAD STAGE (drag-drop)
# =========================
@leads_bp.route("/admin/leads/<int:id>/stage", methods=["PATCH"])
@jwt_required()
def update_lead_stage(id):
    _perm("leads.update")
    lead = Lead.query.get(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    if not _can_access_lead(lead, _get_current_admin()):
        return jsonify({"error": "Forbidden"}), 403
    data = request.json
    if "stage" in data:
        lead.stage = data["stage"]
    if "lead_status" in data:
        lead.lead_status = data["lead_status"]
    if lead.stage and lead.stage.upper() != "NEW":
        mark_first_response(lead)
    if "follow_up_at" in data:
        if data["follow_up_at"]:
            try:
                lead.follow_up_at = datetime.fromisoformat(data["follow_up_at"].replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass
        else:
            lead.follow_up_at = None
    db.session.commit()
    db.session.add(LeadHistory(
        lead_id=id, type="System Note",
        remarks=f"Stage changed to {lead.stage}",
        created_by=int(get_jwt_identity()),
    ))
    db.session.commit()
    return jsonify({"message": "Stage updated", "stage": lead.stage})


# =========================
# NOT INTERESTED (modal with reason)
# =========================
@leads_bp.route("/admin/leads/<int:id>/not-interested", methods=["POST"])
@jwt_required()
def mark_not_interested(id):
    _perm("leads.update")
    lead = Lead.query.get(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    if not _can_access_lead(lead, _get_current_admin()):
        return jsonify({"error": "Forbidden"}), 403
    data = request.json
    lead.stage = "CLOSED"
    lead.lead_status = "NOT_INTERESTED"
    lead.rejection_reason = data.get("reason")
    lead.notes = data.get("notes")
    lead.archived_at = datetime.utcnow()
    db.session.commit()
    db.session.add(LeadHistory(
        lead_id=id, type="System Note",
        remarks=f"Marked as Not Interested. Reason: {data.get('reason', 'N/A')} - {data.get('notes', '')}",
        created_by=int(get_jwt_identity()),
    ))
    db.session.commit()
    return jsonify({"message": "Lead archived"}), 200


# =========================
# REOPEN LEAD (unarchive)
# =========================
@leads_bp.route("/admin/leads/<int:id>/reopen", methods=["POST"])
@jwt_required()
def reopen_lead(id):
    _perm("leads.update")
    lead = Lead.query.get(id)
    if not lead:
        return jsonify({"error": "Lead not found"}), 404
    if not _can_access_lead(lead, _get_current_admin()):
        return jsonify({"error": "Forbidden"}), 403
    lead.stage = "NEW"
    lead.lead_status = "ACTIVE"
    lead.archived_at = None
    lead.rejection_reason = None
    db.session.commit()
    db.session.add(LeadHistory(
        lead_id=id, type="System Note",
        remarks="Lead reopened from archive",
        created_by=int(get_jwt_identity()),
    ))
    db.session.commit()
    return jsonify({"message": "Lead reopened"}), 200


# =========================
# ARCHIVED LEADS (searchable)
# =========================
@leads_bp.route("/admin/leads/archived", methods=["GET"])
@jwt_required()
def get_archived_leads():
    _perm("leads.view")
    search = request.args.get("search", "").strip()
    status_filter = request.args.get("status", "").strip()

    admin_id = get_jwt_identity()
    current_admin = Admin.query.get(int(admin_id))
    is_admin = current_admin and current_admin.role == "admin"

    query = Lead.query.filter(Lead.archived_at.isnot(None))

    if not is_admin:
        query = query.filter(_lead_scope(current_admin))

    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(Lead.name.ilike(like), Lead.email.ilike(like), Lead.mobile.ilike(like))
        )
    if status_filter:
        query = query.filter_by(lead_status=status_filter)

    leads = query.order_by(Lead.archived_at.desc()).all()
    admin_ids = {l.assigned_to for l in leads if l.assigned_to}
    admin_map = _build_admin_map(admin_ids)

    return jsonify({
        "items": [_lead_dict(l, admin_map=admin_map) for l in leads],
        "total": len(leads),
    })


# =========================
# LEAD STATUSES
# =========================
@leads_bp.route("/admin/lead-statuses", methods=["GET"])
@jwt_required()
def get_statuses():
    statuses = LeadStatus.query.filter_by(is_active=True).order_by(LeadStatus.sort_order).all()
    return jsonify([{"id": s.id, "name": s.name, "color": s.color, "sort_order": s.sort_order} for s in statuses])


@leads_bp.route("/admin/lead-statuses", methods=["POST"])
@jwt_required()
def create_status():
    if not _require_admin():
        return jsonify({"error": "Forbidden"}), 403
    data = request.json
    status = LeadStatus(name=data.get("name"), color=data.get("color", "#3b82f6"), sort_order=data.get("sort_order", 0))
    db.session.add(status)
    db.session.commit()
    return jsonify({"id": status.id, "name": status.name, "color": status.color, "sort_order": status.sort_order}), 201


@leads_bp.route("/admin/lead-statuses/<int:id>", methods=["PUT"])
@jwt_required()
def update_status(id):
    if not _require_admin():
        return jsonify({"error": "Forbidden"}), 403
    status = LeadStatus.query.get_or_404(id)
    data = request.json
    status.name = data.get("name", status.name)
    status.color = data.get("color", status.color)
    status.sort_order = data.get("sort_order", status.sort_order)
    db.session.commit()
    return jsonify({"id": status.id, "name": status.name, "color": status.color, "sort_order": status.sort_order})


@leads_bp.route("/admin/lead-statuses/<int:id>", methods=["DELETE"])
@jwt_required()
def delete_status(id):
    if not _require_admin():
        return jsonify({"error": "Forbidden"}), 403
    status = LeadStatus.query.get_or_404(id)
    lead_count = Lead.query.filter_by(status=id).count()
    if lead_count > 0:
        return jsonify({"error": f"Cannot delete: {lead_count} lead(s) are using this status"}), 400
    db.session.delete(status)
    db.session.commit()
    return jsonify({"message": "Status deleted"})


@leads_bp.route("/admin/lead-statuses/reorder", methods=["POST"])
@jwt_required()
def reorder_statuses():
    if not _require_admin():
        return jsonify({"error": "Forbidden"}), 403
    data = request.json
    for item in data:
        s = LeadStatus.query.get(item["id"])
        if s:
            s.sort_order = item["sort_order"]
    db.session.commit()
    return jsonify({"message": "Reordered"})


# =========================
# LEAD STATS
# =========================
@leads_bp.route("/admin/leads/stats", methods=["GET"])
@jwt_required()
def lead_stats():
    _perm("leads.view")
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    admin_id = get_jwt_identity()
    current_admin = Admin.query.get(int(admin_id))
    is_admin = current_admin and current_admin.role == "admin"

    base_query = Lead.query
    user_id = request.args.get("user_id")

    if not is_admin:
        base_query = base_query.filter(_lead_scope(current_admin))
    elif user_id:
        try:
            base_query = base_query.filter_by(assigned_to=int(user_id))
        except (ValueError, TypeError):
            pass

    new_today = base_query.filter(
        Lead.created_at >= today_start, Lead.archived_at.is_(None)
    ).count()

    site_visits = base_query.filter_by(stage="SITE_VISIT").count()

    won_month = base_query.filter(
        Lead.stage == "CLOSED", Lead.lead_status == "WON",
        Lead.updated_at >= month_start
    ).count()

    lost_month = base_query.filter(
        Lead.stage == "CLOSED", Lead.lead_status == "NOT_INTERESTED",
        Lead.updated_at >= month_start
    ).count()

    followups_overdue = base_query.filter(
        Lead.follow_up_at.isnot(None),
        Lead.follow_up_at < today_start
    ).count()

    followups_today = base_query.filter(
        Lead.follow_up_at.isnot(None),
        Lead.follow_up_at >= today_start,
        Lead.follow_up_at < today_end
    ).count()

    followups_upcoming = base_query.filter(
        Lead.follow_up_at.isnot(None),
        Lead.follow_up_at >= today_end,
        Lead.follow_up_at <= now + timedelta(days=7)
    ).count()

    no_action = base_query.filter_by(stage="NEW", archived_at=None).count()

    sla_overdue = base_query.filter(
        Lead.first_response_at.is_(None),
        Lead.sla_due_at.isnot(None),
        Lead.sla_due_at < now,
        Lead.lead_status == "ACTIVE",
        Lead.archived_at.is_(None),
    ).count()

    return jsonify({
        "new_today": new_today,
        "site_visits": site_visits,
        "followups_overdue": followups_overdue,
        "followups_today": followups_today,
        "followups_upcoming": followups_upcoming,
        "won_month": won_month,
        "lost_month": lost_month,
        "no_action": no_action,
        "sla_overdue": sla_overdue,
    })


# =========================
# FOLLOWUPS
# =========================
@leads_bp.route("/admin/leads/followups", methods=["GET"])
@jwt_required()
def get_followups():
    _perm("leads.view")
    now = datetime.utcnow()
    admin_id = get_jwt_identity()
    current_admin = Admin.query.get(int(admin_id))
    is_admin = current_admin and current_admin.role == "admin"
    can_manage_own = has_permission(current_admin, "properties.manage_own")

    upcoming = LeadHistory.query.filter(
        LeadHistory.followup_date.isnot(None),
        LeadHistory.followup_date >= now - timedelta(days=90)
    ).order_by(LeadHistory.followup_date.asc()).limit(500).all()

    results = []
    for h in upcoming:
        lead = Lead.query.get(h.lead_id)
        if not lead:
            continue
        # Non-admins only see their own follow-ups (or those on their listings)
        if not is_admin:
            if lead.assigned_to != int(admin_id) and not (
                can_manage_own and lead.property and lead.property.uploaded_by == int(admin_id)
            ):
                continue
        results.append({
            "id": h.id,
            "lead_id": h.lead_id,
            "type": h.type,
            "remarks": h.remarks,
            "followup_date": h.followup_date.isoformat() if h.followup_date else None,
            "lead_name": lead.name,
            "lead_mobile": lead.mobile,
            "lead_email": lead.email,
            "current_status_id": lead.status,
            "status_name": lead.status_obj.name if lead.status_obj else None,
            "status_color": lead.status_obj.color if lead.status_obj else None,
            "source": lead.source,
            "property_title": lead.property.title if lead.property else None,
            "stage": lead.stage,
            "lead_status": lead.lead_status,
        })
    return jsonify(results)


# =========================
# LEAD EXECUTIVES (for assignment dropdown)
# =========================
@leads_bp.route("/admin/leads/executives", methods=["GET"])
@jwt_required()
def get_executives():
    _perm("leads.assign")
    admins = Admin.query.filter(Admin.is_active == True).all()
    return jsonify([{
        "id": a.id,
        "display_name": a.name or a.username,
        "username": a.username,
    } for a in admins])


# =========================
# CREATE LEAD FROM CONTACT
# =========================
@leads_bp.route("/admin/leads/from-contact/<int:contact_id>", methods=["POST"])
@jwt_required()
def create_lead_from_contact(contact_id):
    _perm("leads.update")
    pc = PropertyContact.query.get(contact_id)
    if not pc:
        return jsonify({"error": "Contact not found"}), 404
    lead = Lead(name=pc.name, email=pc.email, mobile=pc.mobile,
                source="connect", property_id=pc.property_id)
    apply_sla(lead)
    db.session.add(lead)
    db.session.commit()
    _auto_assign_lead(lead)
    db.session.commit()
    return jsonify({"message": "Lead created", "id": lead.id}), 201
