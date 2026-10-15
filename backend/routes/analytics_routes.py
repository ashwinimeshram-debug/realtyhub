from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, verify_jwt_in_request, get_jwt_identity
from extensions import db, limiter
from models.analytics_model import PageVisit, SearchLog, BannerClick
from models.models import PropertyContact, Lead
from models.contactus import Contactus
from datetime import datetime, timedelta
from sqlalchemy import func, text

analytics_bp = Blueprint("analytics", __name__)


def _period_days(default=30):
    """Selected period in days, clamped to 1..365 (safe against bad input)."""
    try:
        days = int(request.args.get("days", default))
    except (TypeError, ValueError):
        days = default
    return max(1, min(days, 365))


def _classify_referrer(referrer: str) -> str:
    if not referrer:
        return "direct"
    r = referrer.lower()
    if "google" in r:
        return "google"
    if "facebook" in r or "fb.com" in r or "fb.me" in r:
        return "facebook"
    if "instagram" in r:
        return "instagram"
    if "twitter" in r or "x.com" in r:
        return "twitter"
    if "linkedin" in r:
        return "linkedin"
    if "youtube" in r:
        return "youtube"
    if "whatsapp" in r:
        return "whatsapp"
    if "t.co" in r or "bit.ly" in r or "tinyurl" in r:
        return "referral"
    return "referral"


# ─────────────────────────────────────────────
#  PUBLIC TRACKING ENDPOINTS (no auth)
# ─────────────────────────────────────────────

@analytics_bp.route("/analytics/visit", methods=["POST"])
@limiter.limit("30/minute")
def track_visit():
    try:
        verify_jwt_in_request(optional=True)
        if get_jwt_identity():
            return jsonify({"message": "skipped"}), 200
    except Exception:
        pass
    data = request.json or {}
    page_url = data.get("page_url", "/")
    if page_url.startswith("/admin"):
        return jsonify({"message": "skipped"}), 200
    visit = PageVisit(
        page_url=page_url,
        visitor_ip=request.remote_addr,
        referrer=data.get("referrer"),
        utm_source=data.get("utm_source"),
        utm_medium=data.get("utm_medium"),
        utm_campaign=data.get("utm_campaign"),
    )
    db.session.add(visit)
    db.session.commit()
    return jsonify({"message": "ok"}), 200


@analytics_bp.route("/analytics/search", methods=["POST"])
@limiter.limit("30/minute")
def track_search():
    data = request.json or {}
    log = SearchLog(
        location=data.get("location"),
        property_type=data.get("property_type"),
        transaction_type=data.get("transaction_type"),
        min_price=data.get("min_price"),
        max_price=data.get("max_price"),
        visitor_ip=request.remote_addr,
    )
    db.session.add(log)
    db.session.commit()
    return jsonify({"message": "ok"}), 200


@analytics_bp.route("/analytics/banner-click", methods=["POST"])
@limiter.limit("30/minute")
def track_banner_click():
    data = request.json or {}
    click = BannerClick(
        slide_id=data.get("slide_id"),
        slide_title=data.get("slide_title"),
        button_link=data.get("button_link"),
        page_url=data.get("page_url"),
        visitor_ip=request.remote_addr,
    )
    db.session.add(click)
    db.session.commit()
    return jsonify({"message": "ok"}), 200


# ─────────────────────────────────────────────
#  ADMIN ANALYTICS ENDPOINTS (JWT required)
# ─────────────────────────────────────────────

