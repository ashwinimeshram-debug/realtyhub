from datetime import datetime
from extensions import db


class Property(db.Model):
    __tablename__ = "properties"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    listing_id = db.Column(db.String(20), unique=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    transaction_type = db.Column(db.String(20))
    property_type = db.Column(db.String(50), nullable=False, default="flat")
    listed_by = db.Column(db.String(20), default="owner")
    rera_details = db.Column(db.String(255), nullable=True)
    price = db.Column(db.Numeric(12, 2))
    price_text = db.Column(db.String(50), default="*")
    location = db.Column(db.String(255), nullable=False)
    latitude = db.Column(db.Numeric(9, 6), nullable=True)
    longitude = db.Column(db.Numeric(9, 6), nullable=True)
    status = db.Column(db.String(20), default="pending")
    is_active = db.Column(db.Boolean, default=False)
    is_featured = db.Column(db.Boolean, default=False)
    is_verified = db.Column(db.Boolean, default=False)
    is_closed = db.Column(db.Boolean, default=False)
    overview_template_id = db.Column(db.Integer, db.ForeignKey("description_templates.id"), nullable=True)
    closing_template_id = db.Column(db.Integer, db.ForeignKey("description_templates.id"), nullable=True)
    title_template_id = db.Column(db.Integer, db.ForeignKey("description_templates.id"), nullable=True)
    selected_chips = db.Column(db.Text, nullable=True)
    uploaded_by = db.Column(db.Integer, db.ForeignKey("admins.id"), nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("owners.id"), nullable=True, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = db.Column(db.DateTime, nullable=True)

    # Paid-listing lifecycle. payment_status: unpaid | paid | waived
    # (waived = staff listing or free-listing promotion bypass).
    published_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    last_renewed_at = db.Column(db.DateTime, nullable=True)
    renewal_count = db.Column(db.Integer, default=0)
    featured_until = db.Column(db.DateTime, nullable=True)
    payment_status = db.Column(db.String(20), default="unpaid")

    property_contacts = db.relationship("PropertyContact", backref="property", lazy="dynamic", cascade="all, delete-orphan")
    images = db.relationship("PropertyImage", backref="property", lazy="selectin", cascade="all, delete-orphan",
                             order_by="PropertyImage.order")
    uploaded_admin = db.relationship("Admin", backref="uploaded_properties", lazy="joined", foreign_keys=[uploaded_by])
    owner = db.relationship("Owner", backref="properties", lazy="joined")
    features = db.relationship("PresetFeature", secondary="property_features", backref="properties", lazy="selectin")

    __table_args__ = (
        db.Index("idx_property_status_active", "status", "is_active"),
        db.Index("idx_property_featured", "is_featured"),
        db.Index("idx_property_location", "location"),
        db.Index("idx_property_created", "created_at"),
        db.Index("idx_property_uploaded_by", "uploaded_by"),
        db.Index("idx_property_price", "price"),
        db.Index("idx_property_geo", "latitude", "longitude"),
        db.Index("idx_property_expires", "expires_at"),
        db.Index("idx_property_featured_until", "featured_until"),
        db.Index("idx_property_payment_status", "payment_status"),
        db.Index(
            "idx_property_title_trgm", "title",
            postgresql_using="gin", postgresql_ops={"title": "gin_trgm_ops"},
        ),
        db.Index(
            "idx_property_location_trgm", "location",
            postgresql_using="gin", postgresql_ops={"location": "gin_trgm_ops"},
        ),
    )


class PropertyImage(db.Model):
    __tablename__ = "property_images"

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"))
    image_url = db.Column(db.String(500), nullable=False)
    order = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.Index("idx_property_images_composite", "property_id", "order"),
    )


class PropertyContact(db.Model):
    __tablename__ = "property_contacts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), nullable=True)
    mobile = db.Column(db.String(20), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("property_id", "type", name="uq_property_contact_type"),
        db.Index("idx_pc_property", "property_id"),
        db.Index("idx_pc_type", "type"),
    )


class Admin(db.Model):
    __tablename__ = "admins"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(20), unique=True, nullable=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(120), nullable=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="admin")
    phone = db.Column(db.String(20), nullable=True)
    whatsapp = db.Column(db.String(20), nullable=True)
    profile_image = db.Column(db.String(255), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    reset_token = db.Column(db.String(255), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)

    role_obj = db.relationship("Role", backref="admins", lazy="joined")


class Role(db.Model):
    __tablename__ = "roles"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    slug = db.Column(db.String(100), unique=True, nullable=False, index=True)
    description = db.Column(db.String(255), nullable=True)
    is_system = db.Column(db.Boolean, default=False)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    permissions = db.relationship("Permission", secondary="role_permissions",
                                  backref="roles", lazy="selectin")


class Permission(db.Model):
    __tablename__ = "permissions"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(100), unique=True, nullable=False, index=True)
    label = db.Column(db.String(150), nullable=False)
    module = db.Column(db.String(50), nullable=False, default="general")
    description = db.Column(db.String(255), nullable=True)


