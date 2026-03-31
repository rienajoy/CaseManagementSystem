#backend/app/serializers/staff_serializers.py

from datetime import datetime

from model import User, CaseParty, CaseDocument
# -----------------------------
# Serialization helpers
# -----------------------------
def serialize_user_name(db, user_id):
    if not user_id:
        return None
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        return None
    return f"{user.first_name} {user.last_name}".strip()


def serialize_prosecutor(user):
    return {
        "user_id": user.user_id,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": f"{user.first_name} {user.last_name}".strip(),
        "email": user.email,
        "role": user.role,
    }

def map_intake_status_label(status):
    mapping = {
        "pre_intake": "Initializing Intake",
        "draft": "Draft",
        "needs_review": "Needs Review",
        "for_confirmation": "For Confirmation",
        "active": "Active",
        "awaiting_compliance": "Awaiting Respondent Compliance",
        "under_prosecutor_review": "Under Prosecutor Review",
        "resolved_dismissed": "Resolved - Dismissed",
        "resolved_for_filing": "Resolved - For Filing",
        "information_filed": "Information Filed",
        "ready_for_conversion": "Ready for Conversion",
        "converted": "Converted to Official Case",
    }
    return mapping.get(status, status or "Unknown")


def map_intake_document_status_label(status):
    mapping = {
        "missing_initiating_document": "Missing Initiating Document",
        "documents_need_review": "Under Document Review",
        "initiating_document_complete": "Initiating Document Complete",
        "pending_subsequent_documents": "Missing Required Documents",
        "awaiting_compliance": "With Pending Compliance Documents",
        "completed": "Complete for Intake Stage",
        "dismissed": "Dismissed",
        "ready_for_conversion": "Ready for Conversion",
    }
    return mapping.get(status, status or "Unknown")

def map_official_case_status_label(status):
    mapping = {
        "filed_in_court": "Filed in Court",
        "for_arraignment": "For Arraignment",
        "for_pre_trial": "For Pre-Trial",
        "for_trial": "For Trial",
        "for_decision": "For Decision",
        "decided": "Decided",
        "dismissed_by_court": "Dismissed by Court",
        "archived": "Archived",
        "closed": "Closed",
    }
    return mapping.get(status, status or "Unknown")

#case / intake serializers


def serialize_case_document_for_list(db, doc):
    return {
        "id": doc.id,
        "case_id": doc.case_id,
        "document_type": doc.document_type,
        "document_type_label": (doc.document_type or "").replace("_", " ").title(),
        "uploaded_file_name": doc.uploaded_file_name,
        "uploaded_file_path": doc.uploaded_file_path,
        "file_mime_type": doc.file_mime_type,
        "file_size": doc.file_size,
        "uploaded_by": doc.uploaded_by,
        "ocr_text": doc.ocr_text,
        "extracted_data": doc.extracted_data,
        "reviewed_data": doc.reviewed_data,
        "has_extraction_issues": doc.has_extraction_issues,
        "review_priority": doc.review_priority,
        "review_notes": doc.review_notes,
        "is_reviewed": doc.is_reviewed,
        "reviewed_by": doc.reviewed_by,
        "reviewed_by_name": serialize_user_name(db, doc.reviewed_by),
        "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
        "is_initiating_document": doc.is_initiating_document,
        "is_initiating_document_label": "Yes" if doc.is_initiating_document else "No",
        "document_status": doc.document_status,
        "document_status_label": {
            "uploaded": "Uploaded",
            "processing": "Processing",
            "processed": "Processed",
            "needs_review": "Needs Review",
            "reviewed": "Reviewed",
            "failed": "Failed",
        }.get(doc.document_status, doc.document_status),
        "document_extraction_id": doc.document_extraction_id,
        "document_date": doc.document_date.isoformat() if doc.document_date else None,
        "document_group_key": doc.document_group_key,
        "version_no": doc.version_no,
        "is_latest": doc.is_latest,
        "version_status": doc.version_status,
        "supersedes_document_id": doc.supersedes_document_id,
        "start_page": doc.start_page,
        "end_page": doc.end_page,
        "source_intake_case_document_id": doc.source_intake_case_document_id,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }
    

