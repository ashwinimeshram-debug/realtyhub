from datetime import datetime
from extensions import db

class Setting(db.Model):
    __tablename__ = "settings"

    id = db.Column(db.Integer, primary_key=True)
    skey = db.Column("skey", db.String(100), unique=True, nullable=False)
    svalue = db.Column("svalue", db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
