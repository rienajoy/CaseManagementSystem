#backend/app/utils/dates.py

from datetime import datetime

def parse_optional_datetime(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    try:
        return datetime.fromisoformat(value)
    except Exception:
        pass

    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except Exception:
        return None