def serialize_case_document(db, doc):
    return {
        "id": doc.id,
        "case_id": doc.case_id,
        "document_type": doc.document_type,
        "uploaded_file_name": doc.uploaded_file_name,
        "uploaded_file_path": doc.uploaded_file_path,
        "file_mime_type": doc.file_mime_type,
        "file_size": doc.file_size,
        "uploaded_by": doc.uploaded_by,
        "is_initiating_document": doc.is_initiating_document,
        "ocr_text": doc.ocr_text,
        "extracted_data": doc.extracted_data,
        "reviewed_data": doc.reviewed_data,
        "has_extraction_issues": doc.has_extraction_issues,
        "review_priority": doc.review_priority,
        "review_notes": doc.review_notes,
        "is_reviewed": doc.is_reviewed,
        "reviewed_by": doc.reviewed_by,
        "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
        "is_case_applied": doc.is_case_applied,
        "case_applied_at": doc.case_applied_at.isoformat() if doc.case_applied_at else None,
        "document_status": doc.document_status,
        "document_extraction_id": doc.document_extraction_id,
        "source_intake_case_document_id": doc.source_intake_case_document_id,
        "start_page": doc.start_page,
        "end_page": doc.end_page,
        "source_confidence": doc.source_confidence,
        "source_warnings": doc.source_warnings,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
    }


def serialize_intake_case(db, intake_case, include_summary=False):
    payload = {
        "id": intake_case.id,
        "case_type": intake_case.case_type,
        "intake_status": intake_case.intake_status,
        "review_notes": intake_case.review_notes,
        "extracted_data": intake_case.extracted_data,
        "created_by": intake_case.created_by,
        "received_by": intake_case.received_by,
        "received_at": intake_case.received_at.isoformat() if intake_case.received_at else None,
        "created_at": intake_case.created_at.isoformat() if intake_case.created_at else None,
        "updated_at": intake_case.updated_at.isoformat() if intake_case.updated_at else None,
        "converted_case_id": intake_case.converted_case_id,
        "converted_at": intake_case.converted_at.isoformat() if intake_case.converted_at else None,
    }

    if include_summary:
        payload["summary"] = summarize_intake_case_from_documents(db, intake_case.id)

    return payload


