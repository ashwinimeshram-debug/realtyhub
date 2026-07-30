from datetime import datetime
from extensions import db


class PageVisit(db.Model):
    __tablename__ = "page_visits"

    id = db.Column(db.Integer, primary_key=True)
    page_url = db.Column(db.String(500), nullable=False)
    visitor_ip = db.Column(db.String(100))
    referrer = db.Column(db.String(500))
    utm_source = db.Column(db.String(100))
    utm_medium = db.Column(db.String(100))
    utm_campaign = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SearchLog(db.Model):
    __tablename__ = "search_logs"

    id = db.Column(db.Integer, primary_key=True)
    location = db.Column(db.String(200))
    property_type = db.Column(db.String(100))
    transaction_type = db.Column(db.String(50))
    min_price = db.Column(db.Integer)
    max_price = db.Column(db.Integer)
    visitor_ip = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class BannerClick(db.Model):
    __tablename__ = "banner_clicks"

    id = db.Column(db.Integer, primary_key=True)
    slide_id = db.Column(db.Integer)
    slide_title = db.Column(db.String(300))
    button_link = db.Column(db.String(500))
    page_url = db.Column(db.String(500))
    visitor_ip = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
