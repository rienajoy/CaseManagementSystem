#backend/app/services/nlp/patterns.py


DATE_PATTERNS = [
    r"\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b",
    r"\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b",
    r"\b\d{1,2}/\d{1,2}/\d{4}\b",
]

DOCKET_PATTERNS = [
    r"(?:NPS\s+)?Docket\s+No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
    r"Docket\s+Number\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
]

CASE_NUMBER_PATTERNS = [
    r"Criminal\s+Case\s+No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
    r"Crim\.?\s+Case\s+No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
    r"Case\s+No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
    r"CRIMINAL\s+CASE\s+NO\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
    r"CRIM\.?\s+CASE\s+NO\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
    r"CASE\s+NO\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
]