#backend/app/services/staff/compliance_service.py


from datetime import datetime, timedelta
from model import IntakeComplianceItem, IntakeCaseDocument
from app.utils.dates import parse_optional_datetime


def ensure_subpoena_compliance_item(db, intake_case, document, summary, current_user_id=None):
    if intake_case.case_type != "INV":
        return

    if document.document_type != "subpoena":
        return

    existing = (
        db.query(IntakeComplianceItem)
        .filter(
            IntakeComplianceItem.intake_case_id == intake_case.id,
            IntakeComplianceItem.related_document_id == document.id,
            IntakeComplianceItem.compliance_type == "subpoena_compliance",
        )
        .first()
    )
    if existing:
        return

    extracted_meta = ((document.extracted_data or {}).get("metadata", {}) or {})
    reviewed_meta = document.reviewed_data or {}
    doc_data = dict(extracted_meta)
    doc_data.update(reviewed_meta)

    issued_date = parse_optional_datetime(
        doc_data.get("date_filed")
        or doc_data.get("issued_date")
        or summary.get("date_filed")
    )

    days_to_comply = 10
    due_date = issued_date + timedelta(days=days_to_comply) if issued_date else None

    compliance_item = IntakeComplianceItem(
        intake_case_id=intake_case.id,
        related_document_id=document.id,
        compliance_type="subpoena_compliance",
        title="Submission of Counter-Affidavit",
        description="Respondent is expected to comply with the subpoena and submit counter-affidavit within the allowed period.",
        issued_date=issued_date,
        due_date=due_date,
        days_to_comply=days_to_comply,
        compliance_status="pending",
        responsible_party="Respondent",
        created_by=current_user_id,
        updated_by=current_user_id,
    )
    db.add(compliance_item)


def mark_counter_affidavit_compliance_if_satisfied(db, intake_case, current_user_id=None):
    if intake_case.case_type != "INV":
        return

    uploaded_counter = (
        db.query(IntakeCaseDocument)
        .filter(
            IntakeCaseDocument.intake_case_id == intake_case.id,
            IntakeCaseDocument.document_type == "counter_affidavit",
        )
        .first()
    )

    if not uploaded_counter:
        return

    pending_items = (
        db.query(IntakeComplianceItem)
        .filter(
            IntakeComplianceItem.intake_case_id == intake_case.id,
            IntakeComplianceItem.compliance_type == "subpoena_compliance",
            IntakeComplianceItem.compliance_status == "pending",
        )
        .all()
    )

    for item in pending_items:
        item.compliance_status = "complied"
        item.complied_date = datetime.utcnow()
        item.updated_by = current_user_id


def count_by_compliance_status(items):
    counts = {}
    for item in items:
        key = item.compliance_status or "unknown"
        counts[key] = counts.get(key, 0) + 1
    return counts


def count_due_compliance_items(items):
    today = datetime.utcnow().date()

    summary = {
        "pending": 0,
        "due_today": 0,
        "overdue": 0,
        "complied": 0,
        "not_applicable": 0,
    }

    for item in items:
        status = item.compliance_status or "pending"

        if status == "complied":
            summary["complied"] += 1
            continue

        if status == "not_applicable":
            summary["not_applicable"] += 1
            continue

        if status == "pending":
            summary["pending"] += 1

            if item.due_date:
                due_date = item.due_date.date()
                if due_date < today:
                    summary["overdue"] += 1
                elif due_date == today:
                    summary["due_today"] += 1

    return summary