def serialize_case(case_obj, parties=None, documents=None):
    payload = {
        "id": case_obj.id,
        "case_number": case_obj.case_number,
        "docket_number": case_obj.docket_number,
        "case_title": case_obj.case_title,
        "offense_or_violation": case_obj.offense_or_violation,
        "case_type": case_obj.case_type,
        "filing_date": case_obj.filing_date.isoformat() if case_obj.filing_date else None,
        "receiving_office_id": case_obj.receiving_office_id,
        "assigned_prosecutor_id": case_obj.assigned_prosecutor_id,
        "created_by": case_obj.created_by,
        "case_origin": case_obj.case_origin,
        "intake_status": case_obj.intake_status,
        "case_status": case_obj.case_status,
        "prosecution_result": case_obj.prosecution_result,
        "court_result": case_obj.court_result,
        "custody_result": case_obj.custody_result,
        "summary": case_obj.summary,
        "resolution_date": case_obj.resolution_date.isoformat() if case_obj.resolution_date else None,
        "filed_in_court_date": case_obj.filed_in_court_date.isoformat() if case_obj.filed_in_court_date else None,
        "court_branch": case_obj.court_branch,
        "source_intake_case_id": case_obj.source_intake_case_id,
        "latest_document_type": case_obj.latest_document_type,
        "created_at": case_obj.created_at.isoformat() if case_obj.created_at else None,
        "updated_at": case_obj.updated_at.isoformat() if case_obj.updated_at else None,
    }

    if parties is not None:
        payload["complainants"] = [
            {"id": p.id, "full_name": p.full_name}
            for p in parties if p.party_type == "complainant"
        ]
        payload["respondents"] = [
            {"id": p.id, "full_name": p.full_name}
            for p in parties if p.party_type == "respondent"
        ]

    if documents is not None:
        payload["documents"] = [
            {
                "id": doc.id,
                "case_id": doc.case_id,
                "document_type": doc.document_type,
                "uploaded_file_name": doc.uploaded_file_name,
                "uploaded_file_path": doc.uploaded_file_path,
                "file_mime_type": doc.file_mime_type,
                "file_size": doc.file_size,
                "uploaded_by": doc.uploaded_by,
                "is_initiating_document": doc.is_initiating_document,
                "ocr_text": doc.ocr_text,
                "extracted_data": doc.extracted_data,
                "reviewed_data": doc.reviewed_data,
                "has_extraction_issues": doc.has_extraction_issues,
                "review_priority": doc.review_priority,
                "review_notes": doc.review_notes,
                "is_reviewed": doc.is_reviewed,
                "reviewed_by": doc.reviewed_by,
                "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
                "is_case_applied": doc.is_case_applied,
                "case_applied_at": doc.case_applied_at.isoformat() if doc.case_applied_at else None,
                "document_status": doc.document_status,
                "document_extraction_id": doc.document_extraction_id,
                "source_intake_case_document_id": doc.source_intake_case_document_id,
                "start_page": doc.start_page,
                "end_page": doc.end_page,
                "source_confidence": doc.source_confidence,
                "source_warnings": doc.source_warnings,
                "created_at": doc.created_at.isoformat() if doc.created_at else None,
                "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
            }
            for doc in documents
        ]

    return payload


def serialize_document_tracker(item):
    now = datetime.utcnow()

    due_date = item.due_date.isoformat() if item.due_date else None
    requested_date = item.requested_date.isoformat() if item.requested_date else None
    expected_date = item.expected_date.isoformat() if item.expected_date else None
    received_date = item.received_date.isoformat() if item.received_date else None
    created_at = item.created_at.isoformat() if item.created_at else None
    updated_at = item.updated_at.isoformat() if item.updated_at else None

    is_completed = bool(item.received_date) or str(item.status or "").lower() in {
        "received",
        "completed",
        "done",
    }

    is_overdue = False
    days_remaining = None
    days_delayed = None

    if item.due_date:
        delta_days = (item.due_date.date() - now.date()).days
        if is_completed:
            days_remaining = None
            days_delayed = None
        else:
            days_remaining = delta_days if delta_days >= 0 else 0
            if delta_days < 0:
                is_overdue = True
                days_delayed = abs(delta_days)

    return {
        "id": item.id,
        "intake_case_id": item.intake_case_id,
        "case_id": item.case_id,

        "document_type": item.document_type,
        "document_type_label": (item.document_type or "").replace("_", " ").title(),

        "track_type": getattr(item, "tracking_type", None),
        "track_type_label": (getattr(item, "tracking_type", "") or "").replace("_", " ").title(),

        "status": getattr(item, "status", None),
        "status_label": (getattr(item, "status", "") or "").replace("_", " ").title(),

        "source_location": getattr(item, "source_location", None),
        "office_department": getattr(item, "office_department", None),
        "office": getattr(item, "office_department", None),

        "responsible_party": getattr(item, "responsible_party", None),

        "requested_date": requested_date,
        "expected_date": expected_date,
        "due_date": due_date,
        "received_date": received_date,

        "remarks": getattr(item, "remarks", None),

        "related_document_id": getattr(item, "related_document_id", None),

        "is_completed": is_completed,
        "is_overdue": is_overdue,
        "days_remaining": days_remaining,
        "days_delayed": days_delayed,

        "created_at": created_at,
        "updated_at": updated_at,
    }



