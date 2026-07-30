from datetime import datetime
# from models.models import db
from extensions import db

# =========================
# 🖼️ HERO SLIDES
# =========================
class HeroSlide(db.Model):
    __tablename__ = "hero_slides"

    id = db.Column(db.Integer, primary_key=True)
    image = db.Column(db.String(255), nullable=False)

    title = db.Column(db.String(255), nullable=False)
    subtitle = db.Column(db.String(255))

    button_text = db.Column(db.String(100))
    button_link = db.Column(db.String(255))

    overlay_opacity = db.Column(db.Integer, default=40)

    title_color = db.Column(db.String(20))
    title_align = db.Column(db.String(10))
    title_font_family = db.Column(db.String(100))
    title_font_size = db.Column(db.Integer)
    title_font_style = db.Column(db.String(20))
    title_line_height = db.Column(db.Integer)

    subtitle_color = db.Column(db.String(20))
    subtitle_align = db.Column(db.String(10))
    subtitle_font_family = db.Column(db.String(100))
    subtitle_font_size = db.Column(db.Integer)
    subtitle_font_style = db.Column(db.String(20))
    subtitle_line_height = db.Column(db.Integer)

    background_color = db.Column(db.String(20))
    button_color = db.Column(db.String(20))
    button_bg_color = db.Column(db.String(20))
    button_align = db.Column(db.String(10))
    button_font_family = db.Column(db.String(100))
    button_font_size = db.Column(db.Integer)
    button_font_style = db.Column(db.String(20))

    content_vertical = db.Column(db.String(10))

    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<HeroSlide {self.title}>"

# =========================
# 🧩 SERVICES
# =========================
class Service(db.Model):
    __tablename__ = "services"

    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)

    image = db.Column(db.String(255))

    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Service {self.title}>"

# =========================
# ⭐ ADVANTAGES
# =========================
class Advantage(db.Model):
    __tablename__ = "advantages"

    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)

    icon = db.Column(db.String(100))  # optional

    is_active = db.Column(db.Boolean, default=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Advantage {self.title}>"