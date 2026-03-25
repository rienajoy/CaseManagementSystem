#backend/app/services/staff/intake_document_service.py

from datetime import datetime
from model import IntakeCase, IntakeCaseDocument, CaseDocument
from app.utils.normalization import normalize_to_list, first_non_empty
from app.constants.staff_case_constants import (
    INITIAL_DOCUMENT_TYPES_BY_CASE_TYPE,
    FOLLOWUP_DOCUMENT_TYPES_BY_CASE_TYPE,
    INQ_INITIATING_DOCUMENT_TYPES,
)

VERSIONED_DOCUMENT_TYPES = {
    "resolution",
    "inquest_resolution",
    "information",
    "court_decision",
    "judgment",
    "arraignment_order",
    "pre_trial_order",
    "trial_order",
    "other_court_document",
}
# -----------------------------
# Intake document classification helpers
# -----------------------------
def is_initiating_document(document_type: str, case_type: str) -> bool:
    allowed = INITIAL_DOCUMENT_TYPES_BY_CASE_TYPE.get(case_type, set())
    return document_type in allowed


def get_existing_initiating_document(db, intake_case_id, case_type):
    docs = (
        db.query(IntakeCaseDocument)
        .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
        .order_by(IntakeCaseDocument.created_at.asc())
        .all()
    )

    initiating_docs = [
        doc for doc in docs
        if is_initiating_document(doc.document_type, case_type)
    ]

    if not initiating_docs:
        return None

    def doc_score(doc):
        if doc.is_reviewed and doc.reviewed_data:
            data = doc.reviewed_data or {}
        else:
            data = ((doc.extracted_data or {}).get("metadata", {}) or {})

        score = 0

        if doc.is_reviewed:
            score += 100
        if data.get("case_title"):
            score += 20
        if data.get("complainants"):
            score += 20
        if data.get("respondents"):
            score += 20
        if data.get("date_filed"):
            score += 10
        if data.get("docket_number"):
            score += 10
        if data.get("offense_or_violation"):
            score += 10

        return score

    return max(initiating_docs, key=doc_score)


def get_allowed_initial_document_types(case_type: str) -> set[str]:
    return INITIAL_DOCUMENT_TYPES_BY_CASE_TYPE.get(case_type, set())


def get_allowed_followup_document_types(case_type: str) -> set[str]:
    return FOLLOWUP_DOCUMENT_TYPES_BY_CASE_TYPE.get(case_type, set())


def get_case_type_resolution_types(case_type: str) -> set[str]:
    if case_type == "INQ":
        return {"inquest_resolution", "resolution"}
    return {"resolution"}


def is_resolution_document(document_type: str, case_type: str) -> bool:
    return document_type in get_case_type_resolution_types(case_type)


def is_information_document(document_type: str) -> bool:
    return document_type == "information"


def has_any_uploaded(uploaded_document_types: set[str], candidates: set[str]) -> bool:
    return bool(uploaded_document_types.intersection(candidates))


def get_case_type_initial_label(case_type: str) -> str:
    if case_type == "INV":
        return "complaint_affidavit"
    return "police_report_or_arrest_report"


def validate_intake_document_type(db, intake_case, document_type):
    initiating_doc = get_existing_initiating_document(db, intake_case.id, intake_case.case_type)

    allowed_initial = get_allowed_initial_document_types(intake_case.case_type)
    allowed_following = get_allowed_followup_document_types(intake_case.case_type)

    if not initiating_doc:
        if document_type not in allowed_initial:
            if intake_case.case_type == "INV":
                return False, "Complaint affidavit is required as the initiating document for INV."
            if intake_case.case_type == "INQ":
                return False, "Police report, arrest report, affidavit of arrest, or affidavit of apprehension is required as the initiating document for INQ."
            return False, "Initiating document is required first."
        return True, None

    allowed_all = allowed_initial.union(allowed_following)

    if document_type not in allowed_all:
        return False, f"Unsupported document type for {intake_case.case_type} intake case."

    return True, None

def build_document_status_from_extraction(confidence, warnings, metadata):
    confidence = confidence or {}
    warnings = warnings or []
    metadata = metadata or {}

    has_extraction_issues = len(warnings) > 0 or len(metadata.get("review_flags", [])) > 0

    low_confidence_fields = []
    for key, value in confidence.items():
        try:
            if float(value) < 0.80:
                low_confidence_fields.append(key)
        except Exception:
            continue

    if has_extraction_issues or low_confidence_fields:
        return {
            "has_extraction_issues": True,
            "review_priority": "high" if len(low_confidence_fields) >= 2 or len(warnings) >= 2 else "normal",
            "document_status": "needs_review",
        }

    return {
        "has_extraction_issues": False,
        "review_priority": "normal",
        "document_status": "processed",
    }


def get_unreviewed_intake_documents(db, intake_case_id):
    docs = (
        db.query(IntakeCaseDocument)
        .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
        .order_by(IntakeCaseDocument.created_at.asc())
        .all()
    )

    pending = []
    for doc in docs:
        if doc.document_status in {"processing", "needs_review"}:
            pending.append(doc)
            continue

        if doc.ocr_status == "completed" and doc.nlp_status == "completed" and not doc.is_reviewed:
            pending.append(doc)

    return pending


