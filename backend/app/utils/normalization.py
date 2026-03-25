#backend/app/utils/normalization.py


def normalize_document_type_name(value: str) -> str:
    if not value:
        return ""
    return value.strip().lower().replace(" ", "_").replace("-", "_")

def normalize_case_party_names(value):
    if value is None:
        return []

    if isinstance(value, list):
        cleaned = []
        for item in value:
            text = str(item).strip()
            if text:
                cleaned.append(text)
        return cleaned

    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []

    text = str(value).strip()
    return [text] if text else []


def first_non_empty(*values):
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and value.strip() == "":
            continue
        if isinstance(value, list) and len(value) == 0:
            continue
        return value
    return None


def normalize_to_list(value):
    if value is None:
        return []

    if isinstance(value, list):
        cleaned = []
        for item in value:
            text = str(item).strip()
            if text:
                cleaned.append(text)
        return cleaned

    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []

    text = str(value).strip()
    return [text] if text else []