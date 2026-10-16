from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from config import Config
from extensions import db, mail, limiter
import os
import time
import logging
import mimetypes

# Windows' mimetypes registry does not know the modern image formats,
# so uploads were served as application/octet-stream. Register them
# explicitly so browsers can treat (and cache) them as images.
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/avif", ".avif")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("realtyhub")


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    db.init_app(app)
    mail.init_app(app)
    limiter.init_app(app)
    CORS(app, supports_credentials=True, origins=app.config.get("CORS_ORIGINS", ["http://localhost:3000"]))
    jwt = JWTManager(app)

    @jwt.token_in_blocklist_loader
    def _token_revocation_and_namespace_guard(jwt_header, jwt_payload):
        # 1. Revoked tokens (logout / forced sign-out) are always rejected.
        from utils.auth import is_token_revoked
        if is_token_revoked(jwt_payload.get("jti")):
            return True

        # 2. Keep owner tokens and admin tokens in separate namespaces.
        # Both use the same access_token_cookie, so without this guard an
        # owner with id N could impersonate the admin with id N on
        # /api/admin/* endpoints (and vice versa).
        sub = str(jwt_payload.get("sub", ""))
        path = request.path
        if path.startswith("/api/admin") and not sub.isdigit():
            return True
        if path.startswith("/api/owner") and sub.isdigit():
            return True
        return False

    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    with app.app_context():
        _import_all_models()
        # Schema is owned by Alembic. In development we still create any
        # missing tables for convenience; production must run
        # `alembic upgrade head` as a deploy step.
        if os.getenv("FLASK_ENV", "development") != "production":
            # GIN trigram indexes rely on the pg_trgm extension (created by
            # Alembic in production; ensure it exists before create_all here).
            try:
                from sqlalchemy import text
                if db.engine.dialect.name == "postgresql":
                    db.session.execute(text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
                    db.session.commit()
            except Exception as exc:  # pragma: no cover - best effort
                logger.warning("pg_trgm extension setup skipped: %s", exc)
            db.create_all()
        _seed_rbac()
        _seed_defaults()

    _register_blueprints(app)
    _register_error_handlers(app)
    _register_request_logging(app)
    _register_security_headers(app)

    @app.route("/")
    def home():
        from utils.mailer import get_site_name
        return f"{get_site_name()} API is Running"

    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        response = send_from_directory(app.config["UPLOAD_FOLDER"], filename)
        # Uploaded filenames are unique (timestamped) and never overwritten,
        # so they are safe to cache "forever" in the browser.
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

    return app


def _import_all_models():
    from models.models import (
        Property, PropertyContact, PropertyImage, Admin, Owner,
        Lead, LeadStatus, LeadHistory, Faq, PropertyType,
        AboutGalleryImage, TeamMember, ActivityLog,
        PropertyTypeField, PropertyValue, PresetFeature, PropertyFeature,
        PropertyAuditLog, PasswordResetRequest,
        Role, Permission, RolePermission,
    )
    from models.cms_models import HeroSlide, Service, Advantage
    from models.contactus import Contactus
    from models.testimonial_model import Testimonial
    from models.setting_model import Setting
    from models.analytics_model import PageVisit, SearchLog, BannerClick


def _register_blueprints(app):
    from routes.public_routes import public_bp
    from routes.admin_routes import admin_bp
    from routes.cms_routes import cms_bp
    from routes.contact_routes import contact_bp
    from routes.testimonial_routes import testimonial_bp
    from routes.analytics_routes import analytics_bp
    from routes.settings_routes import settings_bp
    from routes.leads_routes import leads_bp
    from routes.pages_routes import pages_bp
    from routes.faq_routes import faq_bp
    from routes.types_routes import types_bp
    from routes.gallery_routes import gallery_bp
    from routes.team_routes import team_bp
    from routes.owner_routes import owner_bp
    from routes.cron_routes import cron_bp
    from routes.saved_search_routes import saved_search_bp
    from routes.payments_routes import payments_bp
    from routes.ai_routes import ai_bp

    app.register_blueprint(public_bp, url_prefix="/api")
    app.register_blueprint(admin_bp, url_prefix="/api/admin")
    app.register_blueprint(cms_bp, url_prefix="/api")
    app.register_blueprint(contact_bp, url_prefix="/api")
    app.register_blueprint(testimonial_bp, url_prefix="/api")
    app.register_blueprint(analytics_bp, url_prefix="/api")
    app.register_blueprint(settings_bp, url_prefix="/api")
    app.register_blueprint(leads_bp, url_prefix="/api")
    app.register_blueprint(pages_bp, url_prefix="/api")
    app.register_blueprint(faq_bp, url_prefix="/api")
    app.register_blueprint(types_bp, url_prefix="/api")
    app.register_blueprint(gallery_bp, url_prefix="/api")
    app.register_blueprint(cron_bp, url_prefix="/api/cron")
    app.register_blueprint(team_bp, url_prefix="/api")
    app.register_blueprint(owner_bp, url_prefix="/api/owner")
    app.register_blueprint(saved_search_bp, url_prefix="/api")
    app.register_blueprint(payments_bp, url_prefix="/api/payments")
    app.register_blueprint(ai_bp, url_prefix="/api")


def _register_error_handlers(app):
    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Bad request"}), 400

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "File too large"}), 413

    @app.errorhandler(415)
    def unsupported_media(e):
        return jsonify({"error": "Unsupported media type"}), 415

    @app.errorhandler(422)
    def unprocessable(e):
        return jsonify({"error": "Unprocessable entity"}), 422

    @app.errorhandler(429)
    def rate_limited(e):
        return jsonify({"error": "Rate limit exceeded"}), 429

    @app.errorhandler(500)
    def server_error(e):
        try:
            db.session.rollback()
        except Exception:
            pass
        return jsonify({"error": "Internal server error"}), 500


