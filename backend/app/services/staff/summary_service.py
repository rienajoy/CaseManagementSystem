#backend/app/services/staff/summary_service.py

from datetime import datetime
from model import IntakeCase, IntakeCaseDocument, Case
from app.utils.normalization import normalize_to_list, first_non_empty
from app.constants.staff_case_constants import INQ_INITIATING_DOCUMENT_TYPES
import re
from collections import defaultdict
from sqlalchemy.orm import Session
from app.services.staff.intake_document_service import has_any_uploaded, get_case_type_resolution_types


import re
from collections import defaultdict

MAX_OFFENSES = 20

OFFENSE_CATEGORY_RULES = [
    ("Theft", ["theft", "qualified theft"]),
    ("Robbery", ["robbery"]),
    ("Estafa", ["estafa", "swindling"]),
    ("Falsification", ["falsification", "forgery"]),
    ("Physical Injuries", ["physical injur"]),
    ("Homicide", ["homicide"]),
    ("Murder", ["murder"]),
    ("Rape", ["rape"]),
    ("Acts of Lasciviousness", ["acts of lascivious"]),
    ("Drug Cases", ["dangerous drugs", "drug"]),
    ("VAWC", ["violence against women", "vawc"]),
    ("Child Abuse", ["child abuse"]),
    ("Trespass", ["trespass"]),
    ("Malicious Mischief", ["malicious mischief"]),
    ("Threats", ["threat"]),
    ("Coercion", ["coercion"]),
    ("Firearms Cases", ["firearm"]),
    ("Cybercrime", ["cyber"]),
    ("BP 22", ["bp 22", "bouncing check"]),
    ("Fencing", ["fencing"]),
]

def _is_blank(value):
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, list):
        return len([x for x in value if str(x).strip()]) == 0
    return False


def build_canonical_update_candidates(current_summary, reviewed_data, document):
    reviewed_data = reviewed_data or {}
    current_summary = current_summary or {}

    tracked_fields = [
        "document_type",
        "date_filed",
        "docket_number",
        "case_number",
        "complainants",
        "respondents",
        "offense_or_violation",
        "case_title",
        "assigned_prosecutor",
        "assigned_prosecutor_id",
        "resolution_date",
        "filed_in_court_date",
        "court_branch",
        "case_status",
        "prosecution_result",
        "court_result",
    ]

    candidates = []

    for field in tracked_fields:
        current_value = current_summary.get(field)
        proposed_value = reviewed_data.get(field)

        if field in {"complainants", "respondents", "review_flags"}:
            current_value = normalize_to_list(current_value)
            proposed_value = normalize_to_list(proposed_value)

        # blank does not replace anything
        if _is_blank(proposed_value):
            continue

        # if canonical is blank, auto-fill later; no need to ask user
        if _is_blank(current_value):
            continue

        # no conflict if same
        if current_value == proposed_value:
            continue

        candidates.append({
            "field": field,
            "current_value": current_value,
            "proposed_value": proposed_value,
            "document_id": document.id,
            "document_type": document.document_type,
            "source_level": "reviewed",
        })

    return candidates

def get_latest_saved_reviewed_data_for_intake_case(db, intake_case_id, exclude_document_id=None):
    documents = (
        db.query(IntakeCaseDocument)
        .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
        .order_by(IntakeCaseDocument.reviewed_at.asc(), IntakeCaseDocument.created_at.asc())
        .all()
    )

    latest = {
        "document_type": None,
        "case_title": None,
        "docket_number": None,
        "case_number": None,
        "date_filed": None,
        "offense_or_violation": None,
        "assigned_prosecutor": None,
        "assigned_prosecutor_id": None,
        "case_status": None,
        "prosecution_result": None,
        "court_result": None,
        "resolution_date": None,
        "filed_in_court_date": None,
        "court_branch": None,
        "complainants": [],
        "respondents": [],
        "review_flags": [],
    }

    for doc in documents:
        if exclude_document_id and doc.id == exclude_document_id:
            continue

        reviewed = doc.reviewed_data or {}
        if not reviewed:
            continue

        for key, value in reviewed.items():
            if key in {"complainants", "respondents", "review_flags"}:
                normalized = normalize_to_list(value)
                if normalized:
                    latest[key] = normalized
            else:
                if value not in (None, "", []):
                    latest[key] = value

    return latest
    

