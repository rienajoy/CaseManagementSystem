#backend/app/services/nlp/confidence_recalculator.py

from copy import deepcopy


def recalculate_document_confidence(documents: list[dict]) -> list[dict]:
    """
    Recalculate confidence values after reconciliation/corrections so the final
    confidence reflects the final extracted metadata, not only first-pass extraction.
    """
    if not documents:
        return documents

    result = deepcopy(documents)

    for doc in result:
        metadata = doc.get("extracted_metadata", {}) or {}
        confidence = doc.get("confidence", {}) or {}
        review_flags = metadata.get("review_flags", []) or []

        # case_number
        case_number = metadata.get("case_number")
        if case_number:
            if confidence.get("case_number", 0.0) <= 0.0:
                confidence["case_number"] = 0.85

        # docket_number
        docket_number = metadata.get("docket_number")
        if docket_number and confidence.get("docket_number", 0.0) <= 0.0:
            confidence["docket_number"] = 0.85

        # complainants
        complainants = metadata.get("complainants") or []
        if complainants and confidence.get("complainants", 0.0) <= 0.0:
            confidence["complainants"] = 0.85

        # respondents
        respondents = metadata.get("respondents") or []
        if respondents and confidence.get("respondents", 0.0) <= 0.0:
            confidence["respondents"] = 0.85

        # case_title
        case_title = metadata.get("case_title")
        if case_title and confidence.get("case_title", 0.0) <= 0.0:
            confidence["case_title"] = 0.85

        # offense
        offense = metadata.get("offense_or_violation")
        if offense and confidence.get("offense_or_violation", 0.0) <= 0.0:
            confidence["offense_or_violation"] = 0.85

        # date_filed
        date_filed = metadata.get("date_filed")
        if date_filed:
            if "date_filed_corrected_from_same_document_context" in review_flags:
                confidence["date_filed"] = max(confidence.get("date_filed", 0.0), 0.85)
            elif confidence.get("date_filed", 0.0) <= 0.0:
                confidence["date_filed"] = 0.85

        doc["confidence"] = confidence

    return result