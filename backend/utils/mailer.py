import base64
import logging
import threading

from flask import current_app
from flask_mail import Message

from extensions import mail

logger = logging.getLogger("realtyhub.mailer")

_MAIL_KEYS = (
    "mail_enabled", "mail_server", "mail_port", "mail_username",
    "mail_password", "mail_sender", "mail_use_tls",
)

_MAIL_DEFAULTS = {
    "mail_enabled": "false",
    "mail_server": "smtp.gmail.com",
    "mail_port": "587",
    "mail_username": "",
    "mail_password": "",
    "mail_sender": "",
    "mail_use_tls": "true",
}

_config_lock = threading.Lock()


def get_mail_settings():
    """Fresh SMTP settings from the DB settings table (no caching)."""
    from models.setting_model import Setting
    rows = {s.skey: s.svalue for s in Setting.query.filter(Setting.skey.in_(_MAIL_KEYS)).all()}
    out = {}
    for key, default in _MAIL_DEFAULTS.items():
        value = (rows.get(key) or "").strip()
        out[key] = value if value else default
    return out


def _configure_mail(app, opts):
    """Re-point Flask-Mail at the DB-backed SMTP settings."""
    use_tls = opts.get("mail_use_tls", "true").lower() in ("1", "true", "yes")
    try:
        port = int((opts.get("mail_port") or "").strip() or (587 if use_tls else 465))
    except (TypeError, ValueError):
        port = 587 if use_tls else 465
    username = opts.get("mail_username") or ""
    with _config_lock:
        app.config["MAIL_SERVER"] = opts.get("mail_server") or "smtp.gmail.com"
        app.config["MAIL_PORT"] = port
        app.config["MAIL_USE_TLS"] = use_tls
        app.config["MAIL_USE_SSL"] = False
        app.config["MAIL_USERNAME"] = username
        app.config["MAIL_PASSWORD"] = opts.get("mail_password") or ""
        app.config["MAIL_SENDER"] = opts.get("mail_sender") or username
        mail.init_app(app)


def send_email_async(subject, recipients, html):
    """Fire-and-forget email. Never blocks or fails the calling request.

    Reads SMTP settings from the DB settings table; when mail_enabled is
    false (default) the email is only logged.
    """
    recipients = [r for r in (recipients or []) if r]
    if not recipients:
        return
    app = current_app._get_current_object()

    def _send():
        with app.app_context():
            try:
                opts = get_mail_settings()
                enabled = opts.get("mail_enabled", "false").lower() in ("1", "true", "yes")
                if not enabled:
                    logger.info("[MAIL disabled] To=%s Subject=%s", ",".join(recipients), subject)
                    return
                _configure_mail(app, opts)
                msg = Message(
                    subject=subject,
                    recipients=recipients,
                    html=html,
                    sender=opts.get("mail_sender") or opts.get("mail_username"),
                )
                mail.send(msg)
                logger.info("Email sent To=%s Subject=%s", ",".join(recipients), subject)
            except Exception as e:
                logger.error("Email failed To=%s Subject=%s Error=%s", ",".join(recipients), subject, e)

    threading.Thread(target=_send, daemon=True).start()


def frontend_url(path=""):
    base = current_app.config.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
    return f"{base}/{path.lstrip('/')}" if path else base


def property_url(prop_id):
    slug = base64.b64encode(f"nrr2k25x:{prop_id}".encode()).decode().replace("+", "-").replace("/", "_").rstrip("=")
    return frontend_url(f"property/{slug}")


def format_price(prop):
    price = getattr(prop, "price", None)
    if price is None:
        return prop.price_text or "Connect for Price"
    try:
        return f"₹{float(price):,.0f}"
    except (TypeError, ValueError):
        return prop.price_text or "Connect for Price"


