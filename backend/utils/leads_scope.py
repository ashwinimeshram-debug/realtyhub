from extensions import db
from models.models import Lead, Property


def internal_lead_condition():
    """SQL condition selecting leads that belong to the staff/internal pipeline.

    A lead is internal when it is not tied to an owner-posted property. Leads
    with no property (manual/website leads) are treated as internal. Leads on
    owner-posted properties are managed by the owner in the owner portal and are
    deliberately kept out of every staff view.
    """
    return db.or_(
        Lead.property_id.is_(None),
        Lead.property.has(Property.owner_id.is_(None)),
    )


def is_owner_posted_lead(lead):
    """True when the lead belongs to a property posted by a registered owner."""
    prop = lead.property if lead and lead.property_id else None
    return bool(prop is not None and prop.owner_id is not None)


CLOSED_STATUSES = ("WON", "LOST", "NOT_INTERESTED")


def closed_lead_condition():
    """SQL condition selecting leads that are closed/won/lost/archived.

    Closed leads must not appear in the active or unassigned work queues.
    """
    return db.or_(
        Lead.stage == "CLOSED",
        Lead.lead_status.in_(CLOSED_STATUSES),
        Lead.archived_at.isnot(None),
    )


def is_closed_lead(lead):
    """Python equivalent of :func:`closed_lead_condition` for a loaded lead."""
    if lead is None:
        return False
    if (lead.stage or "").upper() == "CLOSED":
        return True
    if (lead.lead_status or "").upper() in CLOSED_STATUSES:
        return True
    return lead.archived_at is not None