class RolePermission(db.Model):
    __tablename__ = "role_permissions"

    id = db.Column(db.Integer, primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = db.Column(db.Integer, db.ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (
        db.UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),
    )


class Owner(db.Model):
    __tablename__ = "owners"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    mobile = db.Column(db.String(20), nullable=True)
    password = db.Column(db.String(255), nullable=False)
    is_verified = db.Column(db.Boolean, default=False)
    verification_token = db.Column(db.String(255), nullable=True)
    verification_expiry = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    reset_token = db.Column(db.String(255), nullable=True)
    reset_token_expiry = db.Column(db.DateTime, nullable=True)


class SavedSearch(db.Model):
    __tablename__ = "saved_searches"

    id = db.Column(db.Integer, primary_key=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("owners.id", ondelete="CASCADE"), nullable=True, index=True)
    email = db.Column(db.String(150), nullable=True, index=True)
    phone = db.Column(db.String(20), nullable=True)
    name = db.Column(db.String(120), nullable=True)
    params = db.Column(db.Text, nullable=False, default="{}")
    notify = db.Column(db.Boolean, default=True)
    is_active = db.Column(db.Boolean, default=True)
    unsubscribe_token = db.Column(db.String(64), unique=True, index=True)
    last_notified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = db.relationship("Owner", backref="saved_searches", lazy="joined")

    __table_args__ = (
        db.Index("idx_saved_search_active", "is_active", "notify"),
    )


class TokenBlocklist(db.Model):
    """Revoked JWTs (logout / forced sign-out). Checked on every request."""

    __tablename__ = "token_blocklist"

    id = db.Column(db.Integer, primary_key=True)
    jti = db.Column(db.String(64), nullable=False, unique=True, index=True)
    token_type = db.Column(db.String(20), default="access")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index("idx_blocklist_created", "created_at"),
    )


class ConsentRecord(db.Model):
    """DPDP consent audit trail: who consented to what, when, and from where."""

    __tablename__ = "consent_records"

    id = db.Column(db.Integer, primary_key=True)
    subject_type = db.Column(db.String(20), nullable=False)  # visitor | owner
    subject_id = db.Column(db.Integer, nullable=True)
    email = db.Column(db.String(150), nullable=True)
    purpose = db.Column(db.String(50), nullable=False)  # enquiry | contact | registration
    version = db.Column(db.String(20), nullable=False)
    granted = db.Column(db.Boolean, default=True)
    ip = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index("idx_consent_email", "email"),
        db.Index("idx_consent_subject", "subject_type", "subject_id"),
        db.Index("idx_consent_created", "created_at"),
    )