def normalize_offense_category(raw_name):
    name = (raw_name or "").strip().lower()

    if not name:
        return None

    for category, keywords in OFFENSE_CATEGORY_RULES:
        for keyword in keywords:
            if keyword in name:
                return category

    return "Other Violations"


def split_offense_text(raw_text):
    """
    Split offense text into parts.
    Handles commas, semicolons, slashes, and newlines.
    """
    if not raw_text:
        return []

    if isinstance(raw_text, list):
        parts = []
        for item in raw_text:
            parts.extend(split_offense_text(item))
        return parts

    parts = re.split(r"[,\n;]+|/+", str(raw_text))
    cleaned = [part.strip() for part in parts if part and part.strip()]
    return cleaned


def extract_case_categories(raw_text):
    """
    Return a set of major categories for one case.
    Uses a set so one case is counted only once per category.
    """
    categories = set()

    parts = split_offense_text(raw_text)

    if not parts and raw_text:
        parts = [str(raw_text).strip()]

    for part in parts:
        category = normalize_offense_category(part)
        if category:
            categories.add(category)

    return categories


def get_dashboard_offense_chart_data(db, intake_cases, official_cases, legacy_cases=None, limit=MAX_OFFENSES):
    """
    Build top offense categories for dashboard.

    - unconverted intake cases only
    - official cases
    - legacy cases
    - one case counts only once per category
    """
    category_case_keys = defaultdict(set)

    # Intake cases (skip converted para walay double count)
    for intake_case in intake_cases:
        if intake_case.converted_case_id:
            continue

        extracted = intake_case.extracted_data or {}

        if not isinstance(extracted, dict) or not (
            extracted.get("offense_or_violation")
            or extracted.get("offense")
            or extracted.get("violation")
        ):
            extracted = summarize_intake_case_from_documents(db, intake_case.id) or {}

        raw_offense = None
        if isinstance(extracted, dict):
            raw_offense = (
                extracted.get("offense_or_violation")
                or extracted.get("offense")
                or extracted.get("violation")
            )

        for category in extract_case_categories(raw_offense):
            category_case_keys[category].add(f"intake:{intake_case.id}")

    # Official cases
    for case in official_cases:
        for category in extract_case_categories(case.offense_or_violation):
            category_case_keys[category].add(f"official:{case.id}")

    # Legacy cases
    for case in (legacy_cases or []):
        for category in extract_case_categories(case.offense_or_violation):
            category_case_keys[category].add(f"legacy:{case.id}")

    grouped = [
        {"name": category, "total": len(case_keys)}
        for category, case_keys in category_case_keys.items()
    ]

    grouped.sort(key=lambda item: item["total"], reverse=True)
    return grouped[:limit]

