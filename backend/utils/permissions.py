from functools import wraps

from flask import abort
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db

# Permission catalog — each entry becomes a row in the permissions table.
# `module` groups permissions in the RBAC matrix UI.
PERMISSION_CATALOG = [
    {"code": "properties.view", "label": "View properties", "module": "Properties", "description": "See property listings"},
    {"code": "properties.create", "label": "Create properties", "module": "Properties", "description": "Add new property listings"},
    {"code": "properties.edit", "label": "Edit properties", "module": "Properties", "description": "Edit any property listing"},
    {"code": "properties.delete", "label": "Delete properties", "module": "Properties", "description": "Delete property listings"},
    {"code": "properties.approve", "label": "Approve / reject listings", "module": "Properties", "description": "Approve, reject or feature properties"},
    {"code": "properties.manage_own", "label": "Manage own listings", "module": "Properties", "description": "View, edit and close properties they uploaded and track their leads"},
    {"code": "leads.view", "label": "View leads", "module": "Leads", "description": "Access the leads module (non-admins see their assigned leads)"},
    {"code": "leads.update", "label": "Update leads", "module": "Leads", "description": "Edit lead details, status and notes"},
    {"code": "leads.assign", "label": "Assign leads", "module": "Leads", "description": "Reassign or claim leads"},
    {"code": "leads.export", "label": "Export leads", "module": "Leads", "description": "Export lead data"},
    {"code": "leads.delete", "label": "Delete leads", "module": "Leads", "description": "Delete lead records"},
    {"code": "leads.auto_assign", "label": "Receive auto-assigned leads", "module": "Leads", "description": "New inbound leads are round-robin assigned to users with this permission"},
    {"code": "analytics.view", "label": "View analytics", "module": "Analytics", "description": "See platform analytics and traffic"},
    {"code": "reports.view", "label": "View reports", "module": "Reports", "description": "See lead/property reports"},
    {"code": "contacts.manage", "label": "Manage contact requests", "module": "Contacts", "description": "View and handle enquiry/contact form submissions"},
    {"code": "messages.view", "label": "View messages", "module": "Messages", "description": "See visitor messages"},
    {"code": "messages.manage", "label": "Handle messages", "module": "Messages", "description": "Reply to or resolve visitor messages"},
    {"code": "cms.manage", "label": "Manage CMS", "module": "CMS", "description": "Edit hero, services, testimonials, FAQ and other site content"},
    {"code": "pages.manage", "label": "Manage pages", "module": "Pages", "description": "Edit about/terms/privacy page content"},
    {"code": "templates.manage", "label": "Manage templates", "module": "Templates", "description": "Edit description templates for listings"},
    {"code": "media.manage", "label": "Manage gallery", "module": "Media", "description": "Upload and manage gallery media"},
    {"code": "teams.manage", "label": "Manage team", "module": "Team", "description": "Edit the team members directory"},
    {"code": "users.manage", "label": "Manage staff users", "module": "Users", "description": "Create, edit and deactivate staff accounts"},
    {"code": "owners.manage", "label": "Manage registered users", "module": "Users", "description": "View, activate/deactivate and delete registered (public) user accounts"},
    {"code": "roles.manage", "label": "Manage roles & permissions", "module": "Users", "description": "Create roles and edit the permission matrix"},
    {"code": "settings.manage", "label": "Manage settings", "module": "Settings", "description": "Edit platform settings and lead routing options"},
    {"code": "payments.manage", "label": "Manage payments", "module": "Payments", "description": "View listing transactions and mark payments as paid or waived"},
    {"code": "alerts.manage", "label": "Manage search alerts", "module": "Alerts", "description": "View guest and registered saved-search alert subscriptions and who receives price/area alerts"},
]