class Lead(db.Model):
    __tablename__ = "leads"

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="SET NULL"), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150))
    mobile = db.Column(db.String(15))
    source = db.Column(db.String(50), default="website")
    status = db.Column(db.Integer, db.ForeignKey("lead_statuses.id"), nullable=True)
    assigned_to = db.Column(db.Integer, db.ForeignKey("admins.id"), nullable=True)
    stage = db.Column(db.String(20), default="NEW")
    lead_status = db.Column(db.String(20), default="ACTIVE")
    rejection_reason = db.Column(db.String(100), nullable=True)
    follow_up_at = db.Column(db.DateTime, nullable=True)
    archived_at = db.Column(db.DateTime, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    first_response_at = db.Column(db.DateTime, nullable=True)
    sla_due_at = db.Column(db.DateTime, nullable=True)
    sla_reminded_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    property = db.relationship("Property", backref="leads", lazy="joined")
    status_obj = db.relationship("LeadStatus", backref="leads", lazy="joined")
    history = db.relationship("LeadHistory", backref="lead", lazy="dynamic", cascade="all, delete-orphan")

    __table_args__ = (
        db.Index("idx_lead_property", "property_id"),
        db.Index("idx_lead_source", "source"),
        db.Index("idx_lead_status", "status"),
        db.Index("idx_lead_created", "created_at"),
        db.Index("idx_lead_stage", "stage"),
        db.Index("idx_lead_archived", "archived_at"),
        db.Index("idx_lead_sla_due", "sla_due_at"),
    )


class LeadStatus(db.Model):
    __tablename__ = "lead_statuses"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), nullable=False, unique=True)
    color = db.Column(db.String(7), default="#3b82f6")
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)


class LeadHistory(db.Model):
    __tablename__ = "lead_history"

    id = db.Column(db.Integer, primary_key=True)
    lead_id = db.Column(db.Integer, db.ForeignKey("leads.id", ondelete="CASCADE"))
    status = db.Column(db.Integer, db.ForeignKey("lead_statuses.id"), nullable=True)
    type = db.Column(db.String(50))
    remarks = db.Column(db.Text)
    followup_date = db.Column(db.DateTime, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey("admins.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index("idx_lead_history_lead", "lead_id"),
        db.Index("idx_lead_history_created", "created_at"),
    )


class Faq(db.Model):
    __tablename__ = "faqs"

    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.String(500), nullable=False)
    answer = db.Column(db.Text, nullable=False)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class PropertyType(db.Model):
    __tablename__ = "property_types"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(50), nullable=False, unique=True)
    category = db.Column(db.String(20), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)

    __table_args__ = (
        db.Index("idx_type_category_active", "category", "is_active"),
    )


class AboutGalleryImage(db.Model):
    __tablename__ = "about_gallery_images"

    id = db.Column(db.Integer, primary_key=True)
    image_url = db.Column(db.String(500), nullable=False)
    caption = db.Column(db.String(255))
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    is_featured = db.Column(db.Boolean, default=False)

    __table_args__ = (
        db.Index("idx_about_gallery_images_is_active", "is_active"),
    )


class TeamMember(db.Model):
    __tablename__ = "team_members"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    role = db.Column(db.String(100))
    photo = db.Column(db.String(255))
    bio = db.Column(db.Text)
    email = db.Column(db.String(150))
    social_links = db.Column(db.JSON)
    is_leader = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)


class PropertyTypeField(db.Model):
    __tablename__ = "property_type_fields"

    id = db.Column(db.Integer, primary_key=True)
    property_type_value = db.Column(db.String(50), nullable=False)
    field_key = db.Column(db.String(50), nullable=False)
    field_label = db.Column(db.String(100), nullable=False)
    field_label_mr = db.Column(db.String(100))
    field_label_hi = db.Column(db.String(100))
    field_type = db.Column(db.String(20), nullable=False)
    options = db.Column(db.JSON)
    unit_options = db.Column(db.JSON)
    placeholder = db.Column(db.String(255))
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    is_required = db.Column(db.Boolean, default=False)

    __table_args__ = (
        db.Index("idx_ptf_type_active", "property_type_value", "is_active"),
        db.UniqueConstraint("property_type_value", "field_key", name="uq_property_type_field"),
    )


class PropertyValue(db.Model):
    __tablename__ = "property_field_values"

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    field_key = db.Column(db.String(50), nullable=False)
    field_value = db.Column(db.String(500))

    __table_args__ = (
        db.Index("idx_pfv_property_key", "property_id", "field_key"),
    )


class DescriptionTemplate(db.Model):
    __tablename__ = "description_templates"

    id = db.Column(db.Integer, primary_key=True)
    category = db.Column(db.String(50), nullable=False)
    property_type = db.Column(db.String(50), nullable=True)
    template_text = db.Column(db.Text, nullable=False)
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.Index("idx_dt_category_active", "category", "is_active"),
        db.Index("idx_dt_type_active", "property_type", "is_active"),
    )


