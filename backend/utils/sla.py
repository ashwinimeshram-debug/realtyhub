"""First-response SLA helpers.

Business hours are Mon-Sat, 10:00-19:00 Asia/Kolkata. Timestamps are stored in
UTC (naive) as elsewhere in the app.
"""
from datetime import datetime, timedelta, timezone

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

TZ_NAME = "Asia/Kolkata"
BUSINESS_START = 10
BUSINESS_END = 19
BUSINESS_DAYS = {0, 1, 2, 3, 4, 5}  # Monday-Saturday

_UTC = timezone.utc
# India has no DST, so a fixed +05:30 offset is exact and needs no tz database.
_IST_FALLBACK = timezone(timedelta(hours=5, minutes=30))


def _tz():
    if ZoneInfo is not None:
        try:
            return ZoneInfo(TZ_NAME)
        except Exception:
            pass
    return _IST_FALLBACK


def add_business_minutes(start_utc, minutes):
    """Add `minutes` of business time to a naive UTC datetime."""
    minutes = float(minutes or 0)
    tz = _tz()
    if tz is None or minutes <= 0:
        return start_utc + timedelta(minutes=max(minutes, 0))

    dt = start_utc.replace(tzinfo=_UTC).astimezone(tz)
    remaining = minutes
    guard = 0
    while remaining > 0 and guard < 100000:
        guard += 1
        if dt.weekday() not in BUSINESS_DAYS or dt.hour >= BUSINESS_END:
            dt = (dt + timedelta(days=1)).replace(
                hour=BUSINESS_START, minute=0, second=0, microsecond=0
            )
            continue
        if dt.hour < BUSINESS_START:
            dt = dt.replace(hour=BUSINESS_START, minute=0, second=0, microsecond=0)
        end_today = dt.replace(hour=BUSINESS_END, minute=0, second=0, microsecond=0)
        available = (end_today - dt).total_seconds() / 60.0
        if remaining <= available:
            dt = dt + timedelta(minutes=remaining)
            remaining = 0
        else:
            remaining -= available
            dt = (dt + timedelta(days=1)).replace(
                hour=BUSINESS_START, minute=0, second=0, microsecond=0
            )

    return dt.astimezone(_UTC).replace(tzinfo=None)


def lead_sla_minutes():
    """Minutes allowed for a first response, from settings with config fallback."""
    try:
        from models.setting_model import Setting
        setting = Setting.query.filter_by(skey="lead_sla_minutes").first()
        if setting and setting.svalue:
            return int(str(setting.svalue).strip())
    except (ValueError, TypeError, Exception):
        pass
    try:
        from config import Config
        return int(getattr(Config, "LEAD_SLA_MINUTES", 15))
    except (ValueError, TypeError):
        return 15


def apply_sla(lead, now=None):
    """Stamp created_at (if needed) and sla_due_at on a new lead."""
    now = now or datetime.utcnow()
    if lead.created_at is None:
        lead.created_at = now
    lead.sla_due_at = add_business_minutes(lead.created_at, lead_sla_minutes())
    return lead


def mark_first_response(lead, when=None):
    """Record the first response time if not already set."""
    if lead.first_response_at is None:
        lead.first_response_at = when or datetime.utcnow()
    return lead