def serialize_dashboard_case_row(case_obj):
    return {
        "id": case_obj.id,
        "case_number": case_obj.case_number,
        "docket_number": case_obj.docket_number,
        "case_title": case_obj.case_title,
        "case_type": case_obj.case_type,
        "case_origin": case_obj.case_origin,
        "case_status": case_obj.case_status,
        "case_status_label": map_official_case_status_label(case_obj.case_status),
        "prosecution_result": case_obj.prosecution_result,
        "court_result": case_obj.court_result,
        "court_branch": case_obj.court_branch,
        "created_at": case_obj.created_at.isoformat() if case_obj.created_at else None,
        "updated_at": case_obj.updated_at.isoformat() if case_obj.updated_at else None,
    }


def serialize_dashboard_tracker_row(item):
    return {
        "id": item.id,
        "intake_case_id": item.intake_case_id,
        "case_id": item.case_id,
        "document_type": item.document_type,
        "tracking_type": item.tracking_type,
        "status": item.status,
        "status_label": {
            "missing": "Missing",
            "awaiting": "Awaiting Submission",
            "requested": "Requested",
            "in_process": "In Process",
            "received": "Received",
            "overdue": "Overdue",
            "not_applicable": "Not Applicable",
        }.get(item.status, item.status),
        "source_location": item.source_location,
        "office_department": item.office_department,
        "responsible_party": item.responsible_party,
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "received_date": item.received_date.isoformat() if item.received_date else None,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }


def serialize_dashboard_compliance_row(item):
    timeline_status = None
    days_remaining = None

    if item.due_date and item.compliance_status == "pending":
        delta = item.due_date.date() - datetime.utcnow().date()
        days_remaining = delta.days

        if delta.days < 0:
            timeline_status = "overdue"
        elif delta.days == 0:
            timeline_status = "due_today"
        else:
            timeline_status = "pending"

    return {
        "id": item.id,
        "intake_case_id": item.intake_case_id,
        "case_id": item.case_id,
        "related_document_id": item.related_document_id,
        "compliance_type": item.compliance_type,
        "title": item.title,
        "compliance_status": item.compliance_status,
        "responsible_party": item.responsible_party,
        "due_date": item.due_date.isoformat() if item.due_date else None,
        "issued_date": item.issued_date.isoformat() if item.issued_date else None,
        "complied_date": item.complied_date.isoformat() if item.complied_date else None,
        "days_remaining": days_remaining,
        "timeline_status": timeline_status,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }

def serialize_compliance_item(item):
    now = datetime.utcnow()

    issued_date = item.issued_date.isoformat() if item.issued_date else None
    due_date = item.due_date.isoformat() if item.due_date else None
    complied_date = item.complied_date.isoformat() if item.complied_date else None
    created_at = item.created_at.isoformat() if item.created_at else None
    updated_at = item.updated_at.isoformat() if item.updated_at else None

    status = getattr(item, "compliance_status", None) or getattr(item, "status", None)
    normalized_status = str(status or "").strip().lower()

    is_complied = bool(item.complied_date) or normalized_status in {
        "complied",
        "completed",
        "done",
    }

    is_overdue = False
    days_remaining = None
    days_overdue = None

    if item.due_date and not is_complied:
        delta_days = (item.due_date.date() - now.date()).days
        days_remaining = delta_days if delta_days >= 0 else 0
        if delta_days < 0:
            is_overdue = True
            days_overdue = abs(delta_days)

    return {
        "id": item.id,
        "intake_case_id": item.intake_case_id,
        "case_id": item.case_id,

        "title": getattr(item, "title", None),
        "description": getattr(item, "description", None),

        "type": getattr(item, "compliance_type", None) or getattr(item, "type", None),
        "type_label": (
            (getattr(item, "compliance_type", None) or getattr(item, "type", "") or "")
            .replace("_", " ")
            .title()
        ),

        "compliance_status": status,
        "compliance_status_label": (status or "").replace("_", " ").title() if status else None,
        "status": status,
        "status_label": (status or "").replace("_", " ").title() if status else None,

        "issued_date": issued_date,
        "due_date": due_date,
        "days_to_comply": getattr(item, "days_to_comply", None),
        "complied_date": complied_date,

        "responsible_party": getattr(item, "responsible_party", None),
        "remarks": getattr(item, "remarks", None),

        "related_document_id": getattr(item, "related_document_id", None),
        "trigger_document_id": getattr(item, "trigger_document_id", None),
        "evidence_document_id": getattr(item, "evidence_document_id", None),

        "is_complied": is_complied,
        "is_overdue": is_overdue,
        "days_remaining": days_remaining,
        "days_overdue": days_overdue,

        "created_at": created_at,
        "updated_at": updated_at,
    }

    
