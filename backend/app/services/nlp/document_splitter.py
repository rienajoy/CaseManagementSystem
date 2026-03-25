#backend/app/services/nlp/document_splitter.py

import re


TITLE_PATTERNS = [
    ("entry_of_judgment", r"^\s*ENTRY\s+OF\s+JUDGMENT\s*$"),
    ("notice_of_appeal", r"^\s*NOTICE\s+OF\s+APPEAL\s*$"),
    ("commitment_order", r"^\s*COMMITMENT\s+ORDER\s*$"),
    ("release_order", r"^\s*RELEASE\s+ORDER\s*$"),
    ("counter_affidavit", r"^\s*COUNTER[\s\-]*AFFIDAVIT\s*$"),
    ("complaint_affidavit", r"^\s*COMPLAINT[\s\-]*AFFIDAVIT\s*$"),
    ("subpoena", r"^\s*SUBPOENA\s*$"),
    ("information", r"^\s*INFORMATION\s*$"),
    ("resolution", r"^\s*RESOLUTION\s*$"),
    ("judgment", r"^\s*(DECISION|JUDGMENT)\s*$"),
    ("order", r"^\s*ORDER\s*$"),
]

STRICT_HEADER_ONLY_TYPES = {
    "counter_affidavit",
    "complaint_affidavit",
}


def normalize_page_text(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\r", "\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def get_page_header_lines(text: str, max_lines: int = 40) -> list[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[:max_lines]


def has_strict_header_title(header_text: str, document_type: str) -> bool:
    """
    For sensitive document types like affidavits, only accept detection
    if the title appears as a standalone header line.
    """
    if document_type == "counter_affidavit":
        return bool(
            re.search(
                r"^\s*COUNTER[\s\-]*AFFIDAVIT\s*$",
                header_text,
                re.IGNORECASE | re.MULTILINE,
            )
        )

    if document_type == "complaint_affidavit":
        return bool(
            re.search(
                r"^\s*COMPLAINT[\s\-]*AFFIDAVIT\s*$",
                header_text,
                re.IGNORECASE | re.MULTILINE,
            )
        )

    return False


def detect_page_document_type(page_text: str) -> str | None:
    """
    Detects the document type of a single page
    based on prominent title/header text.
    """
    if not page_text or not page_text.strip():
        return None

    clean_text = normalize_page_text(page_text)
    header_lines = get_page_header_lines(clean_text, max_lines=40)
    header_text = "\n".join(header_lines)
    header_upper = header_text.upper()

    for document_type, pattern in TITLE_PATTERNS:
        if re.search(pattern, header_text, re.IGNORECASE | re.MULTILINE):
            if document_type in STRICT_HEADER_ONLY_TYPES:
                if has_strict_header_title(header_text, document_type):
                    return document_type
                continue

            return document_type

    # fallback heuristics
    if "PEOPLE OF THE PHILIPPINES" in header_upper and "INFORMATION" in header_upper:
        return "information"

    if re.search(r"\bTHIS\s+RESOLVES\s+THE\s+COMPLAINT\b", header_text, re.IGNORECASE):
        return "resolution"

    if re.search(r"^\s*ORDER\s*$", header_text, re.IGNORECASE | re.MULTILINE):
        return "order"

    return None


def page_still_belongs_to_resolution(page_text: str) -> bool:
    """
    Returns True if the page is likely still part of a RESOLUTION
    even if no title/header is present.
    """
    if not page_text or not page_text.strip():
        return False

    clean_text = normalize_page_text(page_text)
    upper_text = clean_text.upper()

    continuation_markers = [
        "WHEREFORE",
        "BE INDICTED",
        "RESPONDENT SHOULD BE INDICTED",
        "RESPONDENTS SHOULD BE INDICTED",
        "RESPECTFULLY RECOMMENDED",
        "ASSISTANT PROVINCIAL PROSECUTOR",
        "ASSISTANT CITY PROSECUTOR",
        "ASSOCIATE CITY PROSECUTOR",
        "PROVINCIAL PROSECUTOR",
        "CITY PROSECUTOR",
        "APPROVED:",
        "NO PROBABLE CAUSE",
        "THERE EXISTS PROBABLE CAUSE",
        "THERE IS PROBABLE CAUSE",
        "WITHOUT PROBABLE CAUSE",
    ]

    return any(marker in upper_text for marker in continuation_markers)


def split_pages_into_documents(pages: list[dict]) -> list[dict]:
    grouped_documents = []
    current_group = None

    for page in pages:
        page_number = page.get("page_number")
        page_text = page.get("text", "")
        detected_type = detect_page_document_type(page_text)

        if current_group is None:
            current_group = {
                "document_type": detected_type,
                "start_page": page_number,
                "end_page": page_number,
                "pages": [page],
                "text": page_text,
            }
            continue

        current_type = current_group["document_type"]

        # 1. Strong new detected type different from current -> start new doc
        if detected_type is not None and detected_type != current_type:
            grouped_documents.append(current_group)
            current_group = {
                "document_type": detected_type,
                "start_page": page_number,
                "end_page": page_number,
                "pages": [page],
                "text": page_text,
            }
            continue

        # 2. Resolution continuation override only if no new detected type
        if (
            current_type == "resolution"
            and detected_type is None
            and page_still_belongs_to_resolution(page_text)
        ):
            current_group["pages"].append(page)
            current_group["end_page"] = page_number
            current_group["text"] += "\n\n" + page_text
            continue

        # 3. Same detected type -> same logical document
        if detected_type is not None and detected_type == current_type:
            current_group["pages"].append(page)
            current_group["end_page"] = page_number
            current_group["text"] += "\n\n" + page_text
            continue

        # 4. No detected type -> attach to current group
        current_group["pages"].append(page)
        current_group["end_page"] = page_number
        current_group["text"] += "\n\n" + page_text

    if current_group is not None:
        grouped_documents.append(current_group)

    return grouped_documents