# -----------------------------
# Summary / state helpers
# -----------------------------
def summarize_intake_case_from_documents(db, intake_case_id):
    from app.services.staff.intake_document_service import (
        get_existing_initiating_document,
        get_case_type_resolution_types,
    )

    documents = (
        db.query(IntakeCaseDocument)
        .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
        .order_by(IntakeCaseDocument.created_at.asc())
        .all()
    )

    summary = {
        "document_type": None,
        "date_filed": None,
        "docket_number": None,
        "case_number": None,
        "complainants": [],
        "respondents": [],
        "offense_or_violation": None,
        "case_title": None,
        "assigned_prosecutor": None,
        "assigned_prosecutor_id": None,
        "resolution_date": None,
        "filed_in_court_date": None,
        "court_branch": None,
        "case_status": None,
        "prosecution_result": None,
        "court_result": None,
        "review_flags": [],
        "warnings": [],
        "uploaded_document_types": [],
        "summary_field_sources": {},
        "summary_conflicts": [],
    }

    if not documents:
        return summary

    intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()

    latest_resolution_doc = get_latest_preferred_document(
        documents,
        get_case_type_resolution_types(intake_case.case_type) if intake_case else {"resolution"}
    )
    latest_information_doc = get_latest_preferred_document(documents, {"information"})
    latest_subpoena_doc = get_latest_preferred_document(documents, {"subpoena"})
    latest_counter_affidavit_doc = get_latest_preferred_document(documents, {"counter_affidavit"})

    def is_blank(value):
        if value is None:
            return True
        if isinstance(value, str):
            return not value.strip()
        if isinstance(value, list):
            return len([x for x in value if str(x).strip()]) == 0
        return False

    def normalize_list_value(value):
        return normalize_to_list(value)

    def get_doc_data(doc):
        extracted_blob = doc.extracted_data or {}
        extracted_meta = extracted_blob.get("metadata", {}) or {}
        reviewed_meta = doc.reviewed_data or {}

        if getattr(doc, "is_initiating_document", False):
            merged = reviewed_meta or extracted_meta
        elif doc.is_reviewed:
            merged = reviewed_meta or {}
        else:
            return {}

        merged = dict(merged)
        merged["complainants"] = normalize_list_value(merged.get("complainants"))
        merged["respondents"] = normalize_list_value(merged.get("respondents"))
        merged["review_flags"] = normalize_list_value(merged.get("review_flags"))
        return merged

    def get_source_info(doc):
        return {
            "document_id": doc.id,
            "document_type": doc.document_type,
            "source_level": "reviewed" if (doc.is_reviewed and doc.reviewed_data) else "extracted",
            "created_at": doc.created_at.isoformat() if doc.created_at else None,
            "reviewed_at": doc.reviewed_at.isoformat() if getattr(doc, "reviewed_at", None) else None,
        }

    def merge_scalar(field_name, proposed_value, source_info):
        if is_blank(proposed_value):
            return

        current_value = summary.get(field_name)

        if is_blank(current_value):
            summary[field_name] = proposed_value
            summary["summary_field_sources"][field_name] = source_info
            return

        if current_value == proposed_value:
            return

        current_source = summary["summary_field_sources"].get(field_name, {})
        current_level = current_source.get("source_level")
        proposed_level = source_info.get("source_level")

        current_reviewed_at = current_source.get("reviewed_at") or current_source.get("created_at")
        proposed_reviewed_at = source_info.get("reviewed_at") or source_info.get("created_at")

        if current_level != "reviewed" and proposed_level == "reviewed":
            summary[field_name] = proposed_value
            summary["summary_field_sources"][field_name] = source_info
            return

        if current_level == "reviewed" and proposed_level == "reviewed":
            if (proposed_reviewed_at or "") >= (current_reviewed_at or ""):
                summary["summary_conflicts"].append({
                    "field": field_name,
                    "current_value": current_value,
                    "proposed_value": proposed_value,
                    "document_id": source_info.get("document_id"),
                    "document_type": source_info.get("document_type"),
                    "source_level": source_info.get("source_level"),
                    "status": "resolved_latest_reviewed_wins",
                })
                summary[field_name] = proposed_value
                summary["summary_field_sources"][field_name] = source_info
            return

        summary["summary_conflicts"].append({
            "field": field_name,
            "current_value": current_value,
            "proposed_value": proposed_value,
            "document_id": source_info.get("document_id"),
            "document_type": source_info.get("document_type"),
            "source_level": source_info.get("source_level"),
            "status": "pending",
        })

    def merge_list(field_name, proposed_value, source_info):
        proposed_list = normalize_list_value(proposed_value)
        if not proposed_list:
            return

        current_list = normalize_list_value(summary.get(field_name))

        if not current_list:
            summary[field_name] = proposed_list
            summary["summary_field_sources"][field_name] = source_info
            return

        if current_list == proposed_list:
            return

        current_source = summary["summary_field_sources"].get(field_name, {})
        current_level = current_source.get("source_level")
        proposed_level = source_info.get("source_level")

        current_reviewed_at = current_source.get("reviewed_at") or current_source.get("created_at")
        proposed_reviewed_at = source_info.get("reviewed_at") or source_info.get("created_at")

        if current_level != "reviewed" and proposed_level == "reviewed":
            summary[field_name] = proposed_list
            summary["summary_field_sources"][field_name] = source_info
            return

        if current_level == "reviewed" and proposed_level == "reviewed":
            if (proposed_reviewed_at or "") >= (current_reviewed_at or ""):
                summary["summary_conflicts"].append({
                    "field": field_name,
                    "current_value": current_list,
                    "proposed_value": proposed_list,
                    "document_id": source_info.get("document_id"),
                    "document_type": source_info.get("document_type"),
                    "source_level": source_info.get("source_level"),
                    "status": "resolved_latest_reviewed_wins",
                })
                summary[field_name] = proposed_list
                summary["summary_field_sources"][field_name] = source_info
            return

        summary["summary_conflicts"].append({
            "field": field_name,
            "current_value": current_list,
            "proposed_value": proposed_list,
            "document_id": source_info.get("document_id"),
            "document_type": source_info.get("document_type"),
            "source_level": source_info.get("source_level"),
            "status": "pending",
        })

    for doc in documents:
        if doc.document_type and doc.document_type not in summary["uploaded_document_types"]:
            summary["uploaded_document_types"].append(doc.document_type)

        if doc.review_notes and doc.review_notes not in summary["warnings"]:
            summary["warnings"].append(doc.review_notes)

    initiating_doc = None
    if intake_case:
        initiating_doc = get_existing_initiating_document(db, intake_case.id, intake_case.case_type)

    if initiating_doc:
        base_data = get_doc_data(initiating_doc)
        base_source = get_source_info(initiating_doc)

        merge_scalar("document_type", base_data.get("document_type"), base_source)
        merge_scalar("date_filed", base_data.get("date_filed"), base_source)
        merge_scalar("docket_number", base_data.get("docket_number"), base_source)
        merge_scalar("case_number", base_data.get("case_number"), base_source)
        merge_list("complainants", base_data.get("complainants"), base_source)
        merge_list("respondents", base_data.get("respondents"), base_source)
        merge_scalar("offense_or_violation", base_data.get("offense_or_violation"), base_source)
        merge_scalar("case_title", base_data.get("case_title"), base_source)

        for flag in normalize_list_value(base_data.get("review_flags")):
            if flag not in summary["review_flags"]:
                summary["review_flags"].append(flag)

    for doc in documents:
        data = get_doc_data(doc)
        if not data:
            continue

        source_info = get_source_info(doc)

        merge_scalar("document_type", data.get("document_type"), source_info)
        merge_scalar("date_filed", data.get("date_filed"), source_info)
        merge_scalar("docket_number", data.get("docket_number"), source_info)
        merge_scalar("case_number", data.get("case_number"), source_info)
        merge_list("complainants", data.get("complainants"), source_info)
        merge_list("respondents", data.get("respondents"), source_info)
        merge_scalar("offense_or_violation", data.get("offense_or_violation"), source_info)
        merge_scalar("case_title", data.get("case_title"), source_info)
        merge_scalar("assigned_prosecutor", data.get("assigned_prosecutor"), source_info)
        merge_scalar("assigned_prosecutor_id", data.get("assigned_prosecutor_id"), source_info)
        merge_scalar("resolution_date", data.get("resolution_date"), source_info)
        merge_scalar("filed_in_court_date", data.get("filed_in_court_date"), source_info)
        merge_scalar("court_branch", data.get("court_branch"), source_info)
        merge_scalar("case_status", data.get("case_status"), source_info)
        merge_scalar("prosecution_result", data.get("prosecution_result"), source_info)
        merge_scalar("court_result", data.get("court_result"), source_info)

        for flag in normalize_list_value(data.get("review_flags")):
            if flag not in summary["review_flags"]:
                summary["review_flags"].append(flag)

    if latest_resolution_doc:
        resolution_data = get_doc_data(latest_resolution_doc)
        resolution_source = get_source_info(latest_resolution_doc)

        merge_scalar("resolution_date", resolution_data.get("resolution_date"), resolution_source)
        merge_scalar("prosecution_result", resolution_data.get("prosecution_result"), resolution_source)
        merge_scalar("case_status", resolution_data.get("case_status"), resolution_source)
        merge_scalar("case_title", resolution_data.get("case_title"), resolution_source)

    if latest_information_doc:
        info_data = get_doc_data(latest_information_doc)
        info_source = get_source_info(latest_information_doc)

        merge_scalar("case_number", info_data.get("case_number"), info_source)
        merge_scalar("filed_in_court_date", info_data.get("filed_in_court_date"), info_source)
        merge_scalar("court_branch", info_data.get("court_branch"), info_source)
        merge_scalar("case_status", info_data.get("case_status"), info_source)
        merge_scalar("case_title", info_data.get("case_title"), info_source)

    if latest_subpoena_doc:
        subpoena_data = get_doc_data(latest_subpoena_doc)
        subpoena_source = get_source_info(latest_subpoena_doc)

        merge_scalar("assigned_prosecutor", subpoena_data.get("assigned_prosecutor"), subpoena_source)
        merge_scalar("assigned_prosecutor_id", subpoena_data.get("assigned_prosecutor_id"), subpoena_source)

    if latest_counter_affidavit_doc:
        counter_data = get_doc_data(latest_counter_affidavit_doc)
        counter_source = get_source_info(latest_counter_affidavit_doc)

        merge_scalar("case_status", counter_data.get("case_status"), counter_source)

    if is_blank(summary["case_title"]):
        if summary["complainants"] and summary["respondents"]:
            summary["case_title"] = f"{', '.join(summary['complainants'])} VS. {', '.join(summary['respondents'])}"
        elif summary["complainants"]:
            summary["case_title"] = summary["complainants"][0]
        elif summary["respondents"]:
            summary["case_title"] = summary["respondents"][0]

    return summary
        

