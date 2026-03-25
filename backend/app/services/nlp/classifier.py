#backend/app/services/nlp/classifier.py

import re
from app.services.nlp.confidence import confidence_found, confidence_missing


def normalize_for_classification(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\r", "\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def get_first_lines(text: str, max_lines: int = 40) -> list[str]:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return lines[:max_lines]


def classify_document(text: str):
    if not text or not text.strip():
        return None, confidence_missing()

    clean_text = normalize_for_classification(text)
    lines = get_first_lines(clean_text, max_lines=40)

    header_text = "\n".join(lines)
    header_upper = header_text.upper()

    # exact title helper
    def has_exact_title(pattern: str) -> bool:
        return re.search(pattern, header_text, re.IGNORECASE | re.MULTILINE) is not None

    # -------------------------
    # MOST SPECIFIC FIRST
    # -------------------------

    if has_exact_title(r"^\s*ENTRY\s+OF\s+JUDGMENT\s*$"):
        return "entry_of_judgment", confidence_found(True)

    if has_exact_title(r"^\s*NOTICE\s+OF\s+APPEAL\s*$"):
        return "notice_of_appeal", confidence_found(True)

    if has_exact_title(r"^\s*COMMITMENT\s+ORDER\s*$"):
        return "commitment_order", confidence_found(True)

    if has_exact_title(r"^\s*RELEASE\s+ORDER\s*$"):
        return "release_order", confidence_found(True)

    if has_exact_title(r"^\s*COUNTER[\s\-]*AFFIDAVIT\s*$"):
        return "counter_affidavit", confidence_found(True)

    if has_exact_title(r"^\s*COMPLAINT[\s\-]*AFFIDAVIT\s*$"):
        return "complaint_affidavit", confidence_found(True)

    if has_exact_title(r"^\s*SUBPOENA\s*$"):
        return "subpoena", confidence_found(True)

    if has_exact_title(r"^\s*INFORMATION\s*$"):
        return "information", confidence_found(True)

    # resolution should be strict
    if has_exact_title(r"^\s*RESOLUTION\s*$"):
        return "resolution", confidence_found(True)

    if has_exact_title(r"^\s*(DECISION|JUDGMENT)\s*$"):
        return "judgment", confidence_found(True)

    if has_exact_title(r"^\s*COMMITMENT\s+ORDER\s*$"):
        return "commitment_order", confidence_found(True)

    if has_exact_title(r"^\s*RELEASE\s+ORDER\s*$"):
        return "release_order", confidence_found(True)

    if has_exact_title(r"^\s*ORDER\s*$"):
        return "order", confidence_found(True)

    if has_exact_title(r"^\s*AFFIDAVIT\s+OF\s+ARREST\s*$"):
        return "affidavit_of_arrest", confidence_found(True)

    if has_exact_title(r"^\s*AFFIDAVIT\s+OF\s+APPREHENSION\s*$"):
        return "affidavit_of_apprehension", confidence_found(True)

    if has_exact_title(r"^\s*INVESTIGATION\s+REPORT\s*$"):
        return "police_investigation_report", confidence_found(True)

    if has_exact_title(r"^\s*POLICE\s+INVESTIGATION\s+REPORT\s*$"):
        return "police_investigation_report", confidence_found(True)

    if has_exact_title(r"^\s*REFERRAL\s+LETTER\s*$"):
        return "referral_letter", confidence_found(True)

    if has_exact_title(r"^\s*INQUEST\s+RESOLUTION\s*$"):
        return "inquest_resolution", confidence_found(True)

    # -------------------------
    # FALLBACK HEURISTICS
    # header only gihapon, not whole text
    # -------------------------

    if "COUNTER-AFFIDAVIT" in header_upper or "COUNTER AFFIDAVIT" in header_upper:
        return "counter_affidavit", confidence_found(False)

    if "COMPLAINT-AFFIDAVIT" in header_upper or "COMPLAINT AFFIDAVIT" in header_upper:
        return "complaint_affidavit", confidence_found(False)

    if re.search(r"\bTHIS\s+RESOLVES\s+THE\s+COMPLAINT\b", header_text, re.IGNORECASE):
        return "resolution", confidence_found(False)

    if "PEOPLE OF THE PHILIPPINES" in header_upper and "INFORMATION" in header_upper:
        return "information", confidence_found(False)

    if "COMMITMENT ORDER" in header_upper:
        return "commitment_order", confidence_found(False)

    if "RELEASE ORDER" in header_upper:
        return "release_order", confidence_found(False)

    if "ORDER" in header_upper:
        return "order", confidence_found(False)

    if "AFFIDAVIT OF ARREST" in header_upper:
        return "affidavit_of_arrest", confidence_found(False)

    if "AFFIDAVIT OF APPREHENSION" in header_upper:
        return "affidavit_of_apprehension", confidence_found(False)

    if "INVESTIGATION REPORT" in header_upper:
        return "police_investigation_report", confidence_found(False)

    if "REFERRAL LETTER" in header_upper:
        return "referral_letter", confidence_found(False)

    if "INQUEST RESOLUTION" in header_upper:
        return "inquest_resolution", confidence_found(False)

    

    return None, confidence_missing()