# Default roles and the permission codes granted to each. `admin` always has
# implicit full access; the matrix is overridable by an admin in the RBAC UI.
ROLE_MATRIX = {
    "admin": {
        "name": "Admin",
        "description": "Full platform control — all permissions",
        "is_system": True,
        "permissions": [p["code"] for p in PERMISSION_CATALOG],
    },
    "agent": {
        "name": "Agent / Sales Executive",
        "description": "Manages assigned leads and the sales pipeline",
        "is_system": True,
        "permissions": [
            "properties.view", "leads.view", "leads.update", "leads.assign",
            "leads.export", "leads.auto_assign", "analytics.view", "messages.view",
        ],
    },
    "builder": {
        "name": "Builder / Developer",
        "description": "Lists own project inventory and tracks project enquiries",
        "is_system": True,
        "permissions": [
            "properties.view", "properties.create", "properties.edit",
            "properties.manage_own", "leads.view",
        ],
    },
    "broker": {
        "name": "Broker / Channel Partner",
        "description": "External partner — views listings to refer buyers/renters",
        "is_system": True,
        "permissions": ["properties.view"],
    },
    "telecaller": {
        "name": "Telecaller / Inside Sales",
        "description": "Qualifies inbound leads, books appointments, hands off to agents",
        "is_system": True,
        "permissions": [
            "properties.view", "leads.view", "leads.update", "leads.auto_assign",
            "contacts.manage", "messages.view",
        ],
    },
    "deo": {
        "name": "DEO (Data Entry Operator)",
        "description": "Enters and maintains property listing data",
        "is_system": True,
        "permissions": ["properties.view", "properties.create", "properties.edit"],
    },
    "back_office": {
        "name": "Back Office Executive",
        "description": "Handles support, leads follow-up and reports",
        "is_system": True,
        "permissions": [
            "properties.view", "leads.view", "leads.update", "leads.export",
            "analytics.view", "reports.view", "contacts.manage", "messages.view",
        ],
    },
}


def current_admin():
    """Return the Admin for the current JWT identity (must be numeric/admin)."""
    ident = get_jwt_identity()
    if ident is None:
        return None
    try:
        from models.models import Admin
        return Admin.query.get(int(ident))
    except (ValueError, TypeError):
        return None


def is_admin(admin):
    if not admin:
        return False
    if not admin.is_active:
        return False
    slug = admin.role or "admin"
    if admin.role_obj:
        slug = admin.role_obj.slug
    return slug == "admin"


def has_permission(admin, code):
    if not admin or not admin.is_active:
        return False
    if is_admin(admin):
        return True
    if not admin.role_obj:
        return False
    return any(p.code == code for p in admin.role_obj.permissions)


def admin_permissions(admin):
    """Return the set of permission codes for an admin (admin role -> all catalog)."""
    codes = {p["code"] for p in PERMISSION_CATALOG}
    if not admin:
        return set()
    if is_admin(admin):
        return codes
    if not admin.role_obj:
        return set()
    return {p.code for p in admin.role_obj.permissions}


def require_permission(code):
    """Decorator: require an authenticated staff user with `code` permission."""

    def decorator(fn):
        @wraps(fn)
        @jwt_required()
        def wrapper(*args, **kwargs):
            admin = current_admin()
            if not has_permission(admin, code):
                abort(403, description="Permission denied")
            return fn(*args, **kwargs)
        return wrapper

    return decorator


def seed_rbac():
    """Idempotently seed roles, permissions and per-role grants."""
    from models.models import Admin, Role, Permission

    perm_map = {p.code: p for p in Permission.query.all()}
    for item in PERMISSION_CATALOG:
        perm = perm_map.get(item["code"])
        if not perm:
            perm = Permission(
                code=item["code"], label=item["label"],
                module=item["module"], description=item.get("description", ""))
            db.session.add(perm)
            perm_map[item["code"]] = perm
        else:
            perm.label, perm.module = item["label"], item["module"]
            perm.description = item.get("description", perm.description)
    db.session.flush()

    role_map = {r.slug: r for r in Role.query.all()}
    for i, (slug, cfg) in enumerate(ROLE_MATRIX.items()):
        role = role_map.get(slug)
        if not role:
            role = Role(name=cfg["name"], slug=slug, description=cfg["description"],
                        is_system=cfg.get("is_system", True), sort_order=i)
            db.session.add(role)
            db.session.flush()
            role_map[slug] = role
        else:
            role.name = cfg["name"]
            role.description = cfg["description"]
            role.sort_order = i
        granted = [perm_map[c] for c in cfg["permissions"] if c in perm_map]
        role.permissions = granted
    db.session.flush()

    # Link every existing admin to a role by their legacy role string.
    # Old platforms used two string roles: admin and power_user.
    LEGACY_ROLE = {None: "admin", "": "admin", "admin": "admin", "power_user": "agent"}
    for a in Admin.query.all():
        legacy = LEGACY_ROLE.get(a.role, a.role) or "admin"
        target = role_map.get(legacy) or role_map.get("admin")
        current_slug = a.role_obj.slug if a.role_obj else None
        if target and current_slug != target.slug:
            a.role_id = target.id
            a.role = target.slug
    db.session.commit()