def get_latest_intake_document_type(db, intake_case_id):
    latest_doc = (
        db.query(IntakeCaseDocument)
        .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
        .order_by(IntakeCaseDocument.created_at.desc())
        .first()
    )
    return latest_doc.document_type if latest_doc else None


def derive_intake_status_from_summary(current_status, summary, case_type=None):
    from app.services.staff.intake_document_service import (
        has_any_uploaded,
        get_case_type_resolution_types,
    )

    uploaded_document_types = set(summary.get("uploaded_document_types", []))

    prosecution_result = summary.get("prosecution_result")
    case_status = summary.get("case_status")
    case_number = summary.get("case_number")
    filed_in_court_date = summary.get("filed_in_court_date")
    document_type = summary.get("document_type")

    resolved_case_type = case_type
    if not resolved_case_type:
        if (
            document_type in INQ_INITIATING_DOCUMENT_TYPES
            or has_any_uploaded(uploaded_document_types, set(INQ_INITIATING_DOCUMENT_TYPES))
            or "inquest_resolution" in uploaded_document_types
            or "resolution" in uploaded_document_types
        ):
            resolved_case_type = "INQ"
        else:
            resolved_case_type = "INV"

    if case_number:
        return "ready_for_conversion"

    if "information" in uploaded_document_types or filed_in_court_date or case_status == "filed_in_court":
        return "information_filed"

    if resolved_case_type == "INQ":
        if has_any_uploaded(uploaded_document_types, get_case_type_resolution_types("INQ")):
            if prosecution_result == "no_probable_cause" or case_status == "dismissed":
                return "resolved_dismissed"

            if prosecution_result == "with_probable_cause" or case_status in {"for_filing", "approved_for_filing"}:
                return "resolved_for_filing"

            return "under_prosecutor_review"

        if has_any_uploaded(uploaded_document_types, set(INQ_INITIATING_DOCUMENT_TYPES)):
            if current_status == "for_confirmation":
                return "for_confirmation"
            if current_status == "needs_review":
                return "needs_review"
            if current_status == "draft":
                return "draft"
            return "active"

        return current_status or "draft"

    if "resolution" in uploaded_document_types:
        if prosecution_result == "no_probable_cause" or case_status == "dismissed":
            return "resolved_dismissed"

        if prosecution_result == "with_probable_cause" or case_status in {"for_filing", "approved_for_filing"}:
            return "resolved_for_filing"

        return "under_prosecutor_review"

    if "counter_affidavit" in uploaded_document_types:
        return "under_prosecutor_review"

    if "subpoena" in uploaded_document_types:
        return "awaiting_compliance"

    if uploaded_document_types:
        if current_status == "for_confirmation":
            return "for_confirmation"
        if current_status == "needs_review":
            return "needs_review"
        if current_status == "draft":
            return "draft"
        return "active"

    return current_status or "draft"

