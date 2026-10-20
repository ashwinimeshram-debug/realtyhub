from extensions import db
from models.models import Admin, LeadTransfer


def admin_display_name(admin_id):
    """Return the display name for an admin id, or None."""
    if not admin_id:
        return None
    admin = db.session.get(Admin, admin_id)
    return (admin.name or admin.username) if admin else None


def record_lead_transfer(lead, from_admin_id, to_admin_id, reason=None,
                         created_by=None, commit=False):
    """Append a transfer-history row for a lead ownership change.

    Names are snapshotted at write time so the audit trail survives deletion of
    the referenced admins. Only records a row when the assignee actually changes.
    """
    if lead is None:
        return None
    if from_admin_id == to_admin_id:
        return None
    transfer = LeadTransfer(
        lead_id=lead.id,
        from_admin_id=from_admin_id,
        to_admin_id=to_admin_id,
        from_admin_name=admin_display_name(from_admin_id),
        to_admin_name=admin_display_name(to_admin_id),
        reason=reason,
        created_by=created_by,
    )
    db.session.add(transfer)
    if commit:
        db.session.commit()
    return transfer