def _shell(title, heading, body_rows):
    rows = "".join(body_rows)
    return f"""
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#333;">
      <div style="background:#0f4cba;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="color:#ffffff;margin:0;font-size:20px;">Nagpur Realty Hub</h2>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:24px 20px;border-radius:0 0 8px 8px;">
        <h3 style="color:#0f4cba;margin-top:0;font-size:17px;">{heading}</h3>
        {rows}
        <p style="color:#9ca3af;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:14px;">
          This is an automated message from Nagpur Realty Hub. Please do not reply to this email.<br/>
          &copy; Nagpur Realty Hub, Nagpur
        </p>
      </div>
    </div>"""


def _btn(text, url, color="#0f4cba"):
    return (f'<p style="margin:22px 0;"><a href="{url}" style="background:{color};color:#ffffff;'
            f'padding:11px 24px;text-decoration:none;border-radius:6px;font-weight:bold;'
            f'display:inline-block;">{text}</a></p>')


def _row(label, value):
    return (f'<p style="margin:7px 0;font-size:14px;"><span style="color:#6b7280;">{label}: </span>'
            f'<strong>{value}</strong></p>')


def _para(text):
    return f'<p style="font-size:14px;line-height:1.6;margin:10px 0;">{text}</p>'


def verification_email(name, token):
    link = frontend_url(f"verify-email/{token}")
    body = [
        _para(f"Hi {name},"),
        _para("Thanks for registering as a property owner on Nagpur Realty Hub. "
              "Please verify your email address to start posting properties."),
        _btn("Verify Email", link),
        _para(f'This link expires in 24 hours. If the button does not work, copy this link:<br/>{link}'),
        _para("If you did not create this account, you can safely ignore this email."),
    ]
    return _shell("Verify Email", "Verify your email address", body)


def connect_ack_visitor_email(visitor_name, prop):
    body = [
        _para(f"Hi {visitor_name},"),
        _para("Thank you for your interest! Here are the property details you enquired about:"),
        _row("Property", prop.title),
        _row("Listing ID", prop.listing_id or "-"),
        _row("Price", format_price(prop)),
        _row("Location", prop.location),
        _row("Type", f"{(prop.transaction_type or '').title()} / {(prop.property_type or '').title()}"),
        _para("Our team will contact you shortly."),
        _btn("View Property", property_url(prop.id)),
    ]
    return _shell("Enquiry", "We received your enquiry", body)


def connect_owner_email(prop, visitor, owner_name):
    body = [
        _para(f"Hi {owner_name},"),
        _para(f"Someone has shown interest in your property <strong>{prop.title}</strong> "
              f"(Listing ID: {prop.listing_id or '-'}):"),
        _row("Name", visitor["name"]),
        _row("Mobile", visitor["mobile"]),
        _row("Email", visitor.get("email") or "-"),
        _btn("View Property", property_url(prop.id)),
        _para("Their details are also available in your My Account &rarr; Connect Requests section."),
    ]
    return _shell("Connect", "New connect request for your property", body)


def new_lead_email(lead, prop, owner_handled):
    body = [
        _para("A new connect request has been received:"),
        _row("Property", prop.title if prop else "-"),
        _row("Listing ID", (prop.listing_id if prop else None) or "-"),
        _row("Visitor", lead.name),
        _row("Mobile", lead.mobile or "-"),
        _row("Email", lead.email or "-"),
        _row("Source", lead.source or "website"),
        _para("<strong>Owner-handled:</strong> this lead is not auto-assigned; it is waiting "
              "for the property owner. You can assign it to an executive from the Leads panel."
              if owner_handled else
              "The lead has been auto-assigned to the least-loaded executive."),
        _btn("Open Leads Panel", frontend_url("admin/leads")),
    ]
    return _shell("New Lead", "New visitor enquiry", body)