def compute_intake_document_status(db, intake_case):
    from app.services.staff.intake_document_service import (
        get_existing_initiating_document,
        has_any_uploaded,
        get_case_type_resolution_types,
    )

    docs = (
        db.query(IntakeCaseDocument)
        .filter(IntakeCaseDocument.intake_case_id == intake_case.id)
        .order_by(IntakeCaseDocument.created_at.asc())
        .all()
    )

    if not docs:
        return "missing_initiating_document"

    initiating_doc = get_existing_initiating_document(db, intake_case.id, intake_case.case_type)
    if not initiating_doc:
        return "missing_initiating_document"

    unresolved_docs = [
        d for d in docs
        if d.document_status in {"processing", "needs_review"}
    ]
    if unresolved_docs:
        return "documents_need_review"

    summary = summarize_intake_case_from_documents(db, intake_case.id)
    uploaded_document_types = set(summary.get("uploaded_document_types", []))
    prosecution_result = summary.get("prosecution_result")
    case_number = summary.get("case_number")
    filed_in_court_date = summary.get("filed_in_court_date")

    if case_number:
        return "ready_for_conversion"

    if prosecution_result == "no_probable_cause":
        return "dismissed"

    if intake_case.case_type == "INQ":
        has_inq_initiating = has_any_uploaded(uploaded_document_types, INQ_INITIATING_DOCUMENT_TYPES)

        if not has_inq_initiating:
            return "missing_initiating_document"

        if "information" in uploaded_document_types or filed_in_court_date:
            return "completed"

        if has_any_uploaded(uploaded_document_types, get_case_type_resolution_types("INQ")):
            if prosecution_result == "with_probable_cause":
                return "pending_subsequent_documents"
            return "initiating_document_complete"

        later_docs = [d for d in docs if d.id != initiating_doc.id]
        if not later_docs:
            return "initiating_document_complete"

        return "pending_subsequent_documents"

    if "subpoena" in uploaded_document_types and "counter_affidavit" not in uploaded_document_types:
        return "awaiting_compliance"

    required_following = {"subpoena", "counter_affidavit", "resolution"}

    if prosecution_result == "with_probable_cause":
        required_following = {"subpoena", "counter_affidavit", "resolution", "information"}

    missing_following = [doc_type for doc_type in required_following if doc_type not in uploaded_document_types]

    if not missing_following:
        return "completed"

    later_docs = [d for d in docs if d.id != initiating_doc.id]
    if not later_docs:
        return "initiating_document_complete"

    return "pending_subsequent_documents"

