#backend/app/services/nlp/document_reconciler.py

from copy import deepcopy



def pick_first_non_empty(values):
    for value in values:
        if value:
            return value
    return None


def pick_best_list(values_list):
    for values in values_list:
        if values:
            return values
    return []


def gather_bundle_context(documents: list[dict]) -> dict:
    all_metadata = [doc.get("extracted_metadata", {}) or {} for doc in documents]

    return {
        "docket_number": pick_first_non_empty([m.get("docket_number") for m in all_metadata]),
        "case_number": pick_first_non_empty([m.get("case_number") for m in all_metadata]),
        "complainants": pick_best_list([m.get("complainants") or [] for m in all_metadata]),
        "respondents": pick_best_list([m.get("respondents") or [] for m in all_metadata]),
        "offense_or_violation": pick_first_non_empty([m.get("offense_or_violation") for m in all_metadata]),
        "assigned_prosecutor": pick_first_non_empty([m.get("assigned_prosecutor") for m in all_metadata]),
        "resolution_date": pick_first_non_empty([m.get("resolution_date") for m in all_metadata]),
        "filed_in_court_date": pick_first_non_empty([m.get("filed_in_court_date") for m in all_metadata]),

        # INQ-specific
        "arrest_date": pick_first_non_empty([m.get("arrest_date") for m in all_metadata]),
        "arrest_time": pick_first_non_empty([m.get("arrest_time") for m in all_metadata]),
        "arrest_place": pick_first_non_empty([m.get("arrest_place") for m in all_metadata]),
        "arresting_officers": pick_best_list([m.get("arresting_officers") or [] for m in all_metadata]),
        "inquest_referral_date": pick_first_non_empty([m.get("inquest_referral_date") for m in all_metadata]),
        "warrantless_arrest_basis": pick_first_non_empty([m.get("warrantless_arrest_basis") for m in all_metadata]),
    }


def normalize_party_list(values):
    if not values:
        return []
    return sorted([v.strip().upper() for v in values if v and v.strip()])


def same_case_parties(doc_a: dict, doc_b: dict) -> bool:
    meta_a = doc_a.get("extracted_metadata", {})
    meta_b = doc_b.get("extracted_metadata", {})

    comp_a = normalize_party_list(meta_a.get("complainants", []))
    comp_b = normalize_party_list(meta_b.get("complainants", []))

    resp_a = normalize_party_list(meta_a.get("respondents", []))
    resp_b = normalize_party_list(meta_b.get("respondents", []))

    if comp_a and comp_b and comp_a != comp_b:
        return False

    if resp_a and resp_b and resp_a != resp_b:
        return False

    # at least one side must match strongly
    if comp_a and comp_b and comp_a == comp_b:
        return True

    if resp_a and resp_b and resp_a == resp_b:
        return True

    return False


def score_source_document(doc: dict) -> int:
    """
    Higher score = better donor document for inheritance.
    """
    meta = doc.get("extracted_metadata", {})
    doc_type = (doc.get("document_type") or "").lower()

    score = 0

    # prioritize cleaner court docs
    if doc_type in {"order", "commitment_order", "release_order", "judgment"}:
        score += 4
    elif doc_type == "information":
        score += 2
    elif doc_type == "resolution":
        score += 2

    if meta.get("case_number"):
        score += 3
    if meta.get("case_title"):
        score += 2
    if meta.get("complainants"):
        score += 1
    if meta.get("respondents"):
        score += 1
    if meta.get("offense_or_violation"):
        score += 1

    return score


def fill_missing_case_fields(documents: list[dict], case_type: str | None = None) -> list[dict]:
    if not documents:
        return documents

    result = deepcopy(documents)
    bundle = gather_bundle_context(result)
    normalized_case_type = (case_type or "").upper().strip()

    for doc in result:
        metadata = doc.get("extracted_metadata", {}) or {}

        # shared fields
        if not metadata.get("docket_number") and bundle.get("docket_number"):
            metadata["docket_number"] = bundle["docket_number"]

        if not metadata.get("case_number") and bundle.get("case_number"):
            metadata["case_number"] = bundle["case_number"]

        if not metadata.get("complainants") and bundle.get("complainants"):
            metadata["complainants"] = bundle["complainants"]

        if not metadata.get("respondents") and bundle.get("respondents"):
            metadata["respondents"] = bundle["respondents"]

        if not metadata.get("offense_or_violation") and bundle.get("offense_or_violation"):
            metadata["offense_or_violation"] = bundle["offense_or_violation"]

        if not metadata.get("assigned_prosecutor") and bundle.get("assigned_prosecutor"):
            metadata["assigned_prosecutor"] = bundle["assigned_prosecutor"]

        if not metadata.get("resolution_date") and bundle.get("resolution_date"):
            metadata["resolution_date"] = bundle["resolution_date"]

        if not metadata.get("filed_in_court_date") and bundle.get("filed_in_court_date"):
            metadata["filed_in_court_date"] = bundle["filed_in_court_date"]

        # INQ-specific propagation
        if normalized_case_type == "INQ":
            if not metadata.get("arrest_date") and bundle.get("arrest_date"):
                metadata["arrest_date"] = bundle["arrest_date"]

            if not metadata.get("arrest_time") and bundle.get("arrest_time"):
                metadata["arrest_time"] = bundle["arrest_time"]

            if not metadata.get("arrest_place") and bundle.get("arrest_place"):
                metadata["arrest_place"] = bundle["arrest_place"]

            if not metadata.get("arresting_officers") and bundle.get("arresting_officers"):
                metadata["arresting_officers"] = bundle["arresting_officers"]

            if not metadata.get("inquest_referral_date") and bundle.get("inquest_referral_date"):
                metadata["inquest_referral_date"] = bundle["inquest_referral_date"]

            if not metadata.get("warrantless_arrest_basis") and bundle.get("warrantless_arrest_basis"):
                metadata["warrantless_arrest_basis"] = bundle["warrantless_arrest_basis"]

        # rebuild case title if possible
        complainants = metadata.get("complainants") or []
        respondents = metadata.get("respondents") or []
        if complainants and respondents:
            metadata["case_title"] = f"{', '.join(complainants)} VS. {', '.join(respondents)}"

        doc["extracted_metadata"] = metadata

    return result

    