def saved_search_alert_email(saved, properties, unsubscribe_url, description=""):
    rows = []
    for prop in properties:
        rows.append(
            f'<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;margin:10px 0;">'
            f'<a href="{property_url(prop.id)}" style="color:#0f4cba;font-weight:bold;'
            f'text-decoration:none;font-size:15px;">{prop.title}</a>'
            f'<p style="margin:6px 0 0;font-size:13px;color:#6b7280;">'
            f'{(prop.location or "")} &middot; {format_price(prop)}</p></div>'
        )
    body = [
        _para(f"Hi {saved.name or 'there'},"),
        _para(f"We found <strong>{len(properties)}</strong> new "
              f"{'property' if len(properties) == 1 else 'properties'} matching your saved search"
              + (f' (<strong>{description}</strong>)' if description else "") + ":"),
        *rows,
        _btn("View all matches", frontend_url("properties")),
        _para(f'<a href="{unsubscribe_url}" style="color:#9ca3af;font-size:12px;">'
              f'Unsubscribe from these alerts</a>'),
    ]
    return _shell("New matches", "New matches for your saved search", body)


def lead_sla_reminder_email(lead, prop, admin_name, minutes_overdue):
    body = [
        _para(f"Hi {admin_name},"),
        _para("A lead assigned to you is awaiting its <strong>first response</strong> "
              "and has crossed the response-time target:"),
        _row("Lead", lead.name),
        _row("Mobile", lead.mobile or "-"),
        _row("Email", lead.email or "-"),
        _row("Property", prop.title if prop else "-"),
        _row("Listing ID", (prop.listing_id if prop else None) or "-"),
        _row("Overdue by", f"{minutes_overdue} minutes"),
        _btn("Open Leads Panel", frontend_url("admin/leads"), "#dc2626"),
    ]
    return _shell("SLA Reminder", "Lead awaiting first response", body)


def submission_received_email(prop, owner_name):
    body = [
        _para(f"Hi {owner_name},"),
        _para("Your property has been submitted successfully and is now pending review "
              "by our team. You will receive an email once it is approved or rejected."),
        _row("Property", prop.title),
        _row("Listing ID", prop.listing_id or "-"),
        _row("Location", prop.location),
        _para("You can track its status anytime from My Account &rarr; My Properties."),
        _btn("View My Properties", frontend_url("my-account")),
    ]
    return _shell("Submission", "Property submitted for review", body)


def submission_confirmed_email(prop, owner_name):
    body = [
        _para(f"Hi {owner_name},"),
        _para("Your property has been <strong>approved</strong> and is now live on Nagpur Realty Hub. "
              "You will receive an email whenever a visitor shows interest in it."),
        _row("Property", prop.title),
        _row("Listing ID", prop.listing_id or "-"),
        _btn("View Property", property_url(prop.id)),
        _para("Track status and connect requests from My Account &rarr; My Properties."),
    ]
    return _shell("Approved", "Your property is now live", body)


def submission_rejected_email(prop, owner_name):
    body = [
        _para(f"Hi {owner_name},"),
        _para("Your property could not be approved at this time. You can review the details, "
              "make changes and resubmit it for review from your dashboard."),
        _row("Property", prop.title),
        _row("Listing ID", prop.listing_id or "-"),
        _btn("Edit & Resubmit", frontend_url("my-account")),
        _para("If you have questions, please contact our support team."),
    ]
    return _shell("Rejected", "Property needs changes", body)


def contactus_admin_email(contact, admin_name):
    body = [
        _para(f"Hi {admin_name},"),
        _para("A new message has been submitted from the website contact form:"),
        _row("Name", contact.name),
        _row("Email", contact.email),
        _row("Phone", contact.phone),
        _para(f"<em>{contact.message}</em>"),
        _btn("Open Messages", frontend_url("admin/messages")),
    ]
    return _shell("Contact", "New contact form message", body)


def password_reset_email(reset_link):
    body = [
        _para("We received a request to reset the password for your Nagpur Realty Hub account."),
        _btn("Reset Password", reset_link),
        _para(f'This link expires in 15 minutes. If the button does not work, copy this link:<br/>{reset_link}'),
        _para("If you did not request this, you can safely ignore this email."),
    ]
    return _shell("Password Reset", "Reset your password", body)
