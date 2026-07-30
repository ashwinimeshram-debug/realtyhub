DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 200


def generate_listing_id(id):
    return f"PROP-{str(id).zfill(6)}"


def paginate(query, page=None, per_page=None):
    if page is not None:
        try:
            page = int(page)
        except (ValueError, TypeError):
            page = 1
    else:
        page = 1
    if per_page is not None:
        try:
            per_page = int(per_page)
        except (ValueError, TypeError):
            per_page = DEFAULT_PAGE_SIZE
    else:
        per_page = DEFAULT_PAGE_SIZE
    if page < 1:
        page = 1
    if per_page < 1:
        per_page = DEFAULT_PAGE_SIZE
    if per_page > MAX_PAGE_SIZE:
        per_page = MAX_PAGE_SIZE
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return items, total, page, per_page