def add_bundle_consistency_warnings(documents: list[dict]) -> list[dict]:
    """
    Adds warnings only when there is a real majority year among matching
    sibling documents in the same case cluster.

    Rule:
    - Collect all dated docs in the same case cluster (including target doc).
    - If a year appears at least 2 times, treat it as a consensus year.
    - Warn only docs whose year differs from that consensus year.
    - If there is no consensus (e.g. only one doc per year), do not warn.
    """
    if not documents:
        return documents

    result = deepcopy(documents)

    for i, target_doc in enumerate(result):
        target_meta = target_doc.get("extracted_metadata", {})
        target_warnings = target_doc.get("warnings", []) or []

        target_date = target_meta.get("date_filed")
        if not target_date or len(target_date) < 4:
            target_doc["warnings"] = target_warnings
            continue

        target_year = target_date[:4]

        cluster_year_counts = {}

        for j, source_doc in enumerate(result):
            if not same_case_parties(target_doc, source_doc):
                continue

            source_meta = source_doc.get("extracted_metadata", {})
            source_date = source_meta.get("date_filed")

            if source_date and len(source_date) >= 4:
                year = source_date[:4]
                cluster_year_counts[year] = cluster_year_counts.get(year, 0) + 1

        if not cluster_year_counts:
            target_doc["warnings"] = target_warnings
            continue

        dominant_year, dominant_count = max(cluster_year_counts.items(), key=lambda x: x[1])

        # require at least 2 documents agreeing on the same year
        if dominant_count >= 2 and target_year != dominant_year:
            if "possible_year_inconsistency_across_bundle" not in target_warnings:
                target_warnings.append("possible_year_inconsistency_across_bundle")

            if "date_filed year differs from sibling case documents" not in target_warnings:
                target_warnings.append("date_filed year differs from sibling case documents")
        else:
            # remove stale inconsistency warnings if present
            target_warnings = [
                w for w in target_warnings
                if w not in {
                    "possible_year_inconsistency_across_bundle",
                    "date_filed year differs from sibling case documents",
                }
            ]

        target_doc["warnings"] = target_warnings

    return result


def add_review_suggestions(documents: list[dict], case_type: str | None = None) -> list[dict]:
    if not documents:
        return documents

    result = deepcopy(documents)
    normalized_case_type = (case_type or "").upper().strip()

    for doc in result:
        metadata = doc.get("extracted_metadata", {}) or {}
        warnings = doc.get("warnings", []) or []
        review_flags = metadata.get("review_flags", []) or []
        document_type = doc.get("document_type")

        suggestions = []

        if normalized_case_type == "INV":
            if document_type == "complaint_affidavit" and not metadata.get("respondents"):
                suggestions.append("review respondent extraction from affidavit body")
            if document_type == "resolution" and not metadata.get("resolution_date"):
                suggestions.append("review resolution signature/date block")
            if document_type == "information" and not metadata.get("filed_in_court_date"):
                suggestions.append("review information signature / subscribed-and-sworn portion")

        if normalized_case_type == "INQ":
            if document_type in ["affidavit_of_arrest", "affidavit_of_apprehension"]:
                if not metadata.get("arrest_date"):
                    suggestions.append("review arrest date from arrest narrative")
                if not metadata.get("respondents"):
                    suggestions.append("review arrested/apprehended person extraction")

            if document_type == "police_investigation_report":
                if not metadata.get("respondents"):
                    suggestions.append("review suspect/respondent extraction from report body")

            if document_type == "referral_letter":
                if not metadata.get("inquest_referral_date"):
                    suggestions.append("review referral letter date block")

            if document_type == "inquest_resolution":
                if not metadata.get("resolution_date"):
                    suggestions.append("review inquest resolution signature/date block")

        metadata["review_flags"] = list(dict.fromkeys(review_flags + suggestions))
        doc["extracted_metadata"] = metadata

    return result

def cleanup_resolved_warnings(documents: list[dict], case_type: str | None = None) -> list[dict]:
    if not documents:
        return documents

    result = deepcopy(documents)

    for doc in result:
        metadata = doc.get("extracted_metadata", {}) or {}
        warnings = doc.get("warnings", []) or []
        document_type = doc.get("document_type")

        cleaned = []

        for warning in warnings:
            if warning == "docket_number not found" and metadata.get("docket_number"):
                continue
            if warning == "case_number not found" and metadata.get("case_number"):
                continue
            if warning == "complainants not found" and (metadata.get("complainants") or []):
                continue
            if warning == "respondents not found" and (metadata.get("respondents") or []):
                continue
            if warning == "offense_or_violation not found" and metadata.get("offense_or_violation"):
                continue
            if warning == "resolution_date not found" and metadata.get("resolution_date"):
                continue
            if warning == "filed_in_court_date not found" and metadata.get("filed_in_court_date"):
                continue
            if warning == "arrest_date not found" and metadata.get("arrest_date"):
                continue
            if warning == "inquest_referral_date not found" and metadata.get("inquest_referral_date"):
                continue

            cleaned.append(warning)

        doc["warnings"] = cleaned

    return result