def serialize_intake_case_document(db, doc):
    ocr_status_label_map = {
        "not_started": "Not Started",
        "processing": "Processing",
        "completed": "Completed",
        "failed": "Failed",
    }

    nlp_status_label_map = {
        "not_started": "Not Started",
        "processing": "Processing",
        "completed": "Completed",
        "failed": "Failed",
    }

    document_status_label_map = {
        "uploaded": "Uploaded",
        "processing": "Processing",
        "processed": "Extraction Completed",
        "needs_review": "Needs Review",
        "reviewed": "Reviewed",
        "failed": "Failed",
    }

    return {
        "id": doc.id,
        "intake_case_id": doc.intake_case_id,
        "document_type": doc.document_type,
        "document_type_label": (doc.document_type or "").replace("_", " ").title(),
        "uploaded_file_name": doc.uploaded_file_name,
        "uploaded_file_path": doc.uploaded_file_path,
        "file_mime_type": doc.file_mime_type,
        "file_size": doc.file_size,
        "uploaded_by": doc.uploaded_by,
        "ocr_text": doc.ocr_text,
        "extracted_data": doc.extracted_data,
        "reviewed_data": doc.reviewed_data,
        "has_extraction_issues": doc.has_extraction_issues,
        "review_priority": doc.review_priority,
        "review_notes": doc.review_notes,
        "is_reviewed": doc.is_reviewed,
        "reviewed_by": doc.reviewed_by,
        "reviewed_by_name": serialize_user_name(db, doc.reviewed_by),
        "reviewed_at": doc.reviewed_at.isoformat() if doc.reviewed_at else None,
        "is_case_applied": doc.is_case_applied,
        "case_applied_at": doc.case_applied_at.isoformat() if doc.case_applied_at else None,
        "is_initiating_document": doc.is_initiating_document,
        "is_initiating_document_label": "Yes" if doc.is_initiating_document else "No",
        "ocr_status": doc.ocr_status,
        "ocr_status_label": ocr_status_label_map.get(doc.ocr_status, doc.ocr_status),
        "nlp_status": doc.nlp_status,
        "nlp_status_label": nlp_status_label_map.get(doc.nlp_status, doc.nlp_status),
        "document_status": doc.document_status,
        "document_status_label": document_status_label_map.get(doc.document_status, doc.document_status),
        "document_extraction_id": doc.document_extraction_id,

        "document_date": doc.document_date.isoformat() if doc.document_date else None,
        "document_group_key": doc.document_group_key,
        "version_no": doc.version_no,
        "is_latest": doc.is_latest,
        "version_status": doc.version_status,
        "supersedes_document_id": doc.supersedes_document_id,
        
        "start_page": doc.start_page,
        "end_page": doc.end_page,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None,
        "date_received": doc.date_received.isoformat() if doc.date_received else None,
    }