def build_missing_documents_summary(intake_case, summary):
    uploaded_document_types = set(summary.get("uploaded_document_types", []))
    prosecution_result = summary.get("prosecution_result")
    case_status = summary.get("case_status")
    missing = []

    if intake_case.case_type == "INV":
        if "complaint_affidavit" not in uploaded_document_types:
            missing.append("complaint_affidavit")

        if "subpoena" not in uploaded_document_types:
            missing.append("subpoena")

        if "counter_affidavit" not in uploaded_document_types:
            missing.append("counter_affidavit")

        if "resolution" not in uploaded_document_types:
            missing.append("resolution")

        if "resolution" in uploaded_document_types and (
            prosecution_result == "with_probable_cause"
            or case_status in {"for_filing", "approved_for_filing"}
        ):
            if "information" not in uploaded_document_types:
                missing.append("information")

    elif intake_case.case_type == "INQ":
        has_inq_initiating = has_any_uploaded(uploaded_document_types, INQ_INITIATING_DOCUMENT_TYPES)

        if not has_inq_initiating:
            missing.append("police_report_or_arrest_report")

        has_inq_resolution = has_any_uploaded(uploaded_document_types, get_case_type_resolution_types("INQ"))
        if not has_inq_resolution:
            missing.append("inquest_resolution")

        if has_inq_resolution and (
            prosecution_result == "with_probable_cause"
            or case_status in {"for_filing", "approved_for_filing"}
        ):
            if "information" not in uploaded_document_types:
                missing.append("information")

    return missing

def get_latest_preferred_document(documents, candidate_types):
    candidates = [
        doc for doc in documents
        if doc.document_type in candidate_types
    ]

    if not candidates:
        return None

    reviewed_latest = [
        doc for doc in candidates
        if getattr(doc, "is_latest", False) and getattr(doc, "is_reviewed", False)
    ]
    if reviewed_latest:
        return sorted(
            reviewed_latest,
            key=lambda d: (d.created_at or datetime.min),
            reverse=True,
        )[0]

    latest_docs = [
        doc for doc in candidates
        if getattr(doc, "is_latest", False)
    ]
    if latest_docs:
        return sorted(
            latest_docs,
            key=lambda d: (d.created_at or datetime.min),
            reverse=True,
        )[0]

    reviewed_docs = [
        doc for doc in candidates
        if getattr(doc, "is_reviewed", False)
    ]
    if reviewed_docs:
        return sorted(
            reviewed_docs,
            key=lambda d: (d.created_at or datetime.min),
            reverse=True,
        )[0]

    return sorted(
        candidates,
        key=lambda d: (d.created_at or datetime.min),
        reverse=True,
    )[0]
