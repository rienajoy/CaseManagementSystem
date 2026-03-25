#utils/pagination.py
from flask import request

def parse_pagination_params():
    try:
        page = int(request.args.get("page", 1))
    except ValueError:
        page = 1

    try:
        per_page = int(request.args.get("per_page", 10))
    except ValueError:
        per_page = 10

    if page < 1:
        page = 1

    if per_page < 1:
        per_page = 10
    elif per_page > 100:
        per_page = 100

    return page, per_page


def paginate_list(items, page, per_page):
    total = len(items)
    start = (page - 1) * per_page
    end = start + per_page
    paginated_items = items[start:end]

    total_pages = (total + per_page - 1) // per_page if total > 0 else 1

    return {
        "items": paginated_items,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total": total,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1,
        }
    }

def normalize_sort_direction(value, default="desc"):
    value = (value or default).strip().lower()
    return "asc" if value == "asc" else "desc"