def build_intake_case_view(db, intake_case):
    from app.services.staff.summary_service import (
        summarize_intake_case_from_documents,
        compute_intake_document_status,
        build_missing_documents_summary,
    )

    summary = intake_case.extracted_data or summarize_intake_case_from_documents(db, intake_case.id)
    intake_document_status = compute_intake_document_status(db, intake_case)

    return {
        "id": intake_case.id,
        "intake_case_id": f"INT-{intake_case.id:06d}",
        "case_type": intake_case.case_type,
        "date_filed": summary.get("date_filed"),
        "docket_number": summary.get("docket_number"),
        "case_number": summary.get("case_number"),
        "complainants": summary.get("complainants", []),
        "respondents": summary.get("respondents", []),
        "offense_or_violation": summary.get("offense_or_violation"),
        "case_title": summary.get("case_title"),
        "assigned_prosecutor": summary.get("assigned_prosecutor"),
        "assigned_prosecutor_id": summary.get("assigned_prosecutor_id"),
        "resolution_date": summary.get("resolution_date"),
        "filed_in_court_date": summary.get("filed_in_court_date"),
        "court_branch": summary.get("court_branch"),
        "case_status": summary.get("case_status"),
        "prosecution_result": summary.get("prosecution_result"),
        "court_result": summary.get("court_result"),
        "review_flags": summary.get("review_flags", []),
        "warnings": summary.get("warnings", []),
        "intake_status": intake_case.intake_status,
        "intake_document_status": intake_document_status,
        "intake_status_label": map_intake_status_label(intake_case.intake_status),
        "intake_document_status_label": map_intake_document_status_label(intake_document_status),
        "missing_documents": build_missing_documents_summary(intake_case, summary),
        "review_notes": intake_case.review_notes,
        "created_by": intake_case.created_by,
        "received_by": intake_case.received_by,
        "received_at": intake_case.received_at.isoformat() if intake_case.received_at else None,
        "created_at": intake_case.created_at.isoformat() if intake_case.created_at else None,
        "updated_at": intake_case.updated_at.isoformat() if intake_case.updated_at else None,
        "converted_case_id": intake_case.converted_case_id,
        "converted_at": intake_case.converted_at.isoformat() if intake_case.converted_at else None,
    }

def build_case_view(db, case_obj, include_parties=False, include_documents=False):
    parties = None
    documents = None

    if include_parties:
        parties = (
            db.query(CaseParty)
            .filter(CaseParty.case_id == case_obj.id)
            .order_by(CaseParty.id.asc())
            .all()
        )

    if include_documents:
        documents = (
            db.query(CaseDocument)
            .filter(CaseDocument.case_id == case_obj.id)
            .order_by(CaseDocument.created_at.asc())
            .all()
        )

    payload = serialize_case(case_obj, parties=parties, documents=documents)
    payload["case_status_label"] = map_official_case_status_label(case_obj.case_status)
    return payload

def serialize_dashboard_intake_row(db, intake_case):
    view = build_intake_case_view(db, intake_case)
    return {
        "id": view["id"],
        "intake_case_id": view["intake_case_id"],
        "case_type": view["case_type"],
        "case_title": view["case_title"],
        "docket_number": view["docket_number"],
        "case_number": view["case_number"],
        "assigned_prosecutor": view["assigned_prosecutor"],
        "intake_status": view["intake_status"],
        "intake_status_label": view["intake_status_label"],
        "intake_document_status": view["intake_document_status"],
        "intake_document_status_label": view["intake_document_status_label"],
        "prosecution_result": view["prosecution_result"],
        "created_at": view["created_at"],
        "updated_at": view["updated_at"],
    }

def serialize_staff_audit_log(item):
    return {
        "id": item.id,
        "user_id": item.user_id,
        "action": item.action,
        "entity_type": item.entity_type,
        "entity_id": item.entity_id,
        "intake_case_id": item.intake_case_id,
        "case_id": item.case_id,
        "document_id": item.document_id,
        "old_values": item.old_values,
        "new_values": item.new_values,
        "remarks": item.remarks,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }

def serialize_case_court_event(item):
    return {
        "id": item.id,
        "case_id": item.case_id,
        "event_type": item.event_type,
        "event_date": item.event_date.isoformat() if item.event_date else None,
        "result": item.result,
        "notes": item.notes,
        "related_document_id": item.related_document_id,
        "created_by": item.created_by,
        "updated_by": item.updated_by,
        "created_at": item.created_at.isoformat() if item.created_at else None,
        "updated_at": item.updated_at.isoformat() if item.updated_at else None,
    }