def get_post_review_intake_status(db, intake_case, reviewed_document, summary):
    from app.services.staff.summary_service import derive_intake_status_from_summary

    document_type = reviewed_document.document_type
    uploaded_document_types = set(summary.get("uploaded_document_types", []))
    prosecution_result = summary.get("prosecution_result")
    case_status = summary.get("case_status")
    case_number = summary.get("case_number")
    filed_in_court_date = summary.get("filed_in_court_date")

    if case_number:
        return "ready_for_conversion"

    if document_type in INITIAL_DOCUMENT_TYPES_BY_CASE_TYPE.get(intake_case.case_type, set()):
        return "for_confirmation"

    if intake_case.case_type == "INV":
        if document_type == "subpoena":
            return "awaiting_compliance"
        if document_type == "counter_affidavit":
            return "under_prosecutor_review"

    if is_resolution_document(document_type, intake_case.case_type):
        if prosecution_result == "no_probable_cause" or case_status == "dismissed":
            return "resolved_dismissed"
        if prosecution_result == "with_probable_cause" or case_status in {"for_filing", "approved_for_filing"}:
            return "resolved_for_filing"
        return "under_prosecutor_review"

    if is_information_document(document_type):
        if case_number:
            return "ready_for_conversion"
        if "information" in uploaded_document_types or filed_in_court_date or case_status == "filed_in_court":
            return "information_filed"
        return "resolved_for_filing"

    return derive_intake_status_from_summary(
        intake_case.intake_status,
        summary,
        case_type=intake_case.case_type,
    )

def apply_pipeline_result_to_intake_document(db, intake_case, document, pipeline_result, current_user_id=None):
    from app.services.staff.summary_service import summarize_intake_case_from_documents
    from app.services.staff.tracker_service import sync_missing_document_trackers

    raw_text = pipeline_result["raw_text"]
    clean_text = pipeline_result["clean_text"]
    pages = pipeline_result["pages"]
    extracted_documents = pipeline_result["documents"]
    primary_document = pipeline_result["primary_document"]

    document.start_page = primary_document.get("start_page") if primary_document else None
    document.end_page = primary_document.get("end_page") if primary_document else None

    if not primary_document:
        document.ocr_text = raw_text
        document.extracted_data = None
        document.ocr_status = "completed"
        document.nlp_status = "failed"
        document.document_status = "needs_review"
        document.has_extraction_issues = True
        document.review_priority = "high"
        document.review_notes = "No extractable document metadata found."
        intake_case.intake_status = "needs_review"
        return

    metadata = primary_document.get("extracted_metadata", {}) or {}
    confidence = primary_document.get("confidence", {}) or {}
    warnings = primary_document.get("warnings", []) or []

    metadata["complainants"] = normalize_to_list(metadata.get("complainants"))
    metadata["respondents"] = normalize_to_list(metadata.get("respondents"))
    metadata["review_flags"] = normalize_to_list(metadata.get("review_flags"))

    review_state = build_document_status_from_extraction(confidence, warnings, metadata)

    document.ocr_text = raw_text
    document.extracted_data = {
        "raw_text": raw_text,
        "clean_text": clean_text,
        "pages": pages,
        "documents": extracted_documents,
        "primary_document": primary_document,
        "metadata": metadata,
        "confidence": confidence,
        "warnings": warnings,
    }
    document.ocr_status = "completed"
    document.nlp_status = "completed"
    document.has_extraction_issues = review_state["has_extraction_issues"]
    document.review_priority = review_state["review_priority"]
    document.document_status = review_state["document_status"]
    document.review_notes = " | ".join(warnings) if warnings else None

    document.reviewed_data = None
    document.is_reviewed = False
    document.reviewed_by = None
    document.reviewed_at = None

    summary = summarize_intake_case_from_documents(db, intake_case.id)
    intake_case.extracted_data = summary
    intake_case.intake_status = "needs_review"

    sync_missing_document_trackers(db, intake_case, current_user_id)

def is_versioned_document_type(document_type: str) -> bool:
    return document_type in VERSIONED_DOCUMENT_TYPES


def get_document_group_key(document_type: str) -> str:
    return document_type

def assign_intake_document_versioning(db, document):
    if not is_versioned_document_type(document.document_type):
        document.document_group_key = document.document_type
        document.version_no = 1
        document.is_latest = True
        document.version_status = "active"
        document.supersedes_document_id = None
        return

    group_key = get_document_group_key(document.document_type)

    previous_latest = (
        db.query(IntakeCaseDocument)
        .filter(
            IntakeCaseDocument.intake_case_id == document.intake_case_id,
            IntakeCaseDocument.document_group_key == group_key,
            IntakeCaseDocument.is_latest == True,
        )
        .order_by(IntakeCaseDocument.created_at.desc())
        .first()
    )

    document.document_group_key = group_key

    if previous_latest:
        previous_latest.is_latest = False
        previous_latest.version_status = "superseded"

        document.version_no = (previous_latest.version_no or 1) + 1
        document.is_latest = True
        document.version_status = "active"
        document.supersedes_document_id = previous_latest.id
    else:
        document.version_no = 1
        document.is_latest = True
        document.version_status = "active"
        document.supersedes_document_id = None

def assign_case_document_versioning(db, document):
    if not is_versioned_document_type(document.document_type):
        document.document_group_key = document.document_type
        document.version_no = 1
        document.is_latest = True
        document.version_status = "active"
        document.supersedes_document_id = None
        return

    group_key = get_document_group_key(document.document_type)

    previous_latest = (
        db.query(CaseDocument)
        .filter(
            CaseDocument.case_id == document.case_id,
            CaseDocument.document_group_key == group_key,
            CaseDocument.is_latest == True,
        )
        .order_by(CaseDocument.created_at.desc())
        .first()
    )

    document.document_group_key = group_key

    if previous_latest:
        previous_latest.is_latest = False
        previous_latest.version_status = "superseded"

        document.version_no = (previous_latest.version_no or 1) + 1
        document.is_latest = True
        document.version_status = "active"
        document.supersedes_document_id = previous_latest.id
    else:
        document.version_no = 1
        document.is_latest = True
        document.version_status = "active"
        document.supersedes_document_id = None

