"""Shared property-search filtering.

Used by the public properties endpoint and by the saved-search alert cron so
both always apply identical filters.
"""
import math

from sqlalchemy import or_, func, literal, text

from models.models import db, Property

_PG_TRGM_AVAILABLE = None


def pg_trgm_available():
    """Return True if the pg_trgm extension is installed on this database.

    Shared hosting Postgres (e.g. HostyCare) may not ship the contrib package,
    in which case trigram indexes and the ``<%``/``word_similarity`` operators
    are unavailable. The result is cached per process.
    """
    global _PG_TRGM_AVAILABLE
    if _PG_TRGM_AVAILABLE is not None:
        return _PG_TRGM_AVAILABLE
    try:
        if db.engine.dialect.name != "postgresql":
            _PG_TRGM_AVAILABLE = False
            return False
        row = db.session.execute(
            text("select 1 from pg_extension where extname = 'pg_trgm'")
        ).first()
        _PG_TRGM_AVAILABLE = row is not None
    except Exception:  # pragma: no cover - best effort
        _PG_TRGM_AVAILABLE = False
    return _PG_TRGM_AVAILABLE


def apply_near(query, near, radius_km=5.0):
    """Filter a Property query to a lat/lng bounding box, ordered by distance.

    Returns (query, error). Uses an approximate degree bounding box (cheap and
    index-friendly) plus an approximate squared-distance ordering.
    """
    try:
        lat_s, lng_s = str(near).split(",")
        lat = float(lat_s)
        lng = float(lng_s)
    except (ValueError, AttributeError):
        return None, "Invalid near (expected 'lat,lng')"
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None, "Coordinates out of range"
    try:
        radius = float(radius_km) if radius_km else 5.0
    except (ValueError, TypeError):
        return None, "Invalid radius_km"
    if radius <= 0:
        return None, "Invalid radius_km"

    dlat = radius / 111.0
    dlng = radius / (111.0 * max(math.cos(math.radians(lat)), 1e-6))
    query = query.filter(
        Property.latitude.isnot(None),
        Property.longitude.isnot(None),
        Property.latitude.between(lat - dlat, lat + dlat),
        Property.longitude.between(lng - dlng, lng + dlng),
    )
    lat_delta = (Property.latitude - lat)
    lng_delta = (Property.longitude - lng) * math.cos(math.radians(lat))
    query = query.order_by(lat_delta * lat_delta + lng_delta * lng_delta)
    return query, None


def apply_property_filters(query, params):
    """Apply public search filters to a Property query.

    `params` may be a request.args MultiDict or a plain dict. Returns
    (query, error, keyword). `keyword` is returned so callers can rank results.
    """
    keyword = params.get("q") or params.get("keyword")
    location = params.get("location")
    transaction_type = params.get("type")
    property_type = params.get("category")
    min_price = params.get("min_price")
    max_price = params.get("max_price")
    featured = params.get("featured")
    near = params.get("near")
    radius_km = params.get("radius_km")

    if location:
        query = query.filter(Property.location.ilike(f"%{location}%"))
    if keyword:
        pattern = f"%{keyword}%"
        clauses = [
            Property.title.ilike(pattern),
            Property.location.ilike(pattern),
            Property.description.ilike(pattern),
        ]
        # Substring match (index-accelerated by GIN trigram) plus fuzzy
        # trigram match (the `<%` operator) so typos still return results.
        # The fuzzy clauses require the pg_trgm extension, which shared
        # hosting Postgres may not provide.
        if pg_trgm_available():
            clauses.append(literal(keyword).op("<%")(Property.title))
            clauses.append(literal(keyword).op("<%")(Property.location))
        query = query.filter(or_(*clauses))
    if transaction_type:
        query = query.filter_by(transaction_type=transaction_type)
    if property_type:
        query = query.filter_by(property_type=property_type)
    if min_price:
        try:
            query = query.filter(Property.price >= float(min_price))
        except (ValueError, TypeError):
            return None, "Invalid min_price", keyword
    if max_price:
        try:
            query = query.filter(Property.price <= float(max_price))
        except (ValueError, TypeError):
            return None, "Invalid max_price", keyword
    if featured == "true":
        query = query.filter_by(is_featured=True)
    if near:
        query, geo_err = apply_near(query, near, radius_km)
        if geo_err:
            return None, geo_err, keyword

    return query, None, keyword