class PresetFeature(db.Model):
    __tablename__ = "preset_features"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    label = db.Column(db.String(100), nullable=False)
    sentence = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)


class PropertyFeature(db.Model):
    __tablename__ = "property_features"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    feature_id = db.Column(db.Integer, db.ForeignKey("preset_features.id", ondelete="CASCADE"), nullable=False)

    feature = db.relationship("PresetFeature", lazy="joined", overlaps="features,properties")

    __table_args__ = (
        db.UniqueConstraint("property_id", "feature_id", name="uq_property_feature"),
    )


class ActivityLog(db.Model):
    __tablename__ = "activity_log"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=True)
    action = db.Column(db.String(100), nullable=False)
    module = db.Column(db.String(50))
    target = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index("idx_activity_user", "user_id"),
        db.Index("idx_activity_module", "module"),
        db.Index("idx_activity_created", "created_at"),
    )


class PasswordResetRequest(db.Model):
    __tablename__ = "password_reset_requests"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_identifier = db.Column(db.String(120), nullable=False)
    user_name = db.Column(db.String(120), nullable=True)
    status = db.Column(db.String(20), default="pending")
    admin_note = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.Index("idx_prr_status", "status"),
        db.Index("idx_prr_identifier", "user_identifier"),
        db.Index("idx_prr_created", "created_at"),
    )


class PropertyAuditLog(db.Model):
    __tablename__ = "property_audit_log"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("admins.id", ondelete="CASCADE"), nullable=False)
    action = db.Column(db.String(50), nullable=False)
    user_name = db.Column(db.String(120), nullable=True)
    user_email = db.Column(db.String(150), nullable=True)
    user_mobile = db.Column(db.String(20), nullable=True)
    remarks = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("Admin", lazy="joined")

    __table_args__ = (
        db.Index("idx_pal_property", "property_id"),
        db.Index("idx_pal_user", "user_id"),
        db.Index("idx_pal_action", "action"),
        db.Index("idx_pal_created", "created_at"),
    )


class ListingTransaction(db.Model):
    """A payment/entitlement purchase for a listing or a featured boost.

    purpose: listing (listing validity) | featured (featured placement add-on).
    status:  pending | paid | failed | cancelled.
    method:  online (gateway) | manual (admin marked paid) | waived (comp).
    """

    __tablename__ = "listing_transactions"

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("owners.id", ondelete="SET NULL"), nullable=True, index=True)
    purpose = db.Column(db.String(20), nullable=False, default="listing")
    transaction_type = db.Column(db.String(20), nullable=True)
    amount = db.Column(db.Numeric(10, 2), nullable=False, default=0)
    currency = db.Column(db.String(8), default="INR")
    duration_days = db.Column(db.Integer, nullable=False, default=0)
    provider = db.Column(db.String(20), default="mock")
    provider_order_id = db.Column(db.String(120), nullable=True, unique=True, index=True)
    provider_payment_id = db.Column(db.String(120), nullable=True)
    status = db.Column(db.String(20), default="pending")
    method = db.Column(db.String(20), default="online")
    notes = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    paid_at = db.Column(db.DateTime, nullable=True)

    property = db.relationship("Property", backref="transactions", lazy="joined")
    owner = db.relationship("Owner", backref="listing_transactions", lazy="joined")

    __table_args__ = (
        db.Index("idx_ltxn_property", "property_id"),
        db.Index("idx_ltxn_status", "status"),
        db.Index("idx_ltxn_created", "created_at"),
    )


class ListingReminder(db.Model):
    """Idempotency ledger for lifecycle notifications (reminders / expiry)."""

    __tablename__ = "listing_reminders"

    id = db.Column(db.Integer, primary_key=True)
    property_id = db.Column(db.Integer, db.ForeignKey("properties.id", ondelete="CASCADE"), nullable=False)
    kind = db.Column(db.String(20), nullable=False, default="expiry")
    stage_days = db.Column(db.Integer, nullable=False, default=0)
    sent_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint("property_id", "kind", "stage_days", name="uq_listing_reminder"),
        db.Index("idx_lrem_property", "property_id"),
    )
