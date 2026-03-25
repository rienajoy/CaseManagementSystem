from app.services.nlp.document_rules import CASE_TYPE_DOCUMENT_RULES


def compute_missing_documents(case_type: str | None, present_document_types: list[str]) -> list[str]:
    if not case_type:
        return []

    rules = CASE_TYPE_DOCUMENT_RULES.get(case_type.upper())
    if not rules:
        return []

    present = set([doc for doc in present_document_types if doc])

    required_initiating = rules.get("required_initiating", [])
    expected_followup = rules.get("expected_followup", [])

    missing = []

    for doc_type in required_initiating:
        if doc_type not in present:
            missing.append(doc_type)

    for doc_type in expected_followup:
        if doc_type not in present:
            missing.append(doc_type)

    return missing