def _register_security_headers(app):
    """Attach hardened HTTP security headers to every response.

    The API only serves JSON, plain text and image files, never HTML
    documents, so a restrictive CSP is safe here.
    """
    is_production = os.getenv("FLASK_ENV", "development") == "production"

    @app.after_request
    def _security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)")
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'none'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'",
        )
        if is_production:
            response.headers.setdefault(
                "Strict-Transport-Security", "max-age=31536000; includeSubDomains"
            )
        return response


def _register_request_logging(app):
    @app.before_request
    def before():
        request._start_time = time.time()

    @app.after_request
    def after(response):
        if hasattr(request, "_start_time") and not request.path.startswith("/api/analytics/"):
            duration = round((time.time() - request._start_time) * 1000, 2)
            logger.info(f"{request.method} {request.path} -> {response.status_code} ({duration}ms)")
        return response


def _seed_rbac():
    """Seed roles, permission catalog and grants for the RBAC system."""
    from utils.permissions import seed_rbac as _seed
    _seed()


def _seed_defaults():
    """Seed default property types, lead statuses, admin, and field definitions."""
    from models.models import PropertyType, LeadStatus, Admin, PropertyTypeField, DescriptionTemplate, PresetFeature
    from models.setting_model import Setting
    import bcrypt
    import json as _json

    if PropertyType.query.count() == 0:
        property_types = [
            ("Flat", "flat", "property", 1), ("Plot", "plot", "property", 2),
            ("House", "house", "property", 3), ("Commercial", "commercial", "property", 4),
        ]
        for name, value, cat, order in property_types:
            db.session.add(PropertyType(name=name, value=value, category=cat, sort_order=order))

        transaction_types = [
            ("Buy", "buy", "transaction", 1), ("Sell", "sell", "transaction", 2),
            ("Rent", "rent", "transaction", 3), ("Resale", "resale", "transaction", 4),
        ]
        for name, value, cat, order in transaction_types:
            db.session.add(PropertyType(name=name, value=value, category=cat, sort_order=order))
    else:
        for val, name, order in [
            ("buy", "Buy", 1), ("sell", "Sell", 2), ("rent", "Rent", 3), ("resale", "Resale", 4),
        ]:
            existing = PropertyType.query.filter_by(value=val, category="transaction").first()
            if not existing:
                db.session.add(PropertyType(name=name, value=val, category="transaction", sort_order=order))
            else:
                existing.name = name
                existing.sort_order = order

    if LeadStatus.query.count() == 0:
        default_statuses = [
            ("New", "#3b82f6", 1), ("Contacted", "#f59e0b", 2),
            ("Qualified", "#10b981", 3), ("Site Visit", "#8b5cf6", 4),
            ("Negotiation", "#f97316", 5), ("Won", "#22c55e", 6),
            ("Not Interested", "#ef4444", 7),
        ]
        for name, color, order in default_statuses:
            db.session.add(LeadStatus(name=name, color=color, sort_order=order))

    if Admin.query.count() == 0:
        admin_user = os.getenv("ADMIN_USERNAME", "admin")
        admin_email = os.getenv("ADMIN_EMAIL", "admin@nagpurrealtyhub.com")
        admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
        hashed = bcrypt.hashpw(admin_pass.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        db.session.add(Admin(username=admin_user, email=admin_email,
                             name="Administrator", password=hashed, is_active=True))

    if PropertyTypeField.query.count() == 0:
        _seed_type_fields()

    if DescriptionTemplate.query.count() == 0:
        _seed_description_templates()
    elif DescriptionTemplate.query.filter(DescriptionTemplate.property_type.isnot(None)).count() == 0:
        _seed_description_templates()

    if PresetFeature.query.count() == 0:
        _seed_preset_features()

    _seed_page_settings()
    _seed_mail_settings()
    _seed_lifecycle_settings()

    db.session.commit()


def _seed_type_fields():
    """Seed dynamic field definitions for each property type."""
    from models.models import PropertyTypeField

    facing_opts = ["East", "West", "North", "South", "North-East", "South-East", "North-West", "South-West"]
    facing_short = ["East", "West", "North", "South"]

    fields = [
        # ── FLAT / APARTMENT ──
        ("flat", "bedrooms", "Bedrooms", "बेडरूम", "बेडरूम", "chip", ["1", "2", "3", "4", "5+"], None, None, 1, True),
        ("flat", "bathrooms", "Bathrooms", "बाथरूम", "बाथरूम", "chip", ["1", "2", "3", "4"], None, None, 2, True),
        ("flat", "furnishing", "Furnishing", "फर्निशिंग", "फर्निशिंग", "select", ["Unfurnished", "Semi-Furnished", "Fully Furnished"], None, None, 3, False),
        ("flat", "facing", "Facing", "दिशा", "दिशा", "chip", facing_short, None, None, 4, False),
        ("flat", "floor_level", "Floor Level", "मजला", "मंज़िल", "text", ["Ground", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10+"], None, "e.g. Ground, 3", 5, False),
        ("flat", "total_floors", "Total Floors", "एकूण मजले", "कुल मंज़िलें", "text", ["1", "2", "3", "4", "5", "10+", "15+", "20+"], None, "e.g. 5, 10+", 6, False),
        ("flat", "area_size", "Area Size", "क्षेत्रफळ", "क्षेत्रफल", "text", None, ["Sq. Ft.", "Sq. Yards"], "e.g. 1200 - 5000 Sq. Ft.", 7, True),
        ("flat", "lift", "Lift", "लिफ्ट", "लिफ्ट", "chip", ["Yes", "No"], None, None, 8, False),
        ("flat", "parking", "Parking", "पार्किंग", "पार्किंग", "chip", ["Open", "Covered", "None"], None, None, 9, False),

        # ── PLOT / LAND ──
        ("plot", "area_size", "Area Size", "क्षेत्रफळ", "क्षेत्रफल", "text", None, ["Sq. Ft.", "Sq. Yards", "Acres"], "e.g. 5000 - 10000 Sq. Ft.", 1, True),
        ("plot", "facing", "Facing", "दिशा", "दिशा", "chip", facing_opts, None, None, 2, False),
        ("plot", "na_approved", "NA Approved", "NA मंजूर", "NA स्वीकृत", "chip", ["Yes", "No"], None, None, 3, False),
        ("plot", "gated_community", "Gated Community", "गेटेड कम्युनिटी", "गेटेड कम्युनिटी", "chip", ["Yes", "No"], None, None, 4, False),
        ("plot", "boundary_wall", "Boundary Wall", "भिंतीची रचना", "बाउंड्री वॉल", "chip", ["Yes", "No"], None, None, 5, False),

        # ── HOUSE / VILLA ──
        ("house", "bedrooms", "Bedrooms", "बेडरूम", "बेडरूम", "chip", ["1", "2", "3", "4", "5+"], None, None, 1, True),
        ("house", "bathrooms", "Bathrooms", "बाथरूम", "बाथरूम", "chip", ["1", "2", "3", "4"], None, None, 2, True),
        ("house", "furnishing", "Furnishing", "फर्निशिंग", "फर्निशिंग", "select", ["Unfurnished", "Semi-Furnished", "Fully Furnished"], None, None, 3, False),
        ("house", "facing", "Facing", "दिशा", "दिशा", "chip", facing_short, None, None, 4, False),
        ("house", "total_floors", "Total Floors", "एकूण मजले", "कुल मंज़िलें", "text", ["1", "2", "3"], None, "e.g. 2", 5, False),
        ("house", "area_size", "Area Size", "क्षेत्रफळ", "क्षेत्रफल", "text", None, ["Sq. Ft.", "Sq. Yards", "Acres"], "e.g. 1500 - 3000 Sq. Ft.", 6, True),
        ("house", "parking", "Parking", "पार्किंग", "पार्किंग", "chip", ["Open", "Covered", "None"], None, None, 7, False),
        ("house", "gated_community", "Gated Community", "गेटेड कम्युनिटी", "गेटेड कम्युनिटी", "chip", ["Yes", "No"], None, None, 8, False),
        ("house", "boundary_wall", "Boundary Wall", "भिंतीची रचना", "बाउंड्री वॉल", "chip", ["Yes", "No"], None, None, 9, False),

        # ── COMMERCIAL ──
        ("commercial", "area_size", "Area Size", "क्षेत्रफळ", "क्षेत्रफल", "text", None, ["Sq. Ft.", "Sq. Yards"], "e.g. 2000 - 8000 Sq. Ft.", 1, True),
        ("commercial", "furnishing", "Furnishing", "फर्निशिंग", "फर्निशिंग", "select", ["Unfurnished", "Semi-Furnished", "Fully Furnished"], None, None, 2, False),
        ("commercial", "facing", "Facing", "दिशा", "दिशा", "chip", facing_short, None, None, 3, False),
        ("commercial", "floor_level", "Floor Level", "मजला", "मंज़िल", "text", ["Ground", "1", "2", "3"], None, "e.g. Ground, 2", 4, False),
        ("commercial", "parking", "Parking", "पार्किंग", "पार्किंग", "chip", ["Open", "Covered", "None"], None, None, 5, False),
    ]

    for pt_val, fkey, flabel, flabel_mr, flabel_hi, ftype, opts, uopts, ph, order, req in fields:
        db.session.add(PropertyTypeField(
            property_type_value=pt_val, field_key=fkey, field_label=flabel,
            field_label_mr=flabel_mr, field_label_hi=flabel_hi, field_type=ftype,
            options=opts, unit_options=uopts, placeholder=ph,
            sort_order=order, is_active=True, is_required=req,
        ))


def _seed_preset_features():
    """Seed default preset features shown as chips on the property forms."""
    from models.models import PresetFeature

    features = [
        ("Lift", "Lift facility available in the building."),
        ("Parking", "Dedicated parking space available."),
        ("Gated Community", "Gated community with security and amenities."),
        ("Power Backup", "Power backup available during outages."),
        ("Water Supply", "24x7 water supply and storage facility."),
        ("Gym", "Fully equipped gymnasium for residents."),
        ("Clubhouse", "Clubhouse with indoor games and lounge."),
        ("Swimming Pool", "Swimming pool available for residents."),
        ("Play Area", "Children's play area within the complex."),
        ("Garden", "Landscaped garden and green surroundings."),
        ("Security", "24x7 security with CCTV surveillance."),
        ("Fire Safety", "Fire safety systems installed."),
        ("Solar Panels", "Solar panels installed for energy efficiency."),
        ("Rain Water Harvesting", "Rain water harvesting system in place."),
        ("EV Charging", "EV charging points available."),
        ("Visitor Parking", "Dedicated visitor parking."),
        ("Balcony", "Balcony with scenic views."),
        ("Modular Kitchen", "Modular kitchen with premium fittings."),
    ]
    for idx, (label, sentence) in enumerate(features, start=1):
        db.session.add(PresetFeature(label=label, sentence=sentence, sort_order=idx, is_active=True))


def _seed_description_templates():
    """Seed default title and description templates."""
    from models.models import DescriptionTemplate

    has_generic = DescriptionTemplate.query.filter(DescriptionTemplate.property_type.is_(None)).count() > 0
    has_typed = DescriptionTemplate.query.filter(DescriptionTemplate.property_type.isnot(None)).count() > 0

    if has_generic and has_typed:
        return

    templates = [
        # ── TITLE ──
        ("title", None, "{bedrooms} BHK {property_type} for {transaction_type} in {location}", 1),
        ("title", None, "Spacious {property_type} in {location}", 2),
        ("title", None, "{property_type} for {transaction_type} near {location}", 3),
        ("title", None, "Well-located {property_type} in {location} — Connect for Price", 4),
        ("title", None, "{property_type} in {location} with {area_size} area", 5),

        # ── OVERVIEW ──
        ("overview", None, "A well-maintained {property_type} in {location}, perfect for {transaction_type}.", 1),
        ("overview", None, "This {property_type} offers comfortable living in a prime {location} location.", 2),
        ("overview", None, "Spacious {property_type} available for {transaction_type} in {location}.", 3),
        ("overview", None, "A ready-to-move {property_type} situated in a well-connected area of {location}.", 4),
        ("overview", None, "Premium {property_type} in the heart of {location}, ideal for families.", 5),

        # ── AMENITIES (generic) ──
        ("amenities", None, "Basic amenities including water supply, drainage, and electricity are available.", 1),
        ("amenities", None, "Gated community with clubhouse and landscaped gardens.", 2),
        ("amenities", None, "Lift facility available with covered parking and intercom facility.", 3),

        # ── AMENITIES (flat) ──
        ("amenities", "flat", "Smart home features with modular kitchen and premium fittings.", 4),
        ("amenities", "flat", "Dedicated parking bay with visitor parking and EV charging points.", 5),
        ("amenities", "flat", "Rooftop garden, jogging track, and children's play area.", 6),

        # ── AMENITIES (house) ──
        ("amenities", "house", "Independent house with private garden and servant quarter.", 4),
        ("amenities", "house", "Spacious terrace with water tank and solar panels.", 5),
        ("amenities", "house", "Private parking for two cars with front and back garden.", 6),

        # ── AMENITIES (plot) ──
        ("amenities", "plot", "Corner plot with road access on two sides.", 4),
        ("amenities", "plot", "Ready for construction with water and electricity connection nearby.", 5),

        # ── AMENITIES (commercial) ──
        ("amenities", "commercial", "Modern office space with central AC and high-speed internet.", 4),
        ("amenities", "commercial", "Ground floor showroom with high footfall and signage rights.", 5),
        ("amenities", "commercial", "Warehouse with loading dock and ample parking for commercial vehicles.", 6),

        # ── HIGHLIGHTS (generic) ──
        ("highlights", None, "Excellent connectivity to schools, hospitals, and public transport.", 1),
        ("highlights", None, "Located near major markets and commercial hubs.", 2),
        ("highlights", None, "Peaceful residential area with good infrastructure.", 3),
        ("highlights", None, "Close to temples, parks, and recreational facilities.", 4),
        ("highlights", None, "Well-connected to major roads, railway station, and airport.", 5),

        # ── HIGHLIGHTS (flat) ──
        ("highlights", "flat", "Proximity to IT parks and corporate offices.", 6),
        ("highlights", "flat", "High-rise with panoramic city views and sunset-facing balconies.", 7),

        # ── HIGHLIGHTS (house) ──
        ("highlights", "house", "Located in a serene neighborhood with low traffic and greenery.", 6),
        ("highlights", "house", "Walking distance to reputed schools and daily-needs markets.", 7),

        # ── HIGHLIGHTS (plot) ──
        ("highlights", "plot", "Investment zone with upcoming metro and road widening projects.", 6),
        ("highlights", "plot", "Suitable for residential or commercial development.", 7),

        # ── HIGHLIGHTS (commercial) ──
        ("highlights", "commercial", "Prime commercial corridor with high visibility and brand exposure.", 6),
        ("highlights", "commercial", "Near main road with heavy vehicle access and loading facilities.", 7),

        # ── CLOSING ──
        ("closing", None, "Contact us for more details and site visits.", 1),
        ("closing", None, "Schedule a visit today to see this property in person.", 2),
        ("closing", None, "For inquiries, reach out to us at the given contact details.", 3),
        ("closing", None, "Don't miss this opportunity — call now for a walkthrough.", 4),
        ("closing", None, "More photos and details available on request.", 5),
    ]

    for category, prop_type, text, order in templates:
        if prop_type is None and has_generic:
            continue
        if prop_type is not None and has_typed:
            continue
        db.session.add(DescriptionTemplate(
            category=category, property_type=prop_type, template_text=text,
            sort_order=order, is_active=True,
        ))


def _seed_mail_settings():
    """Seed default SMTP config keys into the settings table (first boot only)."""
    from models.setting_model import Setting

    defaults = {
        "mail_enabled": "false",
        "mail_server": "smtp.gmail.com",
        "mail_port": "587",
        "mail_username": os.getenv("MAIL_USERNAME", "info@nagpurrealtyhub.com"),
        "mail_password": os.getenv("MAIL_PASSWORD", ""),
        "mail_sender": os.getenv("MAIL_SENDER") or os.getenv("MAIL_USERNAME", "info@nagpurrealtyhub.com"),
        "mail_use_tls": "true",
    }
    for key, value in defaults.items():
        if not Setting.query.filter_by(skey=key).first():
            db.session.add(Setting(skey=key, svalue=value))


def _seed_lifecycle_settings():
    """Seed default paid-listing lifecycle and payment settings (first boot only)."""
    from models.setting_model import Setting

    defaults = {
        "require_listing_payment": "false",   # free-listing bypass on by default
        "listing_sell_price": "999",
        "listing_sell_days": "90",
        "listing_rent_price": "499",
        "listing_rent_days": "30",
        "featured_price": "299",
        "featured_days": "30",
        "section_featured_count": "20",
        "section_featured_split": "8",
        "listing_grace_days": "7",
        "listing_expiry_reminder_days": "15,7,3,1",
        "payment_provider": "mock",
        "payment_currency": "INR",
    }
    for key, value in defaults.items():
        if not Setting.query.filter_by(skey=key).first():
            db.session.add(Setting(skey=key, svalue=value))


def _seed_page_settings():
    """Seed default page content and sections into the settings table."""
    from models.setting_model import Setting
    import json as _json

    from config import Config
    VALID_PAGES = Config.VALID_PAGES

    DEFAULT_PAGE_CONTENT = {
        "about": {"title": "About Us", "content": ""},
        "privacy": {"title": "Privacy Policy", "content": ""},
        "terms": {"title": "Terms of Service", "content": ""},
        "contact": {"title": "Contact Us", "content": ""},
    }

    DEFAULT_PAGE_SECTIONS = {
        "about": [
            {"id": "a1", "label": "Welcome", "content": "Welcome to __SITE_NAME__, your trusted destination for buying, selling, and exploring properties in Nagpur."},
            {"id": "a2", "label": "About Us", "content": "We are dedicated to simplifying real estate by connecting property buyers, sellers, and agents on a single, easy-to-use platform. With thousands of verified listings and a growing community of satisfied users, we make property discovery effortless."},
            {"id": "a3", "label": "Our Mission", "content": "Our mission is to bring transparency, trust, and efficiency to the real estate market in Nagpur by providing accurate listings and a seamless user experience."},
            {"id": "a4", "label": "Our Vision", "content": "To become Nagpur's most reliable and preferred real estate platform, empowering users with the right information and tools to make confident property decisions."},
            {"id": "a5", "label": "Why Choose Us", "content": "Verified and quality property listings\nUser-friendly search and browsing experience\nDirect connection with property owners and agents\nLocal expertise in Nagpur real estate market\nTransparent and trustworthy platform"},
            {"id": "a6", "label": "Our Services", "content": "Property Listings (Buy / Sell / Rent)\nLead Generation for Agents & Builders\nProperty Promotion & Marketing\nReal Estate Consultation"},
        ],
        "privacy": [
            {"id": "pe1", "label": "Effective Date", "content": "July 20, 2026"},
            {"id": "pe2", "label": "", "content": "Welcome to <b>__SITE_NAME__</b> (\"Company\", \"we\", \"our\", \"us\"). We are committed to protecting your privacy and ensuring that your personal information is handled in a safe and responsible manner in accordance with applicable Indian laws.", "type": "description"},
            {"id": "pe3", "label": "1. Information We Collect", "content": "Personal Information: Full Name, Email Address, Mobile Number, Location/City, Information submitted via forms.\n\nProperty Information: Property details from owners, builders, or agents; Images, pricing, and descriptions.\n\nTechnical & Usage Data: IP Address, Browser type, Device information, Pages visited, Cookies."},
            {"id": "pe4", "label": "2. How We Use Your Information", "content": "Manage property listings\nConnect buyers, sellers, and agents\nRespond to inquiries\nImprove user experience\nMarketing (with consent)\nPrevent fraud"},
            {"id": "pe5", "label": "3. Sharing of Information", "content": "We do not sell or rent your personal information.\n\nInformation may be shared with: Property owners/agents, Service providers (hosting, analytics), Legal authorities (if required)."},
            {"id": "pe6", "label": "4. Cookies Policy", "content": "We use cookies to enhance user experience, analyze traffic, and remember preferences. You can disable cookies in your browser settings."},
            {"id": "pe7", "label": "5. Data Security", "content": "We follow reasonable security practices under the Information Technology Act, 2000. However, no system is completely secure."},
            {"id": "pe8", "label": "6. Your Rights", "content": "Access your data\nRequest correction\nRequest deletion\nOpt-out of marketing\n\nContact: info@nagpurrealtyhub.com"},
            {"id": "pe9", "label": "7. Third-Party Links", "content": "We are not responsible for third-party website content or privacy practices."},
            {"id": "pe10", "label": "8. Children's Privacy", "content": "Our services are not intended for individuals under 18 years of age."},
            {"id": "pe11", "label": "9. Changes to this Policy", "content": "We may update this policy from time to time. Changes will be posted here."},
        ],
        "terms": [
            {"id": "te1", "label": "Effective Date", "content": "July 20, 2026"},
            {"id": "te2", "label": "", "content": "Welcome to <b>__SITE_NAME__</b>. By accessing or using our website, you agree to comply with and be bound by the following Terms & Conditions.", "type": "description"},
            {"id": "te3", "label": "1. Acceptance of Terms", "content": "By using this platform, you confirm that you have read, understood, and agreed to these Terms. If you do not agree, please do not use the website."},
            {"id": "te4", "label": "2. Nature of Service", "content": "__SITE_NAME__ is an online real estate platform that publishes property listings and connects buyers, sellers, and real estate agents.\n\nWe act only as an intermediary platform and do not participate in property transactions."},
            {"id": "te5", "label": "3. No Verification Guarantee", "content": "Listings are submitted by third parties\nWe do not guarantee accuracy or authenticity\nUsers must independently verify property details"},
            {"id": "te6", "label": "4. User Responsibilities", "content": "Provide accurate information\nDo not post false or illegal content\nDo not misuse or hack the platform\nNo offensive or prohibited content"},
            {"id": "te7", "label": "5. Property Transactions", "content": "__SITE_NAME__ is not a party to any transaction between users. All dealings happen directly between buyer and seller. We are not responsible for disputes or losses."},
            {"id": "te8", "label": "6. Intellectual Property", "content": "All content (logo, design, text, graphics) belongs to __SITE_NAME__. Unauthorized use is strictly prohibited."},
            {"id": "te9", "label": "7. Limitation of Liability", "content": "We are not liable for:\nProperty disputes\nFinancial losses\nMisrepresentation by users or agents\n\nUse the platform at your own risk."},
            {"id": "te10", "label": "8. Account Suspension & Content Removal", "content": "We reserve the right to:\nRemove listings without notice\nSuspend or terminate accounts\nTake action on violations"},
            {"id": "te11", "label": "9. Compliance with Indian Laws", "content": "These Terms are governed by the Information Technology Act, 2000 and applicable laws of India. Jurisdiction: Nagpur, Maharashtra."},
            {"id": "te12", "label": "10. RERA Disclaimer", "content": "__SITE_NAME__ does not guarantee that all listed properties are registered under the Real Estate (Regulation and Development) Act, 2016 (RERA). Users must verify RERA details independently."},
            {"id": "te13", "label": "11. Modifications to Terms", "content": "We may update these Terms at any time. Continued use means acceptance of updated terms."},
        ],
        "contact": [
            {"id": "c1", "label": "Hero Title", "content": "Get In Touch"},
            {"id": "c2", "label": "Hero Subtitle", "content": "Reach out to us — our dedicated real estate team is here to guide you every step of the way."},
            {"id": "c3", "label": "Hero Card Title", "content": "We'd Love to Hear From You"},
            {"id": "c4", "label": "Hero Card Subtitle", "content": "Typically responds within 24 hours"},
            {"id": "c5", "label": "Hero Tags", "content": "Mon - Sat\n10 AM - 7 PM"},
            {"id": "c6", "label": "Details Title", "content": "Our Contact Details"},
            {"id": "c7", "label": "Address", "content": "Plot No 101, B Wing, Swami Krupa Residency,\nNear Purti Super Market, Besa Road,\nManish Nagar, Nagpur – 440037"},
            {"id": "c8", "label": "Phone", "content": "+91 9270330343"},
            {"id": "c9", "label": "Email", "content": "info@nagpurrealtyhub.com"},
            {"id": "c10", "label": "Website", "content": "www.nagpurrealtyhub.com"},
            {"id": "c11", "label": "Hours Title", "content": "Business Hours"},
            {"id": "c12", "label": "Hours Weekday", "content": "Monday - Saturday|10:00 AM - 7:00 PM"},
            {"id": "c13", "label": "Hours Sunday", "content": "Sunday|Closed"},
            {"id": "c14", "label": "Form Title", "content": "Send a Message"},
            {"id": "c15", "label": "Form Subtitle", "content": "Fill out the form below and we'll get back to you shortly."},
            {"id": "c16", "label": "Form Button", "content": "Send Message"},
            {"id": "c17", "label": "Form Terms", "content": "By submitting, you agree to our Terms & Privacy Policy."},
            {"id": "c18", "label": "Success Title", "content": "Message Sent!"},
            {"id": "c19", "label": "Success Text", "content": "Thank you for reaching out. We'll reply soon."},
        ],
    }

    for slug in VALID_PAGES:
        content_key = f"page_{slug}"
        sections_key = f"page_{slug}_sections"

        existing_content = Setting.query.filter_by(skey=content_key).first()
        if not existing_content:
            db.session.add(Setting(skey=content_key, svalue=_json.dumps(DEFAULT_PAGE_CONTENT[slug])))

        existing_sections = Setting.query.filter_by(skey=sections_key).first()
        if not existing_sections:
            db.session.add(Setting(skey=sections_key, svalue=_json.dumps(DEFAULT_PAGE_SECTIONS[slug])))

    team_key = "page_about_team_layout"
    if not Setting.query.filter_by(skey=team_key).first():
        db.session.add(Setting(skey=team_key, svalue="carousel"))

    # Insert the "New Properties" section after "featured" for existing installs.
    order_setting = Setting.query.filter_by(skey="section_order").first()
    if order_setting:
        try:
            order = _json.loads(order_setting.svalue or "[]")
        except Exception:
            order = []
        if isinstance(order, list) and "new" not in order:
            if "featured" in order:
                order.insert(order.index("featured") + 1, "new")
            else:
                order.append("new")
            order_setting.svalue = _json.dumps(order)


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)
