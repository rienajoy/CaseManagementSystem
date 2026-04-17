#backend/app/services/staff/tracker_service.py

from datetime import datetime
from model import IntakeDocumentTracker
from app.constants.staff_case_constants import INQ_INITIATING_DOCUMENT_TYPES
from app.services.staff.intake_document_service import has_any_uploaded

# -----------------------------
# Checklist / tracker / compliance helpers
# -----------------------------
def build_initial_checklist(db, intake_case, summary):
    from model import IntakeCaseDocument
    summary = summary or {} 
    uploaded_document_types = set(summary.get("uploaded_document_types", []))
    prosecution_result = summary.get("prosecution_result")
    case_number = summary.get("case_number")
    case_status = summary.get("case_status")

    trackers = (
        db.query(IntakeDocumentTracker)
        .filter(IntakeDocumentTracker.intake_case_id == intake_case.id)
        .all()
    )

    documents = (
        db.query(IntakeCaseDocument)
        .filter(IntakeCaseDocument.intake_case_id == intake_case.id)
        .order_by(IntakeCaseDocument.created_at.asc())
        .all()
    )

    tracker_map = {tracker.document_type: tracker for tracker in trackers}
    checklist = []

    def make_label(value):
        return (value or "").replace("_", " ").title()

    def find_matching_document(document_type):
        exact_matches = [
            doc for doc in documents
            if getattr(doc, "document_type", None) == document_type
        ]
        if exact_matches:
            return exact_matches[-1]

        if document_type == "police_report_or_arrest_report":
            grouped = [
                doc for doc in documents
                if getattr(doc, "document_type", None) in INQ_INITIATING_DOCUMENT_TYPES
            ]
            if grouped:
                return grouped[-1]

        if document_type == "inquest_resolution":
            grouped = [
                doc for doc in documents
                if getattr(doc, "document_type", None) in {"inquest_resolution", "resolution"}
            ]
            if grouped:
                return grouped[-1]

        return None

    def make_item(document_type, status, is_required=True):
        matched_doc = find_matching_document(document_type)
        is_present = matched_doc is not None
        is_reviewed = bool(getattr(matched_doc, "is_reviewed", False)) if matched_doc else False

        if not is_required:
            status_value = "not_applicable"
            status_label = "Optional"
        elif is_reviewed:
            status_value = "satisfied"
            status_label = "Satisfied"
        elif is_present:
            if status == "received_late":
                status_value = "uploaded"
                status_label = "Uploaded"
            else:
                status_value = "uploaded"
                status_label = "Uploaded"
        else:
            status_value = status
            label_map = {
                "uploaded": "Uploaded",
                "missing": "Missing",
                "pending": "Pending",
                "not_yet_required": "Not Yet Required",
                "under_compliance": "Under Compliance",
                "received_late": "Received Late",
                "not_applicable": "Not Applicable",
                "satisfied": "Satisfied",
            }
            status_label = label_map.get(status_value, make_label(status_value))

        remarks = None
        if not is_required:
            remarks = "Optional / not applicable for the current case state."
        elif is_reviewed:
            remarks = "Document uploaded and reviewed."
        elif is_present:
            remarks = "Document uploaded but still needs review."
        elif status == "under_compliance":
            remarks = "Waiting for compliance/submission."
        elif status == "pending":
            remarks = "Expected but not yet uploaded."
        elif status == "missing":
            remarks = "Required document not yet uploaded."
        elif status == "not_yet_required":
            remarks = "Document is not yet required at this stage."

        return {
            "document_type": document_type,
            "document_type_label": make_label(document_type),
            "status": status_value,
            "status_label": status_label,
            "label": status_label,

            "is_required": is_required,
            "is_present": is_present,
            "is_reviewed": is_reviewed,

            "matched_document_id": getattr(matched_doc, "id", None) if matched_doc else None,
            "matched_document_name": getattr(matched_doc, "uploaded_file_name", None) if matched_doc else None,

            "remarks": remarks,
        }

    def get_uploaded_status(document_type):
        tracker = tracker_map.get(document_type)
        if tracker and tracker.received_date and tracker.due_date:
            if tracker.received_date.date() > tracker.due_date.date():
                return "received_late"
        return "uploaded"

    if intake_case.case_type == "INV":
        if "complaint_affidavit" in uploaded_document_types:
            checklist.append(make_item("complaint_affidavit", get_uploaded_status("complaint_affidavit")))
        else:
            checklist.append(make_item("complaint_affidavit", "missing"))

        if "subpoena" in uploaded_document_types:
            checklist.append(make_item("subpoena", get_uploaded_status("subpoena")))
        else:
            checklist.append(make_item("subpoena", "pending"))

        if "counter_affidavit" in uploaded_document_types:
            checklist.append(make_item("counter_affidavit", get_uploaded_status("counter_affidavit")))
        elif "subpoena" in uploaded_document_types:
            checklist.append(make_item("counter_affidavit", "under_compliance"))
        else:
            checklist.append(make_item("counter_affidavit", "not_yet_required"))

        if "resolution" in uploaded_document_types:
            checklist.append(make_item("resolution", get_uploaded_status("resolution")))
        elif "counter_affidavit" in uploaded_document_types or "subpoena" in uploaded_document_types:
            checklist.append(make_item("resolution", "pending"))
        else:
            checklist.append(make_item("resolution", "not_yet_required"))

        if prosecution_result == "no_probable_cause":
            checklist.append(make_item("information", "not_applicable", is_required=False))
        elif prosecution_result == "with_probable_cause" or case_status in {"for_filing", "approved_for_filing"}:
            if "information" in uploaded_document_types:
                checklist.append(make_item("information", get_uploaded_status("information")))
            else:
                checklist.append(make_item("information", "pending"))
        else:
            checklist.append(make_item("information", "not_yet_required"))

    elif intake_case.case_type == "INQ":
        has_inq_initiating = has_any_uploaded(uploaded_document_types, INQ_INITIATING_DOCUMENT_TYPES)

        if has_inq_initiating:
            status = "uploaded"
            for doc_type in INQ_INITIATING_DOCUMENT_TYPES:
                tracker = tracker_map.get(doc_type)
                if tracker and tracker.received_date and tracker.due_date:
                    if tracker.received_date.date() > tracker.due_date.date():
                        status = "received_late"
                        break
            checklist.append(make_item("police_report_or_arrest_report", status))
        else:
            checklist.append(make_item("police_report_or_arrest_report", "missing"))

        if "inquest_resolution" in uploaded_document_types:
            checklist.append(make_item("inquest_resolution", get_uploaded_status("inquest_resolution")))
        elif "resolution" in uploaded_document_types:
            checklist.append(make_item("inquest_resolution", get_uploaded_status("resolution")))
        elif has_inq_initiating:
            checklist.append(make_item("inquest_resolution", "pending"))
        else:
            checklist.append(make_item("inquest_resolution", "not_yet_required"))

        if prosecution_result == "no_probable_cause":
            checklist.append(make_item("information", "not_applicable", is_required=False))
        elif prosecution_result == "with_probable_cause" or case_status in {"for_filing", "approved_for_filing", "filed_in_court"}:
            if "information" in uploaded_document_types:
                checklist.append(make_item("information", get_uploaded_status("information")))
            else:
                checklist.append(make_item("information", "pending"))
        else:
            checklist.append(make_item("information", "not_yet_required"))

    if case_number:
        tracker = tracker_map.get("case_number")
        if tracker and tracker.received_date and tracker.due_date:
            if tracker.received_date.date() > tracker.due_date.date():
                checklist.append(make_item("case_number", "received_late"))
            else:
                checklist.append(make_item("case_number", "uploaded"))
        else:
            checklist.append(make_item("case_number", "uploaded"))
    elif "information" in uploaded_document_types:
        checklist.append(make_item("case_number", "pending"))
    else:
        checklist.append(make_item("case_number", "not_yet_required"))

    return checklist

    