@analytics_bp.route("/admin/analytics", methods=["GET"])
@jwt_required()
def get_analytics():
    now = datetime.utcnow()
    days = _period_days(30)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)

    total_visits = PageVisit.query.count()
    unique_ips = db.session.query(func.count(func.distinct(PageVisit.visitor_ip))).scalar()
    visits_today = PageVisit.query.filter(PageVisit.created_at >= today_start).count()
    visits_week = PageVisit.query.filter(PageVisit.created_at >= week_start).count()
    visits_month = PageVisit.query.filter(PageVisit.created_at >= month_start).count()

    top_pages = db.session.query(
        PageVisit.page_url, func.count(PageVisit.id).label("visits")
    ).group_by(PageVisit.page_url).order_by(func.count(PageVisit.id).desc()).limit(10).all()

    daily = []
    day_start = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)
    raw_daily = db.session.query(
        func.date(PageVisit.created_at).label("day"),
        func.count(PageVisit.id).label("visits")
    ).filter(PageVisit.created_at >= day_start).group_by(func.date(PageVisit.created_at)).all()
    daily_map = {str(row.day): row.visits for row in raw_daily}
    for i in range(days - 1, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        daily.append({"date": day, "visits": daily_map.get(day, 0)})

    visits_period = PageVisit.query.filter(PageVisit.created_at >= day_start).count()
    unique_period = db.session.query(
        func.count(func.distinct(PageVisit.visitor_ip))
    ).filter(PageVisit.created_at >= day_start).scalar()
    leads_period = Lead.query.filter(Lead.created_at >= day_start).count()
    contactus_period = Contactus.query.filter(Contactus.created_at >= day_start).count()

    total_contacts = Lead.query.count()
    contacts_week = Lead.query.filter(Lead.created_at >= week_start).count()
    contacts_month = Lead.query.filter(Lead.created_at >= month_start).count()
    total_contactus = Contactus.query.count()
    contactus_week = Contactus.query.filter(Contactus.created_at >= week_start).count()
    contactus_month = Contactus.query.filter(Contactus.created_at >= month_start).count()

    return jsonify({
        "total_visits": total_visits, "unique_visitors": unique_ips,
        "visits_today": visits_today, "visits_this_week": visits_week, "visits_this_month": visits_month,
        "top_pages": [{"page": p[0], "visits": p[1]} for p in top_pages],
        "daily_visits": daily,
        "total_contacts": total_contacts, "contacts_this_week": contacts_week, "contacts_this_month": contacts_month,
        "total_contactus": total_contactus, "contactus_this_week": contactus_week, "contactus_this_month": contactus_month,
        "visits_period": visits_period, "unique_visitors_period": unique_period,
        "leads_period": leads_period, "contactus_period": contactus_period,
        "days": days,
    })


@analytics_bp.route("/admin/analytics/traffic", methods=["GET"])
@jwt_required()
def get_traffic_sources():
    now = datetime.utcnow()
    days = _period_days(30)
    since = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    raw = db.session.query(
        PageVisit.utm_source,
        PageVisit.referrer,
        func.count(PageVisit.id).label("visits"),
        func.count(func.distinct(PageVisit.visitor_ip)).label("unique_visitors"),
    ).filter(PageVisit.created_at >= since).group_by(
        PageVisit.utm_source, PageVisit.referrer
    ).all()

    # A visit with a utm_source is attributed to it, otherwise fall back to the
    # referrer domain (so organic Google/Facebook traffic isn't lumped into
    # "direct").
    agg = {}
    for row in raw:
        source = row.utm_source or _classify_referrer(row.referrer)
        entry = agg.setdefault(source, {"visits": 0, "unique_visitors": 0})
        entry["visits"] += row.visits
        entry["unique_visitors"] += row.unique_visitors

    results = [{"source": source, **counts} for source, counts in agg.items()]
    results.sort(key=lambda x: x["visits"], reverse=True)
    return jsonify({"sources": results, "days": days})


@analytics_bp.route("/admin/analytics/traffic/detailed", methods=["GET"])
@jwt_required()
def get_traffic_detailed():
    days = min(int(request.args.get("days", 30)), 365)
    since = datetime.utcnow() - timedelta(days=days)

    raw = db.session.query(
        func.date(PageVisit.created_at).label("day"),
        func.count(PageVisit.id).label("visits"),
        PageVisit.utm_source,
        PageVisit.utm_medium,
        PageVisit.referrer,
    ).filter(PageVisit.created_at >= since).group_by(
        func.date(PageVisit.created_at), PageVisit.utm_source, PageVisit.utm_medium, PageVisit.referrer
    ).all()

    by_source = {}
    by_medium = {}
    by_referrer = {}
    daily_by_source = {}

    for row in raw:
        source = row.utm_source or _classify_referrer(row.referrer)
        medium = row.utm_medium or "none"
        day_str = str(row.day)

        by_source[source] = by_source.get(source, 0) + row.visits
        by_medium[medium] = by_medium.get(medium, 0) + row.visits

        if row.referrer:
            domain = row.referrer.split("/")[2] if "/" in row.referrer else row.referrer
            by_referrer[domain] = by_referrer.get(domain, 0) + row.visits

        if day_str not in daily_by_source:
            daily_by_source[day_str] = {}
        daily_by_source[day_str][source] = daily_by_source[day_str].get(source, 0) + row.visits

    chart_data = []
    for i in range(days - 1, -1, -1):
        day = (datetime.utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        chart_data.append({"date": day, "sources": daily_by_source.get(day, {})})

    return jsonify({
        "by_source": [{"source": k, "visits": v} for k, v in sorted(by_source.items(), key=lambda x: -x[1])],
        "by_medium": [{"medium": k, "visits": v} for k, v in sorted(by_medium.items(), key=lambda x: -x[1])],
        "top_referrers": [{"referrer": k, "visits": v} for k, v in sorted(by_referrer.items(), key=lambda x: -x[1])[:20]],
        "daily_by_source": chart_data,
        "days": days,
    })


@analytics_bp.route("/admin/analytics/search-insights", methods=["GET"])
@jwt_required()
def get_search_insights():
    now = datetime.utcnow()
    days = _period_days(30)
    since = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    top_locations = db.session.query(
        SearchLog.location, func.count(SearchLog.id).label("count")
    ).filter(
        SearchLog.created_at >= since,
        SearchLog.location.isnot(None),
        SearchLog.location != "",
    ).group_by(SearchLog.location).order_by(func.count(SearchLog.id).desc()).limit(10).all()

    top_types = db.session.query(
        SearchLog.property_type, func.count(SearchLog.id).label("count")
    ).filter(
        SearchLog.created_at >= since,
        SearchLog.property_type.isnot(None),
        SearchLog.property_type != "",
    ).group_by(SearchLog.property_type).order_by(func.count(SearchLog.id).desc()).limit(10).all()

    budget_ranges = db.session.query(
        SearchLog.min_price, SearchLog.max_price, func.count(SearchLog.id).label("count")
    ).filter(
        SearchLog.created_at >= since,
    ).group_by(SearchLog.min_price, SearchLog.max_price).order_by(func.count(SearchLog.id).desc()).limit(15).all()

    budget_summary = {}
    for row in budget_ranges:
        min_p = row.min_price or 0
        max_p = row.max_price or 999999999
        if min_p == 0 and max_p == 999999999:
            label = "Any"
        elif min_p == 0:
            label = f"Up to {format_price(max_p)}"
        elif max_p == 999999999:
            label = f"{format_price(min_p)}+"
        else:
            label = f"{format_price(min_p)} - {format_price(max_p)}"
        budget_summary[label] = budget_summary.get(label, 0) + row.count

    budget_sorted = [{"range": k, "count": v} for k, v in sorted(budget_summary.items(), key=lambda x: -x[1])]

    raw_daily = db.session.query(
        func.date(SearchLog.created_at).label("day"),
        func.count(SearchLog.id).label("count")
    ).filter(SearchLog.created_at >= since).group_by(func.date(SearchLog.created_at)).all()
    daily_map = {str(r.day): r.count for r in raw_daily}
    daily_searches = [
        {"date": (now - timedelta(days=i)).strftime("%Y-%m-%d"),
         "count": daily_map.get((now - timedelta(days=i)).strftime("%Y-%m-%d"), 0)}
        for i in range(days - 1, -1, -1)
    ]

    total_searches = SearchLog.query.filter(SearchLog.created_at >= since).count()

    return jsonify({
        "total_searches": total_searches,
        "top_locations": [{"location": r[0], "count": r[1]} for r in top_locations],
        "top_property_types": [{"type": r[0], "count": r[1]} for r in top_types],
        "budget_ranges": budget_sorted,
        "daily_searches": daily_searches,
        "days": days,
    })


@analytics_bp.route("/admin/analytics/banner-performance", methods=["GET"])
@jwt_required()
def get_banner_performance():
    now = datetime.utcnow()
    days = _period_days(30)
    since = (now - timedelta(days=days - 1)).replace(hour=0, minute=0, second=0, microsecond=0)

    total_clicks = BannerClick.query.filter(BannerClick.created_at >= since).count()

    by_slide = db.session.query(
        BannerClick.slide_id,
        BannerClick.slide_title,
        func.count(BannerClick.id).label("clicks"),
        func.count(func.distinct(BannerClick.visitor_ip)).label("unique_clicks"),
    ).filter(BannerClick.created_at >= since).group_by(
        BannerClick.slide_id, BannerClick.slide_title
    ).order_by(func.count(BannerClick.id).desc()).all()

    raw_daily = db.session.query(
        func.date(BannerClick.created_at).label("day"),
        func.count(BannerClick.id).label("clicks")
    ).filter(BannerClick.created_at >= since).group_by(func.date(BannerClick.created_at)).all()
    daily_map = {str(r.day): r.clicks for r in raw_daily}
    daily_clicks = [
        {"date": (now - timedelta(days=i)).strftime("%Y-%m-%d"),
         "clicks": daily_map.get((now - timedelta(days=i)).strftime("%Y-%m-%d"), 0)}
        for i in range(days - 1, -1, -1)
    ]

    return jsonify({
        "total_clicks": total_clicks,
        "by_slide": [{"slide_id": r[0], "title": r[1], "clicks": r[2], "unique_clicks": r[3]} for r in by_slide],
        "daily_clicks": daily_clicks,
        "days": days,
    })


def format_price(amount):
    if amount >= 10000000:
        return f"{amount / 10000000:.1f} Cr"
    elif amount >= 100000:
        return f"{amount / 100000:.1f} L"
    elif amount >= 1000:
        return f"{amount / 1000:.0f}K"
    return str(amount)
