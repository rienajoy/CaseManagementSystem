#backend/app/services/nlp/normalizer.py

import re
from dateutil import parser


def normalize_date(date_str: str):
    if not date_str:
        return None

    value = date_str.strip()

    # Reject incomplete dates like:
    # "December 2012"
    # "day of December 2012"
    # where no actual numeric day is present
    has_year = re.search(r"\b\d{4}\b", value)
    has_day_number = re.search(r"\b\d{1,2}\b", value)
    has_month_name = re.search(
        r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\b",
        value,
        re.IGNORECASE
    )

    if has_month_name and has_year and not has_day_number:
        return None

    try:
        dt = parser.parse(value, dayfirst=False, fuzzy=True)
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None


def normalize_whitespace(value: str | None):
    if not value:
        return None
    return " ".join(value.split()).strip()