def sync_missing_document_trackers(db, intake_case, current_user_id):
    from app.services.staff.summary_service import summarize_intake_case_from_documents

    summary = summarize_intake_case_from_documents(db, intake_case.id) or {}
    checklist = build_initial_checklist(db, intake_case, summary)

    existing_items = (
        db.query(IntakeDocumentTracker)
        .filter(IntakeDocumentTracker.intake_case_id == intake_case.id)
        .all()
    )

    existing_by_doc_type = {item.document_type: item for item in existing_items}

    default_source_map = {
        "complaint_affidavit": ("Complainant", "Filing Office"),
        "subpoena": ("Assigned Prosecutor", "Prosecutor Office"),
        "counter_affidavit": ("Respondent", "Receiving Office"),
        "resolution": ("Assigned Prosecutor", "Prosecutor Office"),
        "police_report_or_arrest_report": ("Police Station / Arresting Unit", "Filing Office"),
        "inquest_resolution": ("Inquest Prosecutor", "Prosecutor Office"),
        "information": ("Court / Prosecutor Filing Unit", "Court Liaison"),
        "case_number": ("Court", "Court Liaison"),
    }

    status_map = {
        "uploaded": "received",
        "received_late": "received",
        "missing": "missing",
        "pending": "awaiting",
        "not_yet_required": "not_applicable",
        "under_compliance": "in_process",
        "not_applicable": "not_applicable",
    }

    for item in checklist:
        doc_type = item["document_type"]
        checklist_status = item["status"]

        source_location, office_department = default_source_map.get(doc_type, (None, None))
        tracker = existing_by_doc_type.get(doc_type)
        mapped_tracker_status = status_map.get(checklist_status, "awaiting")

        if not tracker:
            tracker = IntakeDocumentTracker(
                intake_case_id=intake_case.id,
                document_type=doc_type,
                tracking_type="missing" if checklist_status == "missing" else "expected",
                source_location=source_location,
                office_department=office_department,
                status=mapped_tracker_status,
                created_by=current_user_id,
                updated_by=current_user_id,
            )

            if mapped_tracker_status == "received" and not tracker.received_date:
                tracker.received_date = datetime.utcnow()

            db.add(tracker)
            continue

        tracker.source_location = tracker.source_location or source_location
        tracker.office_department = tracker.office_department or office_department
        tracker.updated_by = current_user_id

        if checklist_status == "received_late":
            tracker.status = "received"
            if not tracker.received_date:
                tracker.received_date = datetime.utcnow()
            if not tracker.remarks:
                tracker.remarks = "Received late"
            elif "Received late" not in tracker.remarks:
                tracker.remarks = f"{tracker.remarks} | Received late"

        elif checklist_status == "uploaded":
            tracker.status = "received"
            if not tracker.received_date:
                tracker.received_date = datetime.utcnow()

        elif checklist_status == "missing":
            if tracker.status not in {"received"}:
                tracker.status = "missing"

        elif checklist_status == "pending":
            if tracker.status not in {"received"}:
                tracker.status = "awaiting"

        elif checklist_status == "under_compliance":
            if tracker.status not in {"received"}:
                tracker.status = "in_process"

        elif checklist_status == "not_yet_required":
            if tracker.status not in {"received"}:
                tracker.status = "not_applicable"

        elif checklist_status == "not_applicable":
            if tracker.status not in {"received"}:
                tracker.status = "not_applicable"


def count_by_document_tracker_status(trackers):
    counts = {}
    for item in trackers:
        key = item.status or "unknown"
        counts[key] = counts.get(key, 0) + 1
    return counts

def count_by_case_status(cases):
    counts = {}
    for case_obj in cases:
        key = case_obj.case_status or "unknown"
        counts[key] = counts.get(key, 0) + 1
    return counts


def count_by_intake_status(intake_cases):
    counts = {}
    for intake_case in intake_cases:
        key = intake_case.intake_status or "unknown"
        counts[key] = counts.get(key, 0) + 1
    return counts
