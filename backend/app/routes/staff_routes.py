# backend/app/routes/staff_routes.py
from flask import Blueprint, request, current_app
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from sqlalchemy import func
import os
import json
from database import SessionLocal
from collections import Counter
from model import (
    Case,
    CaseParty,
    IntakeCase,
    IntakeCaseDocument,
    CaseDocument,
    User,
    IntakeDocumentTracker,
    IntakeComplianceItem,
    StaffAuditLog,
    CaseCourtEvent,
)
from app.middleware.auth import role_required, get_current_user
from app.services.nlp.pipeline import process_document_pipeline

from app.utils.responses import success_response, error_response
from app.utils.pagination import parse_pagination_params, paginate_list, normalize_sort_direction
from app.utils.normalization import(
     normalize_document_type_name, 
     normalize_case_party_names, 
     first_non_empty, 
     normalize_to_list
)
from app.utils.files import ensure_directory_exists, safe_remove_file, safe_remove_directory
from app.utils.dates import parse_optional_datetime

from app.serializers.staff_serializers import (
    map_intake_status_label,
    map_intake_document_status_label,
    map_official_case_status_label,
    serialize_user_name,
    serialize_prosecutor,
    serialize_case_document,
    serialize_case_document_for_list,
    serialize_intake_case_document,
    serialize_intake_case,
    serialize_case,
    serialize_document_tracker,
    serialize_compliance_item,
    serialize_dashboard_case_row,
    serialize_dashboard_tracker_row,
    serialize_dashboard_compliance_row,
    build_intake_case_view,
    build_case_view,
    serialize_dashboard_intake_row,
    serialize_case_court_event,
)

from app.services.staff.case_service import (
    resolve_assigned_prosecutor,
    create_case_parties,
    validate_official_case_status,
    validate_court_result,
)

from app.services.staff.summary_service import (
    summarize_intake_case_from_documents,
    get_latest_intake_document_type,
    derive_intake_status_from_summary,
    get_latest_preferred_document,
    get_dashboard_offense_chart_data,
    get_latest_saved_reviewed_data_for_intake_case,
)

from app.services.staff.intake_document_service import (
    get_existing_initiating_document,
    get_unreviewed_intake_documents,
    validate_intake_document_type,
    is_initiating_document,
    apply_pipeline_result_to_intake_document,
    get_post_review_intake_status,
    assign_intake_document_versioning,
    assign_case_document_versioning,
    detect_pipeline_document_type,
    validate_initiating_document_match,
)

from app.services.staff.tracker_service import (
    build_initial_checklist,
    sync_missing_document_trackers,
    count_by_document_tracker_status,
    count_by_case_status,
    count_by_intake_status,
)

from app.services.staff.compliance_service import (
    ensure_subpoena_compliance_item,
    mark_counter_affidavit_compliance_if_satisfied,
    count_by_compliance_status,
    count_due_compliance_items,
)

from app.services.staff.audit_service import log_staff_action
from app.serializers.staff_serializers import serialize_staff_audit_log

from flask import send_from_directory

from app.constants.staff_case_constants import (
    ALLOWED_CASE_TYPES,
    INV_FOLLOWING_DOCUMENT_TYPES,
    INQ_INITIATING_DOCUMENT_TYPES,
    INQ_FOLLOWING_DOCUMENT_TYPES,
    INITIAL_DOCUMENT_TYPES_BY_CASE_TYPE,
    FOLLOWUP_DOCUMENT_TYPES_BY_CASE_TYPE,
    OFFICIAL_CASE_STATUSES,
    OFFICIAL_CASE_DOCUMENT_TYPES,
    COURT_RESULT_VALUES,
    COURT_EVENT_TYPES,
)

staff_bp = Blueprint("staff_bp", __name__, url_prefix="/staff")


@staff_bp.route("/uploads/<path:filename>", methods=["GET"])
@role_required(["staff"])
def serve_uploaded_file(filename):
    uploads_root = os.path.abspath("uploads")
    return send_from_directory(uploads_root, filename, as_attachment=False)


UPLOAD_BASE_FOLDER = "uploads"
INTAKE_CASE_UPLOAD_FOLDER = os.path.join(UPLOAD_BASE_FOLDER, "intake_cases")

PRE_INTAKE_STATUS = "pre_intake"
DRAFT_STATUS = "draft"
NEEDS_REVIEW_STATUS = "needs_review"


def normalize_case_flow_status(value):
    return str(value or "").strip().lower()


def is_pre_intake_status(value):
    return normalize_case_flow_status(value) == PRE_INTAKE_STATUS


def is_draft_status(value):
    return normalize_case_flow_status(value) == DRAFT_STATUS


def require_initiating_docket_number(reviewed_data):
    docket_number = (reviewed_data or {}).get("docket_number")
    if docket_number is None:
        return False
    if isinstance(docket_number, str):
        return bool(docket_number.strip())
    return bool(docket_number)


def determine_intake_status_after_document_change(db, intake_case):
    """
    Option B workflow status rules:
    - case type selected only -> pre_intake
    - initiating document uploaded/extracted but not fully confirmed -> needs_review
    - explicit cancel/save-draft -> draft
    - official intake happens only at confirm step
    """
    initiating_doc = get_existing_initiating_document(db, intake_case.id, intake_case.case_type)
    pending_review_docs = get_unreviewed_intake_documents(db, intake_case.id)

    if not initiating_doc:
        return PRE_INTAKE_STATUS

    if not initiating_doc.is_reviewed:
        return NEEDS_REVIEW_STATUS

    if pending_review_docs:
        return NEEDS_REVIEW_STATUS

    summary = summarize_intake_case_from_documents(db, intake_case.id) or {}
    derived_status = derive_intake_status_from_summary(
        intake_case.intake_status,
        summary,
        case_type=intake_case.case_type,
    )

    if derived_status in {None, "", PRE_INTAKE_STATUS, DRAFT_STATUS, NEEDS_REVIEW_STATUS, "for_confirmation"}:
        return "active"

    return derived_status



def sort_intake_case_views(items, sort_by="created_at", sort_dir="desc"):
    reverse = sort_dir == "desc"

    def sortable_value(row):
        value = row.get(sort_by)

        if value is None:
            return ""

        if isinstance(value, list):
            return ", ".join(str(x) for x in value).lower()

        return str(value).lower()

    return sorted(items, key=sortable_value, reverse=reverse)


@staff_bp.route("/prosecutors", methods=["GET"])
@role_required(["staff"])
def list_prosecutors():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        prosecutors = (
            db.query(User)
            .filter(User.role == "prosecutor")
            .order_by(User.first_name.asc(), User.last_name.asc())
            .all()
        )

        return success_response(
            "Prosecutors retrieved successfully.",
            data={
                "prosecutors": [serialize_prosecutor(user) for user in prosecutors]
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("list_prosecutors failed")
        return error_response(
            "Failed to fetch prosecutors.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


# -----------------------------
# Intake case routes
# -----------------------------
@staff_bp.route("/intake-cases", methods=["POST"])
@role_required(["staff"])
def create_intake_case():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        payload = request.get_json(silent=True) or {}
        case_type = (payload.get("case_type") or "").upper()
        review_notes = payload.get("review_notes")

        if case_type not in ALLOWED_CASE_TYPES:
            return error_response(
                "Invalid case_type.",
                errors=["Allowed values: INV or INQ"],
                status_code=400,
            )

        intake_case = IntakeCase(
            case_type=case_type,
            intake_status=PRE_INTAKE_STATUS,
            review_notes=review_notes,
            created_by=current_user_id,
            received_by=current_user_id,
            received_at=datetime.utcnow(),
        )
        db.add(intake_case)
        db.commit()
        db.refresh(intake_case)

        log_staff_action(
            db,
            user_id=current_user_id,
            action="intake_case_precreated",
            entity_type="intake_case",
            entity_id=intake_case.id,
            intake_case_id=intake_case.id,
            new_values={
                "case_type": intake_case.case_type,
                "intake_status": intake_case.intake_status,
                "review_notes": intake_case.review_notes,
            },
        )
        db.commit()
        db.refresh(intake_case)

        return success_response(
            "Intake case workflow initialized successfully.",
            data={"intake_case": build_intake_case_view(db, intake_case)},
            status_code=201,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("create_intake_case failed")
        return error_response(
            "Failed to initialize intake case workflow.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases", methods=["GET"])
@role_required(["staff"])
def list_intake_cases():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_type = (request.args.get("case_type") or "").upper().strip()
        tab = (request.args.get("tab") or "all").strip().lower()
        include_drafts = (request.args.get("include_drafts") or "").lower() == "true"
        intake_status = (request.args.get("intake_status") or "").strip()
        intake_document_status = (request.args.get("intake_document_status") or "").strip()
        prosecution_result = (request.args.get("prosecution_result") or "").strip()
        assigned_prosecutor_id = (request.args.get("assigned_prosecutor_id") or "").strip()
        search = (request.args.get("search") or "").strip()
        sort_by = (request.args.get("sort_by") or "created_at").strip()
        sort_dir = normalize_sort_direction(request.args.get("sort_dir"), default="desc")
        page, per_page = parse_pagination_params()

        query = db.query(IntakeCase)

        if case_type in ALLOWED_CASE_TYPES:
            query = query.filter(IntakeCase.case_type == case_type)

        intake_cases = query.order_by(IntakeCase.created_at.desc()).all()
        all_views = [build_intake_case_view(db, row) for row in intake_cases]

        def normalize(value):
            return str(value or "").strip().lower()

        def is_pre_intake_case(row):
            status = normalize(row.get("intake_status"))
            return status == "pre_intake"

        def is_draft_stage_case(row):
            status = normalize(row.get("intake_status"))
            return status in {"draft", "needs_review", "for_confirmation"}

        def is_dismissed_case(row):
            status = normalize(row.get("intake_status"))
            prosecution = normalize(row.get("prosecution_result"))
            prosecution_label = normalize(row.get("prosecution_result_label"))

            return (
                status == "resolved_dismissed"
                or prosecution in {"dismissed", "without_probable_cause", "no_probable_cause"}
                or prosecution_label in {"dismissed", "without probable cause", "no probable cause"}
            )

        def is_official_visible_case(row):
            status = normalize(row.get("intake_status"))
            return (
                status not in {"", "pre_intake", "draft", "needs_review", "for_confirmation"}
                and not is_dismissed_case(row)
            )

        # ---------------------------
        # TAB FILTERING
        # ---------------------------
        if tab == "drafts":
            visible_views = [row for row in all_views if is_draft_stage_case(row)]

        elif tab == "dismissed":
            visible_views = [row for row in all_views if is_dismissed_case(row)]

        elif tab == "inv":
            visible_views = [
                row for row in all_views
                if normalize(row.get("case_type")) == "inv" and is_official_visible_case(row)
            ]

        elif tab == "inq":
            visible_views = [
                row for row in all_views
                if normalize(row.get("case_type")) == "inq" and is_official_visible_case(row)
            ]

        else:  # all
            visible_views = [row for row in all_views if is_official_visible_case(row)]

        # Option B:
        # drafts / needs_review / for_confirmation should NEVER be mixed into official tabs
        # so keep include_drafts disabled for tab=all behavior
        if include_drafts and tab == "all":
            visible_views = [row for row in all_views if is_official_visible_case(row)]


        # ---------------------------
        # EXTRA FILTERS
        # ---------------------------
        if intake_status:
            visible_views = [
                row for row in visible_views
                if row.get("intake_status") == intake_status
            ]

        if intake_document_status:
            visible_views = [
                row for row in visible_views
                if row.get("intake_document_status") == intake_document_status
            ]

        if prosecution_result:
            visible_views = [
                row for row in visible_views
                if row.get("prosecution_result") == prosecution_result
            ]

        if assigned_prosecutor_id:
            try:
                assigned_prosecutor_id_int = int(assigned_prosecutor_id)
                visible_views = [
                    row for row in visible_views
                    if row.get("assigned_prosecutor_id") == assigned_prosecutor_id_int
                ]
            except ValueError:
                return error_response(
                    "Invalid assigned_prosecutor_id.",
                    errors=["assigned_prosecutor_id must be an integer."],
                    status_code=400,
                )

        if search:
            search_lower = search.lower()

            def matches_search(row):
                searchable_values = [
                    row.get("intake_case_id"),
                    row.get("intake_id"),
                    row.get("docket_number"),
                    row.get("case_number"),
                    row.get("case_title"),
                    row.get("offense_or_violation"),
                    row.get("assigned_prosecutor"),
                    row.get("court_branch"),
                    " ".join(row.get("complainants", [])),
                    " ".join(row.get("respondents", [])),
                ]
                for value in searchable_values:
                    if value and search_lower in str(value).lower():
                        return True
                return False

            visible_views = [row for row in visible_views if matches_search(row)]

        # ---------------------------
        # SORTING
        # ---------------------------
        allowed_sort_fields = {
            "created_at",
            "updated_at",
            "intake_case_id",
            "case_type",
            "date_filed",
            "docket_number",
            "case_number",
            "case_title",
            "assigned_prosecutor",
            "intake_status",
            "intake_document_status",
            "prosecution_result",
            "filed_in_court_date",
            "resolution_date",
        }

        if sort_by not in allowed_sort_fields:
            return error_response(
                "Invalid sort_by value.",
                errors=[f"Allowed values: {', '.join(sorted(allowed_sort_fields))}"],
                status_code=400,
            )

        visible_views = sort_intake_case_views(
            visible_views,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )

        paginated = paginate_list(visible_views, page, per_page)

        return success_response(
            "Intake cases retrieved successfully.",
            data={
                "filters": {
                    "case_type": case_type or None,
                    "tab": tab,
                    "include_drafts": include_drafts,
                    "intake_status": intake_status or None,
                    "intake_document_status": intake_document_status or None,
                    "prosecution_result": prosecution_result or None,
                    "assigned_prosecutor_id": assigned_prosecutor_id or None,
                    "search": search or None,
                    "sort_by": sort_by,
                    "sort_dir": sort_dir,
                },
                "counts": {
                    "all_filtered": len(visible_views),
                    "all": len([row for row in all_views if is_official_visible_case(row)]),
                    "inv": len([
                        row for row in all_views
                        if normalize(row.get("case_type")) == "inv" and is_official_visible_case(row)
                    ]),
                    "inq": len([
                        row for row in all_views
                        if normalize(row.get("case_type")) == "inq" and is_official_visible_case(row)
                    ]),
                    "dismissed": len([
                        row for row in all_views if is_dismissed_case(row)
                    ]),
                    "drafts": len([
                        row for row in all_views if is_draft_stage_case(row)
                    ]),
                },
                "pagination": paginated["pagination"],
                "intake_cases": paginated["items"],
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("list_intake_cases failed")
        return error_response(
            "Failed to fetch intake cases.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()



@staff_bp.route("/intake-cases/<int:intake_case_id>/save-draft", methods=["POST"])
@role_required(["staff"])
def save_intake_case_as_draft(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)

        if intake_case.converted_case_id:
            return error_response(
                "Cannot save a converted intake case as draft.",
                status_code=400,
            )

        old_values = {
            "intake_status": intake_case.intake_status,
            "review_notes": intake_case.review_notes,
        }

        initiating_doc = get_existing_initiating_document(db, intake_case.id, intake_case.case_type)
        if not initiating_doc:
            return error_response(
                "Cannot save as draft yet.",
                errors=["An initiating document must be uploaded first."],
                status_code=400,
            )

        extracted_payload = getattr(initiating_doc, "extracted_data", None)
        if not extracted_payload:
            return error_response(
                "Cannot save as draft yet.",
                errors=["The initiating document must be extracted first."],
                status_code=400,
            )

        payload = request.get_json(silent=True) or {}
        intake_case.review_notes = payload.get("review_notes", intake_case.review_notes)
        intake_case.extracted_data = summarize_intake_case_from_documents(db, intake_case.id) or {}
        intake_case.intake_status = DRAFT_STATUS

        sync_missing_document_trackers(db, intake_case, current_user_id)

        log_staff_action(
            db,
            user_id=current_user_id,
            action="intake_case_saved_as_draft",
            entity_type="intake_case",
            entity_id=intake_case.id,
            intake_case_id=intake_case.id,
            old_values=old_values,
            new_values={
                "intake_status": intake_case.intake_status,
                "review_notes": intake_case.review_notes,
            },
        )

        db.commit()
        db.refresh(intake_case)

        return success_response(
            "Intake case saved as draft successfully.",
            data={"intake_case": build_intake_case_view(db, intake_case)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("save_intake_case_as_draft failed")
        return error_response(
            "Failed to save intake case as draft.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/<int:intake_case_id>", methods=["GET"])
@role_required(["staff"])
def get_intake_case(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        current_user_id = getattr(current_user, "user_id", None) or getattr(current_user, "id", None)

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)

        documents = (
            db.query(IntakeCaseDocument)
            .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
            .order_by(IntakeCaseDocument.created_at.asc())
            .all()
        )

        latest_documents = [
            doc for doc in documents
            if getattr(doc, "is_latest", False)
        ]

        document_history = [
            serialize_intake_case_document(db, doc) for doc in documents
        ]

        summary = {}
        try:
            summary = summarize_intake_case_from_documents(db, intake_case.id) or {}
        except Exception as e:
            current_app.logger.exception("summarize_intake_case_from_documents failed")
            summary = {}

        try:
            intake_case.extracted_data = summary
            db.flush()
        except Exception as e:
            current_app.logger.exception("setting intake_case.extracted_data failed")
            db.rollback()

            intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
            documents = (
                db.query(IntakeCaseDocument)
                .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
                .order_by(IntakeCaseDocument.created_at.asc())
                .all()
            )
            latest_documents = [
                doc for doc in documents
                if getattr(doc, "is_latest", False)
            ]
            document_history = [
                serialize_intake_case_document(db, doc) for doc in documents
            ]

        try:
            if current_user_id:
                sync_missing_document_trackers(db, intake_case, current_user_id)
                db.flush()
        except Exception as e:
            current_app.logger.exception("sync_missing_document_trackers failed")
            db.rollback()

            intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
            documents = (
                db.query(IntakeCaseDocument)
                .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
                .order_by(IntakeCaseDocument.created_at.asc())
                .all()
            )
            latest_documents = [
                doc for doc in documents
                if getattr(doc, "is_latest", False)
            ]
            document_history = [
                serialize_intake_case_document(db, doc) for doc in documents
            ]

        try:
            db.commit()
        except Exception as e:
            current_app.logger.exception("commit failed in get_intake_case")
            db.rollback()

            intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
            documents = (
                db.query(IntakeCaseDocument)
                .filter(IntakeCaseDocument.intake_case_id == intake_case_id)
                .order_by(IntakeCaseDocument.created_at.asc())
                .all()
            )
            latest_documents = [
                doc for doc in documents
                if getattr(doc, "is_latest", False)
            ]
            document_history = [
                serialize_intake_case_document(db, doc) for doc in documents
            ]

        trackers = []
        try:
            trackers = (
                db.query(IntakeDocumentTracker)
                .filter(IntakeDocumentTracker.intake_case_id == intake_case.id)
                .order_by(IntakeDocumentTracker.created_at.asc())
                .all()
            )
        except Exception as e:
            current_app.logger.exception("loading trackers failed")
            trackers = []

        compliance_items = []
        try:
            compliance_items = (
                db.query(IntakeComplianceItem)
                .filter(IntakeComplianceItem.intake_case_id == intake_case.id)
                .order_by(IntakeComplianceItem.created_at.asc())
                .all()
            )
        except Exception as e:
            current_app.logger.exception("loading compliance items failed")
            compliance_items = []

        checklist = []
        try:
            checklist = build_initial_checklist(db, intake_case, summary or {})
        except Exception as e:
            current_app.logger.exception("build_initial_checklist failed")
            checklist = []

        intake_case_view = {}
        try:
            intake_case_view = build_intake_case_view(db, intake_case)
        except Exception as e:
            current_app.logger.exception("build_intake_case_view failed")
            intake_case_view = {
                "id": intake_case.id,
                "intake_case_id": getattr(intake_case, "intake_case_id", None),
                "case_type": getattr(intake_case, "case_type", None),
                "case_title": getattr(intake_case, "case_title", None),
                "docket_number": getattr(intake_case, "docket_number", None),
                "case_number": getattr(intake_case, "case_number", None),
                "intake_status": getattr(intake_case, "intake_status", None),
                "intake_document_status": getattr(intake_case, "intake_document_status", None),
                "prosecution_result": getattr(intake_case, "prosecution_result", None),
                "assigned_prosecutor_id": getattr(intake_case, "assigned_prosecutor_id", None),
                "court_branch": getattr(intake_case, "court_branch", None),
                "offense_or_violation": getattr(intake_case, "offense_or_violation", None),
                "date_filed": getattr(intake_case, "date_filed", None),
                "filed_in_court_date": getattr(intake_case, "filed_in_court_date", None),
                "resolution_date": getattr(intake_case, "resolution_date", None),
                "complainants": [],
                "respondents": [],
                "review_flags": [],
                "warnings": [],
            }

        return success_response(
            "Intake case retrieved successfully.",
            data={
                "intake_case": intake_case_view,
                "documents": [serialize_intake_case_document(db, doc) for doc in documents],
                "latest_documents": [serialize_intake_case_document(db, doc) for doc in latest_documents],
                "document_history": document_history,
                "checklist": checklist,
                "document_trackers": [serialize_document_tracker(item) for item in trackers],
                "compliance_items": [serialize_compliance_item(item) for item in compliance_items],
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_intake_case failed")
        return error_response(
            "Failed to fetch intake case.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/<int:intake_case_id>/confirm", methods=["POST"])
@role_required(["staff"])
def confirm_intake_case(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)
        
        old_values = {
            "intake_status": intake_case.intake_status,
            "review_notes": intake_case.review_notes,
            "extracted_data": intake_case.extracted_data,
        }

        if intake_case.converted_case_id:
            return error_response(
                "Intake case was already converted to an official case.",
                errors=[f"case_id={intake_case.converted_case_id}"],
                status_code=400,
            )

        intake_documents = (
            db.query(IntakeCaseDocument)
            .filter(IntakeCaseDocument.intake_case_id == intake_case.id)
            .order_by(IntakeCaseDocument.created_at.asc())
            .all()
        )

        if not intake_documents:
            return error_response(
                "No documents found for this intake case.",
                status_code=400,
            )

        initiating_doc = get_existing_initiating_document(db, intake_case.id, intake_case.case_type)
        if not initiating_doc:
            return error_response(
                "Initiating document is required before confirming the intake case.",
                status_code=400,
            )

        if not initiating_doc.is_reviewed:
            return error_response(
                "Please review and confirm the initiating document before confirming the intake case.",
                status_code=400,
            )

        pending_review_docs = get_unreviewed_intake_documents(db, intake_case.id)
        if pending_review_docs:
            return error_response(
                "Please review all extracted documents before confirming the intake case.",
                errors=[
                    f"Pending review document IDs: {', '.join(str(doc.id) for doc in pending_review_docs)}"
                ],
                status_code=400,
            )

        payload = request.get_json(silent=True) or {}
        summary = summarize_intake_case_from_documents(db, intake_case.id)

        resolved_prosecutor_id, resolved_prosecutor_name = resolve_assigned_prosecutor(
            db,
            assigned_prosecutor_value=payload.get("assigned_prosecutor"),
            assigned_prosecutor_id=payload.get("assigned_prosecutor_id"),
        )

        final_summary = {
            "document_type": first_non_empty(payload.get("document_type"), summary.get("document_type")),
            "date_filed": first_non_empty(payload.get("date_filed"), summary.get("date_filed")),
            "docket_number": first_non_empty(payload.get("docket_number"), summary.get("docket_number")),
            "case_number": first_non_empty(payload.get("case_number"), summary.get("case_number")),
            "complainants": first_non_empty(payload.get("complainants"), summary.get("complainants")) or [],
            "respondents": first_non_empty(payload.get("respondents"), summary.get("respondents")) or [],
            "offense_or_violation": first_non_empty(payload.get("offense_or_violation"), summary.get("offense_or_violation")),
            "case_title": first_non_empty(payload.get("case_title"), summary.get("case_title")),
            "assigned_prosecutor": first_non_empty(resolved_prosecutor_name, summary.get("assigned_prosecutor")),
            "assigned_prosecutor_id": first_non_empty(resolved_prosecutor_id, summary.get("assigned_prosecutor_id")),
            "resolution_date": first_non_empty(payload.get("resolution_date"), summary.get("resolution_date")),
            "filed_in_court_date": first_non_empty(payload.get("filed_in_court_date"), summary.get("filed_in_court_date")),
            "court_branch": first_non_empty(payload.get("court_branch"), summary.get("court_branch")),
            "case_status": first_non_empty(payload.get("case_status"), summary.get("case_status"), "intake_pending"),
            "prosecution_result": first_non_empty(payload.get("prosecution_result"), summary.get("prosecution_result")),
            "court_result": first_non_empty(payload.get("court_result"), summary.get("court_result")),
            "review_flags": summary.get("review_flags", []),
            "warnings": summary.get("warnings", []),
            "uploaded_document_types": summary.get("uploaded_document_types", []),
        }

        if not final_summary["case_title"]:
            if final_summary["complainants"] and final_summary["respondents"]:
                final_summary["case_title"] = f"{', '.join(final_summary['complainants'])} vs. {', '.join(final_summary['respondents'])}"
            elif final_summary["complainants"]:
                final_summary["case_title"] = final_summary["complainants"][0]
            else:
                final_summary["case_title"] = f"{intake_case.case_type} Intake Case {intake_case.id}"

        if not (final_summary.get("docket_number") and str(final_summary.get("docket_number")).strip()):
            return error_response(
                "Cannot confirm intake case without docket_number.",
                errors=["The initiating document review must include docket_number."],
                status_code=400,
            )

        intake_case.extracted_data = final_summary

        derived_status = derive_intake_status_from_summary(
            "active",
            final_summary,
            case_type=intake_case.case_type,
        )

        if derived_status in {None, PRE_INTAKE_STATUS, DRAFT_STATUS, NEEDS_REVIEW_STATUS, "for_confirmation"}:
            intake_case.intake_status = "active"
        else:
            intake_case.intake_status = derived_status

        sync_missing_document_trackers(db, intake_case, current_user_id)
        mark_counter_affidavit_compliance_if_satisfied(db, intake_case, current_user_id)

        intake_case.review_notes = payload.get("review_notes", intake_case.review_notes)

        log_staff_action(
            db,
            user_id=current_user_id,
            action="intake_case_confirmed",
            entity_type="intake_case",
            entity_id=intake_case.id,
            intake_case_id=intake_case.id,
            old_values=old_values,
            new_values={
                "intake_status": intake_case.intake_status,
                "review_notes": intake_case.review_notes,
                "extracted_data": intake_case.extracted_data,
            },
        )

        db.commit()
        db.refresh(intake_case)

        return success_response(
            "Intake case confirmed successfully and is now an official intake case.",
            data={
                "intake_case": build_intake_case_view(db, intake_case),
            },
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("confirm_intake_case failed")
        return error_response(
            "Failed to confirm intake case.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


# -----------------------------
# Intake document routes
# -----------------------------
@staff_bp.route("/intake-cases/<int:intake_case_id>/documents", methods=["POST"])
@role_required(["staff"])
def upload_intake_case_document(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)

        if intake_case.converted_case_id:
            return error_response(
                "Cannot upload documents to a converted intake case.",
                status_code=400,
            )

        if "document" not in request.files:
            return error_response(
                "No document file was provided.",
                errors=["document is required"],
                status_code=400,
            )

        file = request.files["document"]
        if not file or not file.filename:
            return error_response(
                "No document file was selected.",
                errors=["document file is empty"],
                status_code=400,
            )

        raw_document_type = request.form.get("document_type")
        document_type = normalize_document_type_name(raw_document_type)

        upload_mode = (request.form.get("upload_mode") or "extract").strip().lower()
        if upload_mode not in {"extract", "save_only"}:
            return error_response(
                "Invalid upload_mode.",
                errors=["Allowed values: extract or save_only"],
                status_code=400,
            )

        if not document_type:
            return error_response(
                "document_type is required.",
                errors=["Provide the initial document type for this intake case."],
                status_code=400,
            )

        date_received_raw = request.form.get("date_received")
        date_received = None

        if date_received_raw:
            try:
                date_received = datetime.fromisoformat(date_received_raw)
            except ValueError:
                try:
                    date_received = datetime.strptime(date_received_raw, "%Y-%m-%d")
                except ValueError:
                    return error_response(
                        "Invalid date_received format.",
                        errors=["Use YYYY-MM-DD or ISO datetime format."],
                        status_code=400,
                    )

        is_valid, validation_message = validate_intake_document_type(db, intake_case, document_type)
        if not is_valid:
            return error_response(
                validation_message,
                errors=[validation_message],
                status_code=400,
            )

        is_initiating = is_initiating_document(document_type, intake_case.case_type)

        if is_initiating and upload_mode != "extract":
            return error_response(
                "Initiating document must be extracted and reviewed before intake case confirmation.",
                errors=["Use upload_mode=extract for initiating documents."],
                status_code=400,
            )

        intake_case_folder = os.path.join(INTAKE_CASE_UPLOAD_FOLDER, str(intake_case.id))
        ensure_directory_exists(intake_case_folder)

        original_filename = secure_filename(file.filename)
        timestamp_prefix = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        saved_filename = f"{timestamp_prefix}_{original_filename}"
        saved_path = os.path.join(intake_case_folder, saved_filename)

        file.save(saved_path)

        file_size = os.path.getsize(saved_path)
        file_mime_type = file.mimetype

        pipeline_result = None

        # ------------------------------------------------------------
        # VALIDATION PASS
        # Read the actual uploaded file first before saving DB record.
        # Important: do NOT force document type during validation.
        # ------------------------------------------------------------
        if upload_mode == "extract":
            pipeline_result = process_document_pipeline(
                file_path=saved_path,
                mime_type=file_mime_type,
                forced_document_type=None,
            )

            if is_initiating:
                validation_result = validate_initiating_document_match(
                    intake_case=intake_case,
                    selected_document_type=document_type,
                    pipeline_result=pipeline_result,
                )

                if not validation_result["is_valid"]:
                    safe_remove_file(saved_path)
                    return error_response(
                        validation_result["message"],
                        errors=validation_result["errors"],
                        status_code=400,
                    )

        # ------------------------------------------------------------
        # CREATE DB RECORD ONLY AFTER VALIDATION PASSES
        # ------------------------------------------------------------
        document = IntakeCaseDocument(
            intake_case_id=intake_case.id,
            document_type=document_type,
            uploaded_file_name=original_filename,
            uploaded_file_path=saved_path,
            file_mime_type=file_mime_type,
            file_size=file_size,
            uploaded_by=current_user_id,
            date_received=date_received,
            is_initiating_document=is_initiating,
            ocr_status="processing",
            nlp_status="processing",
            document_status="processing",
        )

        assign_intake_document_versioning(db, document)

        db.add(document)
        db.commit()
        db.refresh(document)

        log_staff_action(
            db,
            user_id=current_user_id,
            action="intake_document_uploaded",
            entity_type="intake_document",
            entity_id=document.id,
            intake_case_id=intake_case.id,
            document_id=document.id,
            new_values={
                "document_type": document.document_type,
                "uploaded_file_name": document.uploaded_file_name,
                "document_status": document.document_status,
                "is_initiating_document": document.is_initiating_document,
            },
        )
        db.commit()

        if upload_mode == "save_only":
            document.ocr_status = "not_started"
            document.nlp_status = "not_started"
            document.document_status = "uploaded"

            summary = summarize_intake_case_from_documents(db, intake_case.id) or {}
            intake_case.extracted_data = summary

            if is_initiating:
                intake_case.intake_status = NEEDS_REVIEW_STATUS
            else:
                intake_case.intake_status = determine_intake_status_after_document_change(db, intake_case)

            sync_missing_document_trackers(db, intake_case, current_user_id)

            db.commit()
            db.refresh(document)
            db.refresh(intake_case)

            return success_response(
                "Document uploaded successfully. Extraction can be done later.",
                data={
                    "intake_case": build_intake_case_view(db, intake_case),
                    "document": serialize_intake_case_document(db, document),
                },
                status_code=201,
            )

        # ------------------------------------------------------------
        # FINAL PROCESSING PASS
        # Now safe to force selected type for downstream handling
        # ------------------------------------------------------------
        pipeline_result = process_document_pipeline(
            file_path=document.uploaded_file_path,
            mime_type=document.file_mime_type,
            forced_document_type=document_type,
        )

        apply_pipeline_result_to_intake_document(
            db=db,
            intake_case=intake_case,
            document=document,
            pipeline_result=pipeline_result,
            current_user_id=current_user_id,
        )

        intake_case.extracted_data = summarize_intake_case_from_documents(db, intake_case.id) or {}
        intake_case.intake_status = determine_intake_status_after_document_change(db, intake_case)
        sync_missing_document_trackers(db, intake_case, current_user_id)

        db.commit()
        db.refresh(document)
        db.refresh(intake_case)

        return success_response(
            "Intake case document uploaded and processed successfully.",
            data={
                "intake_case": build_intake_case_view(db, intake_case),
                "document": serialize_intake_case_document(db, document),
            },
            status_code=201,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("upload_intake_case_document failed")
        return error_response(
            "Failed to upload intake case document.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-case-documents/<int:document_id>", methods=["GET"])
@role_required(["staff"])
def get_intake_case_document(document_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        document = (
            db.query(IntakeCaseDocument)
            .filter(IntakeCaseDocument.id == document_id)
            .first()
        )

        if not document:
            return error_response("Intake case document not found.", status_code=404)

        intake_case = (
            db.query(IntakeCase)
            .filter(IntakeCase.id == document.intake_case_id)
            .first()
        )

        extracted_meta = ((document.extracted_data or {}).get("metadata", {}) or {})

        latest_saved_reviewed_data = {}
        case_summary = {}
        field_sources = {}

        if intake_case:
            latest_saved_reviewed_data = get_latest_saved_reviewed_data_for_intake_case(
                db,
                intake_case.id,
                exclude_document_id=document.id if not document.is_reviewed else None,
            ) or {}

            case_summary = summarize_intake_case_from_documents(db, intake_case.id) or {}

        reviewable_keys = [
            "document_type",
            "case_title",
            "docket_number",
            "case_number",
            "date_filed",
            "offense_or_violation",
            "assigned_prosecutor",
            "assigned_prosecutor_id",
            "case_status",
            "prosecution_result",
            "court_result",
            "resolution_date",
            "filed_in_court_date",
            "court_branch",
            "complainants",
            "respondents",
            "review_flags",
        ]

        merged_review_defaults = {}

        for key in reviewable_keys:
            previous_value = latest_saved_reviewed_data.get(key)
            current_value = extracted_meta.get(key)
            current_reviewed_value = (document.reviewed_data or {}).get(key)

            if current_reviewed_value not in (None, "", []):
                merged_review_defaults[key] = current_reviewed_value
                field_sources[key] = "current_reviewed"
            elif previous_value not in (None, "", []):
                merged_review_defaults[key] = previous_value
                field_sources[key] = "previous_review"
            elif current_value not in (None, "", []):
                merged_review_defaults[key] = current_value
                field_sources[key] = "current_extracted"
            else:
                merged_review_defaults[key] = [] if key in {"complainants", "respondents", "review_flags"} else ""
                field_sources[key] = "empty"

        merged_review_defaults["document_type"] = document.document_type

        return success_response(
            "Intake case document retrieved successfully.",
            data={
                "document": serialize_intake_case_document(db, document),
                "review_context": {
                    "latest_saved_reviewed_data": latest_saved_reviewed_data,
                    "current_extracted_data": extracted_meta,
                    "merged_review_defaults": merged_review_defaults,
                    "field_sources": field_sources,
                    "case_summary": case_summary,
                },
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_intake_case_document failed")
        return error_response(
            "Failed to fetch intake case document.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/intake-case-documents/<int:document_id>/extract", methods=["POST"])
@role_required(["staff"])
def extract_intake_case_document(document_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        document = (
            db.query(IntakeCaseDocument)
            .filter(IntakeCaseDocument.id == document_id)
            .first()
        )
        if not document:
            return error_response("Intake case document not found.", status_code=404)

        intake_case = (
            db.query(IntakeCase)
            .filter(IntakeCase.id == document.intake_case_id)
            .first()
        )
        if not intake_case:
            return error_response("Parent intake case not found.", status_code=404)

        if not document.uploaded_file_path or not os.path.isfile(document.uploaded_file_path):
            return error_response(
                "Document file is missing from storage.",
                status_code=400,
            )

        force_reextract = (request.args.get("force_reextract") or "").lower() == "true"

        if (
            document.ocr_status == "completed"
            and document.nlp_status == "completed"
            and document.extracted_data
            and not force_reextract
        ):
            return error_response(
                "Document was already extracted.",
                errors=["Use force_reextract=true if you want to run extraction again."],
                status_code=400,
            )

        document.extracted_data = None
        document.reviewed_data = None
        document.is_reviewed = False
        document.reviewed_by = None
        document.reviewed_at = None
        document.has_extraction_issues = False
        document.review_priority = None
        document.review_notes = None
        document.ocr_status = "processing"
        document.nlp_status = "processing"
        document.document_status = "processing"
        db.commit()

        pipeline_result = process_document_pipeline(
            file_path=document.uploaded_file_path,
            mime_type=document.file_mime_type,
            forced_document_type=document.document_type,
        )

        apply_pipeline_result_to_intake_document(
            db=db,
            intake_case=intake_case,
            document=document,
            pipeline_result=pipeline_result,
            current_user_id=current_user_id,
        )

        intake_case.extracted_data = summarize_intake_case_from_documents(db, intake_case.id) or {}
        intake_case.intake_status = determine_intake_status_after_document_change(db, intake_case)
        sync_missing_document_trackers(db, intake_case, current_user_id)

        db.commit()
        db.refresh(document)
        db.refresh(intake_case)

        return success_response(
            "Document extracted successfully. Please review the extracted result.",
            data={
                "document": serialize_intake_case_document(db, document),
                "intake_case": build_intake_case_view(db, intake_case),
            },
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("extract_intake_case_document failed")
        return error_response(
            "Failed to extract intake case document.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-case-documents/<int:document_id>/review", methods=["PATCH"])
@role_required(["staff"])
def review_intake_case_document(document_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        document = db.query(IntakeCaseDocument).filter(IntakeCaseDocument.id == document_id).first()
        if not document:
            return error_response("Intake case document not found.", status_code=404)

        old_values = {
            "reviewed_data": document.reviewed_data,
            "review_notes": document.review_notes,
            "is_reviewed": document.is_reviewed,
            "document_status": document.document_status,
        }

        payload = request.get_json(silent=True) or {}
        reviewed_data = payload.get("reviewed_data")
        review_notes = payload.get("review_notes")

        if not reviewed_data or not isinstance(reviewed_data, dict):
            return error_response(
                "reviewed_data is required and must be a valid JSON object.",
                status_code=400,
            )

        reviewed_data = dict(reviewed_data)
        reviewed_data["complainants"] = normalize_to_list(reviewed_data.get("complainants"))
        reviewed_data["respondents"] = normalize_to_list(reviewed_data.get("respondents"))
        reviewed_data["review_flags"] = normalize_to_list(reviewed_data.get("review_flags"))

        if document.is_initiating_document and not require_initiating_docket_number(reviewed_data):
            return error_response(
                "docket_number is required when reviewing the initiating document.",
                errors=["Provide docket_number before the intake case can move forward."],
                status_code=400,
            )

        resolved_prosecutor_id, resolved_prosecutor_name = resolve_assigned_prosecutor(
            db,
            assigned_prosecutor_value=reviewed_data.get("assigned_prosecutor"),
            assigned_prosecutor_id=reviewed_data.get("assigned_prosecutor_id"),
        )

        if resolved_prosecutor_name:
            reviewed_data["assigned_prosecutor"] = resolved_prosecutor_name
        if resolved_prosecutor_id:
            reviewed_data["assigned_prosecutor_id"] = resolved_prosecutor_id

        document.reviewed_data = reviewed_data
        document.review_notes = review_notes
        document.is_reviewed = True
        document.reviewed_by = current_user_id
        document.reviewed_at = datetime.utcnow()
        document.document_status = "reviewed"
        document.has_extraction_issues = False
        document.review_priority = "normal"

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == document.intake_case_id).first()
        if intake_case:
            summary = summarize_intake_case_from_documents(db, intake_case.id) or {}
            intake_case.extracted_data = summary

            ensure_subpoena_compliance_item(db, intake_case, document, summary, current_user_id)
            mark_counter_affidavit_compliance_if_satisfied(db, intake_case, current_user_id)
            sync_missing_document_trackers(db, intake_case, current_user_id)

            pending_review_docs = get_unreviewed_intake_documents(db, intake_case.id)

            if pending_review_docs:
                intake_case.intake_status = NEEDS_REVIEW_STATUS
            else:
                intake_case.intake_status = "for_confirmation"

        log_staff_action(
            db,
            user_id=current_user_id,
            action="intake_document_reviewed",
            entity_type="intake_document",
            entity_id=document.id,
            intake_case_id=document.intake_case_id,
            document_id=document.id,
            old_values=old_values,
            new_values={
                "reviewed_data": document.reviewed_data,
                "review_notes": document.review_notes,
                "is_reviewed": document.is_reviewed,
                "document_status": document.document_status,
            },
        )

        db.commit()
        db.refresh(document)

        return success_response(
            "Intake case document reviewed successfully.",
            data={
                "document": serialize_intake_case_document(db, document),
                "intake_case": build_intake_case_view(db, intake_case) if intake_case else None,
            },
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("review_intake_case_document failed")
        return error_response(
            "Failed to review intake case document.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-case-documents/<int:document_id>", methods=["DELETE"])
@role_required(["staff"])
def delete_intake_case_document(document_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        document = (
            db.query(IntakeCaseDocument)
            .filter(IntakeCaseDocument.id == document_id)
            .first()
        )

        if not document:
            return error_response("Intake case document not found.", status_code=404)

        old_values = {
            "document_type": document.document_type,
            "uploaded_file_name": document.uploaded_file_name,
            "document_status": document.document_status,
            "is_initiating_document": document.is_initiating_document,
        }

        intake_case = (
            db.query(IntakeCase)
            .filter(IntakeCase.id == document.intake_case_id)
            .first()
        )

        file_path = document.uploaded_file_path

        db.query(IntakeComplianceItem).filter(
            IntakeComplianceItem.related_document_id == document.id
        ).delete(synchronize_session=False)

        log_staff_action(
            db,
            user_id=current_user_id,
            action="intake_document_deleted",
            entity_type="intake_document",
            entity_id=document.id,
            intake_case_id=document.intake_case_id,
            document_id=document.id,
            old_values=old_values,
        )

        db.delete(document)
        db.flush()

        safe_remove_file(file_path)

        if intake_case:
            summary = summarize_intake_case_from_documents(db, intake_case.id) or {}
            intake_case.extracted_data = summary
            intake_case.intake_status = determine_intake_status_after_document_change(db, intake_case)
            sync_missing_document_trackers(db, intake_case, current_user_id)

        db.commit()

        return success_response(
            "Intake case document deleted successfully.",
            data={"document_id": document_id},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_intake_case_document failed")
        return error_response(
            "Failed to delete intake case document.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


# -----------------------------
# Case routes
# -----------------------------
@staff_bp.route("/cases", methods=["GET"])
@role_required(["staff"])
def list_cases():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        search = (request.args.get("search") or "").strip()
        case_type = (request.args.get("case_type") or "").upper().strip()
        case_status = (request.args.get("case_status") or "").strip()
        prosecution_result = (request.args.get("prosecution_result") or "").strip()
        court_result = (request.args.get("court_result") or "").strip()
        case_origin = (request.args.get("case_origin") or "").strip()
        assigned_prosecutor_id = (request.args.get("assigned_prosecutor_id") or "").strip()
        sort_by = (request.args.get("sort_by") or "created_at").strip()
        sort_dir = normalize_sort_direction(request.args.get("sort_dir"), default="desc")
        page, per_page = parse_pagination_params()

        query = db.query(Case)

        if case_type in ALLOWED_CASE_TYPES:
            query = query.filter(Case.case_type == case_type)

        if case_status:
            query = query.filter(Case.case_status == case_status)

        if prosecution_result:
            query = query.filter(Case.prosecution_result == prosecution_result)

        if court_result:
            query = query.filter(Case.court_result == court_result)

        if case_origin:
            query = query.filter(Case.case_origin == case_origin)

        if assigned_prosecutor_id:
            try:
                query = query.filter(Case.assigned_prosecutor_id == int(assigned_prosecutor_id))
            except ValueError:
                return error_response(
                    "Invalid assigned_prosecutor_id.",
                    errors=["assigned_prosecutor_id must be an integer."],
                    status_code=400,
                )

        if search:
            like_term = f"%{search}%"
            query = query.filter(
                (Case.case_number.ilike(like_term)) |
                (Case.docket_number.ilike(like_term)) |
                (Case.case_title.ilike(like_term)) |
                (Case.offense_or_violation.ilike(like_term)) |
                (Case.court_branch.ilike(like_term))
            )

        allowed_sort_fields = {
            "created_at": Case.created_at,
            "updated_at": Case.updated_at,
            "case_number": Case.case_number,
            "docket_number": Case.docket_number,
            "case_title": Case.case_title,
            "case_type": Case.case_type,
            "filing_date": Case.filing_date,
            "case_status": Case.case_status,
            "prosecution_result": Case.prosecution_result,
            "court_result": Case.court_result,
            "filed_in_court_date": Case.filed_in_court_date,
            "resolution_date": Case.resolution_date,
            "case_origin": Case.case_origin,
        }

        if sort_by not in allowed_sort_fields:
            return error_response(
                "Invalid sort_by value.",
                errors=[f"Allowed values: {', '.join(sorted(allowed_sort_fields.keys()))}"],
                status_code=400,
            )

        sort_column = allowed_sort_fields[sort_by]
        if sort_dir == "asc":
            query = query.order_by(sort_column.asc())
        else:
            query = query.order_by(sort_column.desc())

        all_cases = query.all()
        paginated = paginate_list(all_cases, page, per_page)

        return success_response(
            "Cases retrieved successfully.",
            data={
                "filters": {
                    "search": search or None,
                    "case_type": case_type or None,
                    "case_status": case_status or None,
                    "prosecution_result": prosecution_result or None,
                    "court_result": court_result or None,
                    "case_origin": case_origin or None,
                    "assigned_prosecutor_id": assigned_prosecutor_id or None,
                    "sort_by": sort_by,
                    "sort_dir": sort_dir,
                },
                "pagination": paginated["pagination"],
                "count": len(all_cases),
                "cases": [serialize_case(row) for row in paginated["items"]],
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("list_cases failed")
        return error_response(
            "Failed to fetch cases.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/cases/<int:case_id>", methods=["GET"])
@role_required(["staff"])
def get_case_details(case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Case not found.", status_code=404)

        parties = (
            db.query(CaseParty)
            .filter(CaseParty.case_id == case_id)
            .order_by(CaseParty.id.asc())
            .all()
        )

        documents = (
            db.query(CaseDocument)
            .filter(CaseDocument.case_id == case_id)
            .order_by(CaseDocument.created_at.asc())
            .all()
        )
        court_events = (
            db.query(CaseCourtEvent)
            .filter(CaseCourtEvent.case_id == case_id)
            .order_by(CaseCourtEvent.event_date.asc(), CaseCourtEvent.created_at.asc())
            .all()
        )

        latest_documents = [
            doc for doc in documents
            if getattr(doc, "is_latest", False)
        ]

        document_history = [
            serialize_case_document(db, doc) for doc in documents
        ]

        return success_response(
            "Case details retrieved successfully.",
            data={
                "case": serialize_case(case_obj, parties=parties, documents=documents),
                "latest_documents": [serialize_case_document(db, doc) for doc in latest_documents],
                "document_history": document_history,
                "court_events": [serialize_case_court_event(item) for item in court_events],
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_case_details failed")
        return error_response(
            "Failed to fetch case details.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


# -----------------------------
# Document tracker routes
# -----------------------------
@staff_bp.route("/intake-cases/<int:intake_case_id>/document-trackers", methods=["GET"])
@role_required(["staff"])
def get_intake_case_document_trackers(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)

        sync_missing_document_trackers(db, intake_case, current_user_id)
        db.commit()

        items = (
            db.query(IntakeDocumentTracker)
            .filter(IntakeDocumentTracker.intake_case_id == intake_case_id)
            .order_by(IntakeDocumentTracker.created_at.asc())
            .all()
        )

        return success_response(
            "Document trackers retrieved successfully.",
            data={
                "document_trackers": [serialize_document_tracker(item) for item in items]
            },
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("get_intake_case_document_trackers failed")
        return error_response(
            "Failed to fetch document trackers.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/<int:intake_case_id>/document-trackers", methods=["POST"])
@role_required(["staff"])
def create_intake_case_document_tracker(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        document_type = normalize_document_type_name(payload.get("document_type"))
        if not document_type:
            return error_response(
                "document_type is required.",
                status_code=400,
            )

        item = IntakeDocumentTracker(
            intake_case_id=intake_case.id,
            document_type=document_type,
            tracking_type=payload.get("tracking_type") or "expected",
            source_location=payload.get("source_location"),
            office_department=payload.get("office_department"),
            responsible_party=payload.get("responsible_party"),
            requested_date=parse_optional_datetime(payload.get("requested_date")),
            expected_date=parse_optional_datetime(payload.get("expected_date")),
            due_date=parse_optional_datetime(payload.get("due_date")),
            received_date=parse_optional_datetime(payload.get("received_date")),
            status=payload.get("status") or "awaiting",
            remarks=payload.get("remarks"),
            created_by=current_user_id,
            updated_by=current_user_id,
        )

        db.add(item)
        db.commit()
        db.refresh(item)

        return success_response(
            "Document tracker created successfully.",
            data={"document_tracker": serialize_document_tracker(item)},
            status_code=201,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("create_intake_case_document_tracker failed")
        return error_response(
            "Failed to create document tracker.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/<int:intake_case_id>/document-trackers/<int:tracker_id>", methods=["PATCH"])
@role_required(["staff"])
def update_intake_case_document_tracker(intake_case_id, tracker_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        item = (
            db.query(IntakeDocumentTracker)
            .filter(
                IntakeDocumentTracker.id == tracker_id,
                IntakeDocumentTracker.intake_case_id == intake_case_id,
            )
            .first()
        )

        if not item:
            return error_response("Document tracker not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        if "tracking_type" in payload:
            item.tracking_type = payload.get("tracking_type") or item.tracking_type
        if "source_location" in payload:
            item.source_location = payload.get("source_location")
        if "office_department" in payload:
            item.office_department = payload.get("office_department")
        if "responsible_party" in payload:
            item.responsible_party = payload.get("responsible_party")
        if "requested_date" in payload:
            item.requested_date = parse_optional_datetime(payload.get("requested_date"))
        if "expected_date" in payload:
            item.expected_date = parse_optional_datetime(payload.get("expected_date"))
        if "due_date" in payload:
            item.due_date = parse_optional_datetime(payload.get("due_date"))
        if "received_date" in payload:
            item.received_date = parse_optional_datetime(payload.get("received_date"))
        if "status" in payload:
            item.status = payload.get("status") or item.status
        if "remarks" in payload:
            item.remarks = payload.get("remarks")

        item.updated_by = current_user_id

        db.commit()
        db.refresh(item)

        return success_response(
            "Document tracker updated successfully.",
            data={"document_tracker": serialize_document_tracker(item)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("update_intake_case_document_tracker failed")
        return error_response(
            "Failed to update document tracker.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/<int:intake_case_id>/document-trackers/<int:tracker_id>", methods=["DELETE"])
@role_required(["staff"])
def delete_intake_case_document_tracker(intake_case_id, tracker_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        tracker = (
            db.query(IntakeDocumentTracker)
            .filter(
                IntakeDocumentTracker.id == tracker_id,
                IntakeDocumentTracker.intake_case_id == intake_case_id,
            )
            .first()
        )

        if not tracker:
            return error_response("Document tracker not found.", status_code=404)

        db.delete(tracker)
        db.commit()

        return success_response(
            "Document tracker deleted successfully.",
            data={"tracker_id": tracker_id},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_intake_case_document_tracker failed")
        return error_response(
            "Failed to delete document tracker.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


# -----------------------------
# Compliance item routes
# -----------------------------
@staff_bp.route("/intake-cases/<int:intake_case_id>/compliance-items", methods=["GET"])
@role_required(["staff"])
def get_intake_case_compliance_items(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)

        items = (
            db.query(IntakeComplianceItem)
            .filter(IntakeComplianceItem.intake_case_id == intake_case_id)
            .order_by(IntakeComplianceItem.created_at.asc())
            .all()
        )

        return success_response(
            "Compliance items retrieved successfully.",
            data={"compliance_items": [serialize_compliance_item(item) for item in items]},
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_intake_case_compliance_items failed")
        return error_response(
            "Failed to fetch compliance items.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/<int:intake_case_id>/compliance-items", methods=["POST"])
@role_required(["staff"])
def create_intake_case_compliance_item(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        title = (payload.get("title") or "").strip()
        compliance_type = (payload.get("compliance_type") or "").strip()

        if not title or not compliance_type:
            return error_response(
                "title and compliance_type are required.",
                status_code=400,
            )

        item = IntakeComplianceItem(
            intake_case_id=intake_case.id,
            related_document_id=payload.get("related_document_id"),
            compliance_type=compliance_type,
            title=title,
            description=payload.get("description"),
            issued_date=parse_optional_datetime(payload.get("issued_date")),
            due_date=parse_optional_datetime(payload.get("due_date")),
            days_to_comply=payload.get("days_to_comply"),
            complied_date=parse_optional_datetime(payload.get("complied_date")),
            compliance_status=payload.get("compliance_status") or "pending",
            responsible_party=payload.get("responsible_party"),
            remarks=payload.get("remarks"),
            created_by=current_user_id,
            updated_by=current_user_id,
        )

        db.add(item)
        db.commit()
        db.refresh(item)

        return success_response(
            "Compliance item created successfully.",
            data={"compliance_item": serialize_compliance_item(item)},
            status_code=201,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("create_intake_case_compliance_item failed")
        return error_response(
            "Failed to create compliance item.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/<int:intake_case_id>/compliance-items/<int:compliance_id>", methods=["PATCH"])
@role_required(["staff"])
def update_intake_case_compliance_item(intake_case_id, compliance_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        item = (
            db.query(IntakeComplianceItem)
            .filter(
                IntakeComplianceItem.id == compliance_id,
                IntakeComplianceItem.intake_case_id == intake_case_id,
            )
            .first()
        )

        if not item:
            return error_response("Compliance item not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        if "title" in payload:
            item.title = payload.get("title") or item.title
        if "description" in payload:
            item.description = payload.get("description")
        if "issued_date" in payload:
            item.issued_date = parse_optional_datetime(payload.get("issued_date"))
        if "due_date" in payload:
            item.due_date = parse_optional_datetime(payload.get("due_date"))
        if "days_to_comply" in payload:
            item.days_to_comply = payload.get("days_to_comply")
        if "complied_date" in payload:
            item.complied_date = parse_optional_datetime(payload.get("complied_date"))
        if "compliance_status" in payload:
            item.compliance_status = payload.get("compliance_status") or item.compliance_status
        if "responsible_party" in payload:
            item.responsible_party = payload.get("responsible_party")
        if "remarks" in payload:
            item.remarks = payload.get("remarks")

        item.updated_by = current_user_id

        db.commit()
        db.refresh(item)

        return success_response(
            "Compliance item updated successfully.",
            data={"compliance_item": serialize_compliance_item(item)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("update_intake_case_compliance_item failed")
        return error_response(
            "Failed to update compliance item.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


# -----------------------------
# Delete / reset routes
# -----------------------------
@staff_bp.route("/intake-cases/<int:intake_case_id>", methods=["DELETE"])
@role_required(["staff"])
def delete_intake_case(intake_case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)

        if intake_case.converted_case_id:
            return error_response(
                "Cannot delete an intake case that was already converted to an official case.",
                status_code=400,
            )

        documents = (
            db.query(IntakeCaseDocument)
            .filter(IntakeCaseDocument.intake_case_id == intake_case.id)
            .all()
        )

        folder_path = os.path.join(INTAKE_CASE_UPLOAD_FOLDER, str(intake_case.id))

        document_ids = [doc.id for doc in documents]
        file_paths = [doc.uploaded_file_path for doc in documents]

        if document_ids:
            db.query(IntakeComplianceItem).filter(
                IntakeComplianceItem.related_document_id.in_(document_ids)
            ).delete(synchronize_session=False)

        db.query(IntakeComplianceItem).filter(
            IntakeComplianceItem.intake_case_id == intake_case.id
        ).delete(synchronize_session=False)

        db.query(IntakeDocumentTracker).filter(
            IntakeDocumentTracker.intake_case_id == intake_case.id
        ).delete(synchronize_session=False)

        db.query(IntakeCaseDocument).filter(
            IntakeCaseDocument.intake_case_id == intake_case.id
        ).delete(synchronize_session=False)

        db.delete(intake_case)
        db.commit()

        for file_path in file_paths:
            safe_remove_file(file_path)

        safe_remove_directory(folder_path)

        return success_response(
            "Intake case deleted successfully.",
            data={"intake_case_id": intake_case_id},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_intake_case failed")
        return error_response(
            "Failed to delete intake case.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/reset", methods=["DELETE"])
@role_required(["staff"])
def reset_unconverted_intake_cases():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        intake_cases = (
            db.query(IntakeCase)
            .filter(IntakeCase.converted_case_id.is_(None))
            .all()
        )

        if not intake_cases:
            return success_response(
                "No unconverted intake cases found.",
                data={
                    "deleted_intake_case_ids": [],
                    "deleted_count": 0,
                },
                status_code=200,
            )

        deleted_ids = []
        file_paths = []
        folder_paths = []

        for intake_case in intake_cases:
            documents = (
                db.query(IntakeCaseDocument)
                .filter(IntakeCaseDocument.intake_case_id == intake_case.id)
                .all()
            )

            document_ids = [doc.id for doc in documents]
            file_paths.extend([doc.uploaded_file_path for doc in documents if doc.uploaded_file_path])
            folder_paths.append(os.path.join(INTAKE_CASE_UPLOAD_FOLDER, str(intake_case.id)))

            if document_ids:
                db.query(IntakeComplianceItem).filter(
                    IntakeComplianceItem.related_document_id.in_(document_ids)
                ).delete(synchronize_session=False)

            db.query(IntakeComplianceItem).filter(
                IntakeComplianceItem.intake_case_id == intake_case.id
            ).delete(synchronize_session=False)

            db.query(IntakeDocumentTracker).filter(
                IntakeDocumentTracker.intake_case_id == intake_case.id
            ).delete(synchronize_session=False)

            db.query(IntakeCaseDocument).filter(
                IntakeCaseDocument.intake_case_id == intake_case.id
            ).delete(synchronize_session=False)

            deleted_ids.append(intake_case.id)
            db.delete(intake_case)

        db.commit()

        for path in file_paths:
            safe_remove_file(path)

        for folder in folder_paths:
            safe_remove_directory(folder)

        return success_response(
            "All unconverted intake cases deleted successfully.",
            data={
                "deleted_intake_case_ids": deleted_ids,
                "deleted_count": len(deleted_ids),
            },
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("reset_unconverted_intake_cases failed")
        return error_response(
            "Failed to reset unconverted intake cases.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/delete-all", methods=["DELETE"])
@role_required(["staff"])
def delete_all_intake_cases():
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        intake_cases = db.query(IntakeCase).all()

        if not intake_cases:
            return success_response(
                "No intake cases found.",
                data={"deleted_count": 0, "deleted_intake_case_ids": []},
                status_code=200,
            )

        deleted_ids = []
        file_paths = []
        folder_paths = []

        for intake_case in intake_cases:
            documents = (
                db.query(IntakeCaseDocument)
                .filter(IntakeCaseDocument.intake_case_id == intake_case.id)
                .all()
            )

            document_ids = [doc.id for doc in documents]
            file_paths.extend([doc.uploaded_file_path for doc in documents if doc.uploaded_file_path])
            folder_paths.append(os.path.join(INTAKE_CASE_UPLOAD_FOLDER, str(intake_case.id)))

            if document_ids:
                db.query(IntakeComplianceItem).filter(
                    IntakeComplianceItem.related_document_id.in_(document_ids)
                ).delete(synchronize_session=False)

            db.query(IntakeComplianceItem).filter(
                IntakeComplianceItem.intake_case_id == intake_case.id
            ).delete(synchronize_session=False)

            db.query(IntakeDocumentTracker).filter(
                IntakeDocumentTracker.intake_case_id == intake_case.id
            ).delete(synchronize_session=False)

            db.query(IntakeCaseDocument).filter(
                IntakeCaseDocument.intake_case_id == intake_case.id
            ).delete(synchronize_session=False)

            deleted_ids.append(intake_case.id)
            db.delete(intake_case)

        db.commit()

        for path in file_paths:
            safe_remove_file(path)

        for folder in folder_paths:
            safe_remove_directory(folder)

        return success_response(
            "All intake cases deleted successfully.",
            data={
                "deleted_count": len(deleted_ids),
                "deleted_intake_case_ids": deleted_ids,
            },
            status_code=200,
        )
    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_all_intake_cases failed")
        return error_response(
            "Failed to delete all intake cases.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-case-documents/delete-all", methods=["DELETE"])
@role_required(["staff"])
def delete_all_intake_case_documents():
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        documents = db.query(IntakeCaseDocument).all()

        if not documents:
            return success_response(
                "No intake case documents found.",
                data={"deleted_count": 0, "deleted_document_ids": []},
                status_code=200,
            )

        document_ids = [doc.id for doc in documents]
        file_paths = [doc.uploaded_file_path for doc in documents if doc.uploaded_file_path]

        db.query(IntakeComplianceItem).filter(
            IntakeComplianceItem.related_document_id.in_(document_ids)
        ).delete(synchronize_session=False)

        deleted = db.query(IntakeCaseDocument).delete(synchronize_session=False)

        intake_cases = db.query(IntakeCase).all()
        for intake_case in intake_cases:
            summary = summarize_intake_case_from_documents(db, intake_case.id) or {}
            intake_case.extracted_data = summary
            intake_case.intake_status = determine_intake_status_after_document_change(db, intake_case)
            sync_missing_document_trackers(db, intake_case, current_user.user_id)

        db.commit()

        for path in file_paths:
            safe_remove_file(path)

        return success_response(
            "All intake case documents deleted successfully.",
            data={"deleted_count": deleted, "deleted_document_ids": document_ids},
            status_code=200,
        )
    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_all_intake_case_documents failed")
        return error_response(
            "Failed to delete all intake case documents.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-document-trackers/delete-all", methods=["DELETE"])
@role_required(["staff"])
def delete_all_intake_document_trackers():
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        tracker_ids = [row.id for row in db.query(IntakeDocumentTracker).all()]
        deleted = db.query(IntakeDocumentTracker).delete(synchronize_session=False)
        db.commit()

        return success_response(
            "All intake document trackers deleted successfully.",
            data={"deleted_count": deleted, "deleted_tracker_ids": tracker_ids},
            status_code=200,
        )
    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_all_intake_document_trackers failed")
        return error_response(
            "Failed to delete all intake document trackers.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/intake-cases/<int:intake_case_id>/convert", methods=["POST"])
@role_required(["staff"])
def convert_intake_case_to_official(intake_case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        intake_case = db.query(IntakeCase).filter(IntakeCase.id == intake_case_id).first()
        if not intake_case:
            return error_response("Intake case not found.", status_code=404)
    
        old_values = {
            "intake_status": intake_case.intake_status,
            "converted_case_id": intake_case.converted_case_id,
            "converted_at": intake_case.converted_at.isoformat() if intake_case.converted_at else None,
        }

        if intake_case.converted_case_id:
            return error_response(
                "Intake case already converted.",
                errors=[f"case_id={intake_case.converted_case_id}"],
                status_code=400,
            )

        intake_data = intake_case.extracted_data or summarize_intake_case_from_documents(db, intake_case.id)

        if intake_case.intake_status != "ready_for_conversion":
            return error_response(
                "Only intake cases marked as ready_for_conversion can be converted to an official case.",
                errors=[f"current_intake_status={intake_case.intake_status}"],
                status_code=400,
            )

        pending_review_docs = get_unreviewed_intake_documents(db, intake_case.id)
        if pending_review_docs:
            return error_response(
                "Cannot convert intake case while some documents are still pending review.",
                errors=[
                    f"Pending review document IDs: {', '.join(str(doc.id) for doc in pending_review_docs)}"
                ],
                status_code=400,
            )

        if not intake_data.get("case_number"):
            return error_response(
                "Cannot convert intake case without a case number.",
                errors=["Official conversion requires court case number first."],
                status_code=400,
            )

        initiating_doc = get_existing_initiating_document(db, intake_case.id, intake_case.case_type)
        if not initiating_doc:
            return error_response(
                "Initiating document is required before conversion.",
                status_code=400,
            )

        if not initiating_doc.is_reviewed:
            return error_response(
                "Initiating document must be reviewed before conversion.",
                status_code=400,
            )

        assigned_prosecutor_id, _assigned_prosecutor_name = resolve_assigned_prosecutor(
            db,
            assigned_prosecutor_value=intake_data.get("assigned_prosecutor"),
            assigned_prosecutor_id=intake_data.get("assigned_prosecutor_id"),
        )

        new_case = Case(
            case_number=intake_data.get("case_number"),
            docket_number=intake_data.get("docket_number"),
            case_title=intake_data.get("case_title"),
            offense_or_violation=intake_data.get("offense_or_violation"),
            case_type=intake_case.case_type,
            filing_date=parse_optional_datetime(intake_data.get("date_filed")),
            assigned_prosecutor_id=assigned_prosecutor_id,
            created_by=current_user_id,
            case_origin="intake_case",
            intake_status="converted",
            case_status=intake_data.get("case_status") or "for_filing",
            prosecution_result=intake_data.get("prosecution_result"),
            court_result=intake_data.get("court_result") or "none",
            custody_result=intake_data.get("custody_result") or "none",
            summary=json.dumps({
                **intake_data,
                "assigned_prosecutor_id": assigned_prosecutor_id,
                "source_intake_case_id": intake_case.id,
                "converted_at": datetime.utcnow().isoformat(),
            }),
            resolution_date=parse_optional_datetime(intake_data.get("resolution_date")),
            filed_in_court_date=parse_optional_datetime(intake_data.get("filed_in_court_date")),
            court_branch=intake_data.get("court_branch"),
            source_intake_case_id=intake_case.id,
            latest_document_type=get_latest_intake_document_type(db, intake_case.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(new_case)
        db.commit()
        db.refresh(new_case)

        create_case_parties(
            db,
            new_case.id,
            intake_data.get("complainants", []),
            intake_data.get("respondents", []),
        )
        db.commit()

        intake_case.intake_status = "converted"
        intake_case.converted_case_id = new_case.id
        intake_case.converted_at = datetime.utcnow()
        db.commit()

        intake_documents = (
            db.query(IntakeCaseDocument)
            .filter(IntakeCaseDocument.intake_case_id == intake_case.id)
            .all()
        )
        for doc in intake_documents:
            db.add(CaseDocument(
                case_id=new_case.id,
                document_type=doc.document_type,
                uploaded_file_name=doc.uploaded_file_name,
                uploaded_file_path=doc.uploaded_file_path,
                file_mime_type=doc.file_mime_type,
                file_size=doc.file_size,
                uploaded_by=doc.uploaded_by,
                is_initiating_document=doc.is_initiating_document,
                ocr_text=doc.ocr_text,
                extracted_data=doc.extracted_data,
                reviewed_data=doc.reviewed_data,
                has_extraction_issues=doc.has_extraction_issues,
                review_priority=doc.review_priority,
                review_notes=doc.review_notes,
                is_reviewed=doc.is_reviewed,
                reviewed_by=doc.reviewed_by,
                reviewed_at=doc.reviewed_at,
                case_applied_at=doc.case_applied_at,
                document_status=doc.document_status,
                source_intake_case_document_id=doc.id,
                created_at=doc.created_at,
                updated_at=doc.updated_at,
            ))

        intake_trackers = (
            db.query(IntakeDocumentTracker)
            .filter(IntakeDocumentTracker.intake_case_id == intake_case.id)
            .all()
        )
        for tracker in intake_trackers:
            db.add(IntakeDocumentTracker(
                intake_case_id=None,
                case_id=new_case.id,
                document_type=tracker.document_type,
                tracking_type=tracker.tracking_type,
                source_location=tracker.source_location,
                office_department=tracker.office_department,
                responsible_party=tracker.responsible_party,
                requested_date=tracker.requested_date,
                expected_date=tracker.expected_date,
                due_date=tracker.due_date,
                received_date=tracker.received_date,
                status=tracker.status,
                remarks=tracker.remarks,
                created_by=tracker.created_by,
                updated_by=tracker.updated_by,
                created_at=tracker.created_at,
                updated_at=tracker.updated_at,
            ))

        intake_compliances = (
            db.query(IntakeComplianceItem)
            .filter(IntakeComplianceItem.intake_case_id == intake_case.id)
            .all()
        )
        for item in intake_compliances:
            db.add(IntakeComplianceItem(
                intake_case_id=None,
                case_id=new_case.id,
                related_document_id=item.related_document_id,
                compliance_type=item.compliance_type,
                title=item.title,
                description=item.description,
                issued_date=item.issued_date,
                due_date=item.due_date,
                days_to_comply=item.days_to_comply,
                complied_date=item.complied_date,
                compliance_status=item.compliance_status,
                responsible_party=item.responsible_party,
                remarks=item.remarks,
                created_by=item.created_by,
                updated_by=item.updated_by,
                created_at=item.created_at,
                updated_at=item.updated_at,
            ))

        db.commit()

        log_staff_action(
            db,
            user_id=current_user_id,
            action="intake_case_converted",
            entity_type="intake_case",
            entity_id=intake_case.id,
            intake_case_id=intake_case.id,
            case_id=new_case.id,
            old_values=old_values,
            new_values={
                "intake_status": intake_case.intake_status,
                "converted_case_id": intake_case.converted_case_id,
                "converted_at": intake_case.converted_at.isoformat() if intake_case.converted_at else None,
                "new_case_id": new_case.id,
                "new_case_number": new_case.case_number,
            },
        )
        db.commit()

        return success_response(
            "Intake case converted to official case successfully.",
            data={
                "case": serialize_case(new_case),
                "intake_case": serialize_intake_case(db, intake_case)
            },
            status_code=200
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("convert_intake_case_to_official failed")
        return error_response(
            "Failed to convert intake case.",
            errors=[str(e)],
            status_code=500
        )
    finally:
        db.close()


# -----------------------------
# Official Case Document Routes
# -----------------------------
@staff_bp.route("/cases/<int:case_id>/documents", methods=["POST"])
@role_required(["staff"])
def upload_case_document(case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Official case not found.", status_code=404)

        if "document" not in request.files:
            return error_response(
                "No document file provided.",
                errors=["document is required"],
                status_code=400,
            )

        file = request.files["document"]
        if not file.filename:
            return error_response(
                "Empty document file.",
                errors=["document file is empty"],
                status_code=400
            )

        document_type = normalize_document_type_name(request.form.get("document_type"))
        if not document_type:
            return error_response("document_type is required.", status_code=400)

        if document_type not in OFFICIAL_CASE_DOCUMENT_TYPES:
            return error_response(
                "Invalid official case document type.",
                errors=[f"Allowed values: {', '.join(sorted(OFFICIAL_CASE_DOCUMENT_TYPES))}"],
                status_code=400,
            )

        case_folder = os.path.join(UPLOAD_BASE_FOLDER, "cases", str(case_id))
        ensure_directory_exists(case_folder)

        original_filename = secure_filename(file.filename)
        timestamp_prefix = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
        saved_filename = f"{timestamp_prefix}_{original_filename}"
        saved_path = os.path.join(case_folder, saved_filename)
        file.save(saved_path)

        file_size = os.path.getsize(saved_path)
        file_mime_type = file.mimetype

        document = CaseDocument(
            case_id=case_id,
            document_type=document_type,
            uploaded_file_name=original_filename,
            uploaded_file_path=saved_path,
            file_mime_type=file_mime_type,
            file_size=file_size,
            uploaded_by=current_user_id,
            document_status="uploaded",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        assign_case_document_versioning(db, document)

        db.add(document)

        case_obj.latest_document_type = document_type
        case_obj.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(document)

        log_staff_action(
            db,
            user_id=current_user_id,
            action="official_document_uploaded",
            entity_type="case_document",
            entity_id=document.id,
            case_id=case_id,
            document_id=document.id,
            new_values={
                "document_type": document.document_type,
                "uploaded_file_name": document.uploaded_file_name,
                "document_status": document.document_status,
            },
        )
        db.commit()

        return success_response(
            "Document uploaded to official case successfully.",
            data={"document": serialize_case_document_for_list(db, document)},
            status_code=201
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("upload_case_document failed")
        return error_response(
            "Failed to upload case document.",
            errors=[str(e)],
            status_code=500
        )
    finally:
        db.close()


@staff_bp.route("/cases/<int:case_id>/documents", methods=["GET"])
@role_required(["staff"])
def list_case_documents(case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Official case not found.", status_code=404)

        documents = (
            db.query(CaseDocument)
            .filter(CaseDocument.case_id == case_id)
            .order_by(CaseDocument.created_at.asc())
            .all()
        )

        return success_response(
            "Case documents retrieved successfully.",
            data={
                "documents": [serialize_case_document_for_list(db, doc) for doc in documents]
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("list_case_documents failed")
        return error_response(
            "Failed to fetch case documents.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()




@staff_bp.route("/case-documents/<int:document_id>", methods=["PATCH"])
@role_required(["staff"])
def update_case_document(document_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        document = (
            db.query(CaseDocument)
            .filter(CaseDocument.id == document_id)
            .first()
        )
        if not document:
            return error_response("Case document not found.", status_code=404)

        old_values = {
            "document_type": document.document_type,
            "review_notes": document.review_notes,
            "document_status": document.document_status,
            "is_reviewed": document.is_reviewed,
        }

        payload = request.get_json(silent=True) or {}

        if "document_type" in payload:
            new_document_type = normalize_document_type_name(payload.get("document_type"))
            if not new_document_type:
                return error_response("document_type cannot be empty.", status_code=400)
            if new_document_type not in OFFICIAL_CASE_DOCUMENT_TYPES:
                return error_response(
                    "Invalid official case document type.",
                    errors=[f"Allowed values: {', '.join(sorted(OFFICIAL_CASE_DOCUMENT_TYPES))}"],
                    status_code=400,
                )
            document.document_type = new_document_type

            case_obj = db.query(Case).filter(Case.id == document.case_id).first()
            if case_obj:
                case_obj.latest_document_type = new_document_type
                case_obj.updated_at = datetime.utcnow()

        if "review_notes" in payload:
            document.review_notes = payload.get("review_notes")

        if "document_status" in payload:
            new_status = (payload.get("document_status") or "").strip()
            allowed_statuses = {"uploaded", "processing", "processed", "needs_review", "reviewed", "failed"}
            if new_status and new_status not in allowed_statuses:
                return error_response(
                    "Invalid document_status.",
                    errors=[f"Allowed values: {', '.join(sorted(allowed_statuses))}"],
                    status_code=400,
                )
            if new_status:
                document.document_status = new_status

        if payload.get("mark_reviewed") is True:
            document.is_reviewed = True
            document.reviewed_by = current_user_id
            document.reviewed_at = datetime.utcnow()
            if document.document_status == "uploaded":
                document.document_status = "reviewed"

        document.updated_at = datetime.utcnow()

        log_staff_action(
            db,
            user_id=current_user_id,
            action="official_document_updated",
            entity_type="case_document",
            entity_id=document.id,
            case_id=document.case_id,
            document_id=document.id,
            old_values=old_values,
            new_values={
                "document_type": document.document_type,
                "review_notes": document.review_notes,
                "document_status": document.document_status,
                "is_reviewed": document.is_reviewed,
            },
        )

        db.commit()
        db.refresh(document)

        return success_response(
            "Case document updated successfully.",
            data={"document": serialize_case_document_for_list(db, document)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("update_case_document failed")
        return error_response(
            "Failed to update case document.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/cases/documents/<int:document_id>", methods=["DELETE"])
@role_required(["staff"])
def delete_case_document(document_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        document = (
            db.query(CaseDocument)
            .filter(CaseDocument.id == document_id)
            .first()
        )

        if not document:
            return error_response("Case document not found.", status_code=404)

        file_path = document.uploaded_file_path

        old_values = {
            "document_type": document.document_type,
            "uploaded_file_name": document.uploaded_file_name,
            "document_status": document.document_status,
        }

        db.query(IntakeComplianceItem).filter(
            IntakeComplianceItem.related_document_id == document.id,
            IntakeComplianceItem.case_id == document.case_id,
        ).delete(synchronize_session=False)

        log_staff_action(
            db,
            user_id=current_user.user_id,
            action="official_document_deleted",
            entity_type="case_document",
            entity_id=document.id,
            case_id=document.case_id,
            document_id=document.id,
            old_values=old_values,
        )

        db.delete(document)
        db.commit()

        safe_remove_file(file_path)

        return success_response(
            "Case document deleted successfully.",
            data={"document_id": document_id},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_case_document failed")
        return error_response(
            "Failed to delete case document.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

# -----------------------------
# Official Case Tracker Routes
# -----------------------------
@staff_bp.route("/cases/<int:case_id>/document-trackers", methods=["POST"])
@role_required(["staff"])
def create_case_document_tracker(case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Official case not found.", status_code=404)

        payload = request.get_json(silent=True) or {}
        document_type = normalize_document_type_name(payload.get("document_type"))
        if not document_type:
            return error_response("document_type is required.", status_code=400)

        tracker = IntakeDocumentTracker(
            intake_case_id=None,
            case_id=case_id,
            document_type=document_type,
            tracking_type=payload.get("tracking_type") or "expected",
            source_location=payload.get("source_location"),
            office_department=payload.get("office_department"),
            responsible_party=payload.get("responsible_party"),
            status=payload.get("status") or "awaiting",
            created_by=current_user_id,
            updated_by=current_user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(tracker)
        db.commit()
        db.refresh(tracker)

        return success_response(
            "Document tracker added.",
            data={"document_tracker": serialize_document_tracker(tracker)},
            status_code=201
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("create_case_document_tracker failed")
        return error_response("Failed to create document tracker.", errors=[str(e)], status_code=500)
    finally:
        db.close()

@staff_bp.route("/cases/<int:case_id>", methods=["PATCH"])
@role_required(["staff"])
def update_case(case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Case not found.", status_code=404)

        old_values = {
            "case_title": case_obj.case_title,
            "offense_or_violation": case_obj.offense_or_violation,
            "case_status": case_obj.case_status,
            "court_result": case_obj.court_result,
            "prosecution_result": case_obj.prosecution_result,
            "custody_result": case_obj.custody_result,
            "court_branch": case_obj.court_branch,
            "filing_date": case_obj.filing_date.isoformat() if case_obj.filing_date else None,
            "filed_in_court_date": case_obj.filed_in_court_date.isoformat() if case_obj.filed_in_court_date else None,
            "resolution_date": case_obj.resolution_date.isoformat() if case_obj.resolution_date else None,
            "assigned_prosecutor_id": case_obj.assigned_prosecutor_id,
        }

        payload = request.get_json(silent=True) or {}

        if "case_title" in payload:
            case_obj.case_title = (payload.get("case_title") or "").strip() or case_obj.case_title

        if "offense_or_violation" in payload:
            case_obj.offense_or_violation = (payload.get("offense_or_violation") or "").strip() or None

        if "case_status" in payload:
            raw_case_status = payload.get("case_status")
            if raw_case_status:
                valid_case_status, normalized_case_status = validate_official_case_status(raw_case_status)
                if not valid_case_status:
                    return error_response(
                        "Invalid case_status.",
                        errors=[normalized_case_status],
                        status_code=400,
                    )
                case_obj.case_status = normalized_case_status

        if "court_result" in payload:
            raw_court_result = payload.get("court_result")
            if raw_court_result:
                valid_court_result, normalized_court_result = validate_court_result(raw_court_result)
                if not valid_court_result:
                    return error_response(
                        "Invalid court_result.",
                        errors=[normalized_court_result],
                        status_code=400,
                    )
                case_obj.court_result = normalized_court_result
            else:
                case_obj.court_result = "none"

        if "prosecution_result" in payload:
            case_obj.prosecution_result = payload.get("prosecution_result")

        if "custody_result" in payload:
            case_obj.custody_result = payload.get("custody_result") or "none"

        if "court_branch" in payload:
            case_obj.court_branch = (payload.get("court_branch") or "").strip() or None

        if "filing_date" in payload:
            parsed_filing_date = parse_optional_datetime(payload.get("filing_date"))
            if payload.get("filing_date") and not parsed_filing_date:
                return error_response(
                    "Invalid filing_date format.",
                    errors=["Use YYYY-MM-DD or ISO datetime format."],
                    status_code=400,
                )
            case_obj.filing_date = parsed_filing_date

        if "filed_in_court_date" in payload:
            parsed_filed_in_court_date = parse_optional_datetime(payload.get("filed_in_court_date"))
            if payload.get("filed_in_court_date") and not parsed_filed_in_court_date:
                return error_response(
                    "Invalid filed_in_court_date format.",
                    errors=["Use YYYY-MM-DD or ISO datetime format."],
                    status_code=400,
                )
            case_obj.filed_in_court_date = parsed_filed_in_court_date

        if "resolution_date" in payload:
            parsed_resolution_date = parse_optional_datetime(payload.get("resolution_date"))
            if payload.get("resolution_date") and not parsed_resolution_date:
                return error_response(
                    "Invalid resolution_date format.",
                    errors=["Use YYYY-MM-DD or ISO datetime format."],
                    status_code=400,
                )
            case_obj.resolution_date = parsed_resolution_date

        resolved_prosecutor_name = None
        if "assigned_prosecutor" in payload or "assigned_prosecutor_id" in payload:
            assigned_prosecutor_id, resolved_prosecutor_name = resolve_assigned_prosecutor(
                db,
                assigned_prosecutor_value=payload.get("assigned_prosecutor"),
                assigned_prosecutor_id=payload.get("assigned_prosecutor_id"),
            )
            case_obj.assigned_prosecutor_id = assigned_prosecutor_id

        # Optional party updates
        if "complainants" in payload or "respondents" in payload:
            complainants = normalize_case_party_names(payload.get("complainants"))
            respondents = normalize_case_party_names(payload.get("respondents"))

            db.query(CaseParty).filter(CaseParty.case_id == case_id).delete(synchronize_session=False)
            create_case_parties(db, case_id, complainants, respondents)

            if not payload.get("case_title"):
                if complainants and respondents:
                    case_obj.case_title = f"{', '.join(complainants)} vs. {', '.join(respondents)}"
                elif complainants:
                    case_obj.case_title = complainants[0]
                elif respondents:
                    case_obj.case_title = respondents[0]

        case_obj.updated_at = datetime.utcnow()

        # Sync summary JSON
        existing_summary = {}
        try:
            existing_summary = json.loads(case_obj.summary) if case_obj.summary else {}
        except Exception:
            existing_summary = {}

        parties = (
            db.query(CaseParty)
            .filter(CaseParty.case_id == case_id)
            .order_by(CaseParty.id.asc())
            .all()
        )

        complainants_list = [
            p.full_name for p in parties if p.party_type == "complainant"
        ]
        respondents_list = [
            p.full_name for p in parties if p.party_type == "respondent"
        ]

        if resolved_prosecutor_name is None and case_obj.assigned_prosecutor_id:
            prosecutor = (
                db.query(User)
                .filter(User.user_id == case_obj.assigned_prosecutor_id)
                .first()
            )
            if prosecutor:
                resolved_prosecutor_name = f"{prosecutor.first_name} {prosecutor.last_name}".strip()

        existing_summary.update({
            "case_number": case_obj.case_number,
            "docket_number": case_obj.docket_number,
            "case_title": case_obj.case_title,
            "offense_or_violation": case_obj.offense_or_violation,
            "case_type": case_obj.case_type,
            "complainants": complainants_list,
            "respondents": respondents_list,
            "assigned_prosecutor": resolved_prosecutor_name or existing_summary.get("assigned_prosecutor"),
            "assigned_prosecutor_id": case_obj.assigned_prosecutor_id,
            "filing_date": case_obj.filing_date.isoformat() if case_obj.filing_date else None,
            "resolution_date": case_obj.resolution_date.isoformat() if case_obj.resolution_date else None,
            "filed_in_court_date": case_obj.filed_in_court_date.isoformat() if case_obj.filed_in_court_date else None,
            "court_branch": case_obj.court_branch,
            "case_status": case_obj.case_status,
            "prosecution_result": case_obj.prosecution_result,
            "court_result": case_obj.court_result,
            "custody_result": case_obj.custody_result,
            "updated_at": case_obj.updated_at.isoformat(),
        })

        case_obj.summary = json.dumps(existing_summary)

        log_staff_action(
            db,
            user_id=current_user.user_id,
            action="official_case_updated",
            entity_type="case",
            entity_id=case_obj.id,
            case_id=case_obj.id,
            old_values=old_values,
            new_values={
                "case_title": case_obj.case_title,
                "offense_or_violation": case_obj.offense_or_violation,
                "case_status": case_obj.case_status,
                "court_result": case_obj.court_result,
                "prosecution_result": case_obj.prosecution_result,
                "custody_result": case_obj.custody_result,
                "court_branch": case_obj.court_branch,
                "filing_date": case_obj.filing_date.isoformat() if case_obj.filing_date else None,
                "filed_in_court_date": case_obj.filed_in_court_date.isoformat() if case_obj.filed_in_court_date else None,
                "resolution_date": case_obj.resolution_date.isoformat() if case_obj.resolution_date else None,
                "assigned_prosecutor_id": case_obj.assigned_prosecutor_id,
            },
        )

        db.commit()
        db.refresh(case_obj)

        parties = (
            db.query(CaseParty)
            .filter(CaseParty.case_id == case_id)
            .order_by(CaseParty.id.asc())
            .all()
        )

        documents = (
            db.query(CaseDocument)
            .filter(CaseDocument.case_id == case_id)
            .order_by(CaseDocument.created_at.asc())
            .all()
        )

        return success_response(
            "Case updated successfully.",
            data={"case": serialize_case(case_obj, parties=parties, documents=documents)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("update_case failed")
        return error_response(
            "Failed to update case.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

# -----------------------------
# Official Case Compliance Routes
# -----------------------------
@staff_bp.route("/cases/<int:case_id>/compliance-items", methods=["POST"])
@role_required(["staff"])
def create_case_compliance_item(case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Official case not found.", status_code=404)

        payload = request.get_json(silent=True) or {}
        title = (payload.get("title") or "").strip()
        compliance_type = (payload.get("compliance_type") or "").strip()
        if not title or not compliance_type:
            return error_response("title and compliance_type are required.", status_code=400)

        item = IntakeComplianceItem(
            intake_case_id=None,
            case_id=case_id,
            related_document_id=payload.get("related_document_id"),
            compliance_type=compliance_type,
            title=title,
            description=payload.get("description"),
            issued_date=parse_optional_datetime(payload.get("issued_date")),
            due_date=parse_optional_datetime(payload.get("due_date")),
            days_to_comply=payload.get("days_to_comply"),
            compliance_status=payload.get("compliance_status") or "pending",
            responsible_party=payload.get("responsible_party"),
            remarks=payload.get("remarks"),
            created_by=current_user_id,
            updated_by=current_user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        return success_response(
            "Compliance item added.",
            data={"compliance_item": serialize_compliance_item(item)},
            status_code=201
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("create_case_compliance_item failed")
        return error_response("Failed to create compliance item.", errors=[str(e)], status_code=500)
    finally:
        db.close()


@staff_bp.route("/cases/<int:case_id>/document-trackers", methods=["GET"])
@role_required(["staff"])
def get_case_document_trackers(case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Official case not found.", status_code=404)

        items = (
            db.query(IntakeDocumentTracker)
            .filter(IntakeDocumentTracker.case_id == case_id)
            .order_by(IntakeDocumentTracker.created_at.asc())
            .all()
        )

        return success_response(
            "Case document trackers retrieved successfully.",
            data={
                "document_trackers": [serialize_document_tracker(item) for item in items]
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_case_document_trackers failed")
        return error_response(
            "Failed to fetch case document trackers.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/case-options", methods=["GET"])
@role_required(["staff"])
def get_case_options():
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        return success_response(
            "Case options retrieved successfully.",
            data={
                "case_types": sorted(list(ALLOWED_CASE_TYPES)),
                "official_case_statuses": sorted(list(OFFICIAL_CASE_STATUSES)),
                "official_case_document_types": sorted(list(OFFICIAL_CASE_DOCUMENT_TYPES)),
                "court_result_values": sorted(list(COURT_RESULT_VALUES)),
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_case_options failed")
        return error_response(
            "Failed to fetch case options.",
            errors=[str(e)],
            status_code=500,
        )

@staff_bp.route("/cases/<int:case_id>/document-trackers/<int:tracker_id>", methods=["PATCH"])
@role_required(["staff"])
def update_case_document_tracker(case_id, tracker_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        item = (
            db.query(IntakeDocumentTracker)
            .filter(
                IntakeDocumentTracker.id == tracker_id,
                IntakeDocumentTracker.case_id == case_id,
            )
            .first()
        )

        if not item:
            return error_response("Document tracker not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        if "tracking_type" in payload:
            item.tracking_type = payload.get("tracking_type") or item.tracking_type
        if "source_location" in payload:
            item.source_location = payload.get("source_location")
        if "office_department" in payload:
            item.office_department = payload.get("office_department")
        if "responsible_party" in payload:
            item.responsible_party = payload.get("responsible_party")
        if "requested_date" in payload:
            item.requested_date = parse_optional_datetime(payload.get("requested_date"))
        if "expected_date" in payload:
            item.expected_date = parse_optional_datetime(payload.get("expected_date"))
        if "due_date" in payload:
            item.due_date = parse_optional_datetime(payload.get("due_date"))
        if "received_date" in payload:
            item.received_date = parse_optional_datetime(payload.get("received_date"))
        if "status" in payload:
            item.status = payload.get("status") or item.status
        if "remarks" in payload:
            item.remarks = payload.get("remarks")

        item.updated_by = current_user_id

        db.commit()
        db.refresh(item)

        return success_response(
            "Case document tracker updated successfully.",
            data={"document_tracker": serialize_document_tracker(item)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("update_case_document_tracker failed")
        return error_response(
            "Failed to update case document tracker.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/cases/<int:case_id>/document-trackers/<int:tracker_id>", methods=["DELETE"])
@role_required(["staff"])
def delete_case_document_tracker(case_id, tracker_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        tracker = (
            db.query(IntakeDocumentTracker)
            .filter(
                IntakeDocumentTracker.id == tracker_id,
                IntakeDocumentTracker.case_id == case_id,
            )
            .first()
        )

        if not tracker:
            return error_response("Document tracker not found.", status_code=404)

        db.delete(tracker)
        db.commit()

        return success_response(
            "Case document tracker deleted successfully.",
            data={"tracker_id": tracker_id},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_case_document_tracker failed")
        return error_response(
            "Failed to delete case document tracker.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()



@staff_bp.route("/cases/<int:case_id>/compliance-items/<int:compliance_id>", methods=["PATCH"])
@role_required(["staff"])
def update_case_compliance_item(case_id, compliance_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        item = (
            db.query(IntakeComplianceItem)
            .filter(
                IntakeComplianceItem.id == compliance_id,
                IntakeComplianceItem.case_id == case_id,
            )
            .first()
        )

        if not item:
            return error_response("Compliance item not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        if "title" in payload:
            item.title = payload.get("title") or item.title
        if "description" in payload:
            item.description = payload.get("description")
        if "issued_date" in payload:
            item.issued_date = parse_optional_datetime(payload.get("issued_date"))
        if "due_date" in payload:
            item.due_date = parse_optional_datetime(payload.get("due_date"))
        if "days_to_comply" in payload:
            item.days_to_comply = payload.get("days_to_comply")
        if "complied_date" in payload:
            item.complied_date = parse_optional_datetime(payload.get("complied_date"))
        if "compliance_status" in payload:
            item.compliance_status = payload.get("compliance_status") or item.compliance_status
        if "responsible_party" in payload:
            item.responsible_party = payload.get("responsible_party")
        if "remarks" in payload:
            item.remarks = payload.get("remarks")

        item.updated_by = current_user_id

        db.commit()
        db.refresh(item)

        return success_response(
            "Case compliance item updated successfully.",
            data={"compliance_item": serialize_compliance_item(item)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("update_case_compliance_item failed")
        return error_response(
            "Failed to update case compliance item.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/cases/<int:case_id>/compliance-items/<int:compliance_id>", methods=["DELETE"])
@role_required(["staff"])
def delete_case_compliance_item(case_id, compliance_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        item = (
            db.query(IntakeComplianceItem)
            .filter(
                IntakeComplianceItem.id == compliance_id,
                IntakeComplianceItem.case_id == case_id,
            )
            .first()
        )

        if not item:
            return error_response("Compliance item not found.", status_code=404)

        db.delete(item)
        db.commit()

        return success_response(
            "Case compliance item deleted successfully.",
            data={"compliance_id": compliance_id},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_case_compliance_item failed")
        return error_response(
            "Failed to delete case compliance item.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/cases/<int:case_id>/compliance-items", methods=["GET"])
@role_required(["staff"])
def get_case_compliance_items(case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Official case not found.", status_code=404)

        items = (
            db.query(IntakeComplianceItem)
            .filter(IntakeComplianceItem.case_id == case_id)
            .order_by(IntakeComplianceItem.created_at.asc())
            .all()
        )

        return success_response(
            "Case compliance items retrieved successfully.",
            data={
                "compliance_items": [serialize_compliance_item(item) for item in items]
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_case_compliance_items failed")
        return error_response(
            "Failed to fetch case compliance items.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/dashboard/summary", methods=["GET"])
@role_required(["staff"])
def get_staff_dashboard_summary():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        intake_cases = db.query(IntakeCase).all()
        official_cases = (
            db.query(Case)
            .filter(Case.case_origin == "intake_case")
            .all()
        )
        legacy_cases = (
            db.query(Case)
            .filter(Case.case_origin == "legacy_encoding")
            .all()
        )

        all_cases = db.query(Case).all()

        offense_chart_data = get_dashboard_offense_chart_data(
            db=db,
            intake_cases=intake_cases,
            official_cases=official_cases,
            legacy_cases=legacy_cases,
            limit=20,
        )

        intake_trackers = (
            db.query(IntakeDocumentTracker)
            .filter(IntakeDocumentTracker.intake_case_id.isnot(None))
            .all()
        )
        official_trackers = (
            db.query(IntakeDocumentTracker)
            .filter(IntakeDocumentTracker.case_id.isnot(None))
            .all()
        )

        intake_compliance_items = (
            db.query(IntakeComplianceItem)
            .filter(IntakeComplianceItem.intake_case_id.isnot(None))
            .all()
        )
        official_compliance_items = (
            db.query(IntakeComplianceItem)
            .filter(IntakeComplianceItem.case_id.isnot(None))
            .all()
        )

        intake_status_counts = count_by_intake_status(intake_cases)
        official_case_status_counts = count_by_case_status(official_cases)
        legacy_case_status_counts = count_by_case_status(legacy_cases)
        all_case_status_counts = count_by_case_status(all_cases)

        intake_tracker_counts = count_by_document_tracker_status(intake_trackers)
        official_tracker_counts = count_by_document_tracker_status(official_trackers)

        intake_compliance_counts = count_by_compliance_status(intake_compliance_items)
        official_compliance_counts = count_by_compliance_status(official_compliance_items)

        intake_due_summary = count_due_compliance_items(intake_compliance_items)
        official_due_summary = count_due_compliance_items(official_compliance_items)

        return success_response(
            "Dashboard summary retrieved successfully.",
            data={
                "intake": {
                    "total": len(intake_cases),
                    "draft": intake_status_counts.get("draft", 0),
                    "needs_review": intake_status_counts.get("needs_review", 0),
                    "for_confirmation": intake_status_counts.get("for_confirmation", 0),
                    "active": intake_status_counts.get("active", 0),
                    "awaiting_compliance": intake_status_counts.get("awaiting_compliance", 0),
                    "under_prosecutor_review": intake_status_counts.get("under_prosecutor_review", 0),
                    "resolved_dismissed": intake_status_counts.get("resolved_dismissed", 0),
                    "resolved_for_filing": intake_status_counts.get("resolved_for_filing", 0),
                    "information_filed": intake_status_counts.get("information_filed", 0),
                    "ready_for_conversion": intake_status_counts.get("ready_for_conversion", 0),
                    "converted": intake_status_counts.get("converted", 0),
                    "status_counts": intake_status_counts,
                },
                "official_cases": {
                    "total": len(official_cases),
                    "filed_in_court": official_case_status_counts.get("filed_in_court", 0),
                    "for_arraignment": official_case_status_counts.get("for_arraignment", 0),
                    "for_pre_trial": official_case_status_counts.get("for_pre_trial", 0),
                    "for_trial": official_case_status_counts.get("for_trial", 0),
                    "for_decision": official_case_status_counts.get("for_decision", 0),
                    "decided": official_case_status_counts.get("decided", 0),
                    "dismissed_by_court": official_case_status_counts.get("dismissed_by_court", 0),
                    "archived": official_case_status_counts.get("archived", 0),
                    "closed": official_case_status_counts.get("closed", 0),
                    "status_counts": official_case_status_counts,
                },
                "legacy_cases": {
                    "total": len(legacy_cases),
                    "filed_in_court": legacy_case_status_counts.get("filed_in_court", 0),
                    "for_arraignment": legacy_case_status_counts.get("for_arraignment", 0),
                    "for_pre_trial": legacy_case_status_counts.get("for_pre_trial", 0),
                    "for_trial": legacy_case_status_counts.get("for_trial", 0),
                    "for_decision": legacy_case_status_counts.get("for_decision", 0),
                    "decided": legacy_case_status_counts.get("decided", 0),
                    "dismissed_by_court": legacy_case_status_counts.get("dismissed_by_court", 0),
                    "archived": legacy_case_status_counts.get("archived", 0),
                    "closed": legacy_case_status_counts.get("closed", 0),
                    "status_counts": legacy_case_status_counts,
                },
                "all_cases": {
                    "total": len(all_cases),
                    "status_counts": all_case_status_counts,
                },
                "offenses": offense_chart_data,
                "document_trackers": {
                    "intake": {
                        "total": len(intake_trackers),
                        "status_counts": intake_tracker_counts,
                    },
                    "official": {
                        "total": len(official_trackers),
                        "status_counts": official_tracker_counts,
                    },
                },
                "compliance": {
                    "intake": {
                        "total": len(intake_compliance_items),
                        "status_counts": intake_compliance_counts,
                        "timeline": intake_due_summary,
                    },
                    "official": {
                        "total": len(official_compliance_items),
                        "status_counts": official_compliance_counts,
                        "timeline": official_due_summary,
                    },
                },
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_staff_dashboard_summary failed")
        return error_response(
            "Failed to fetch dashboard summary.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()
        
@staff_bp.route("/dashboard/recent-activity", methods=["GET"])
@role_required(["staff"])
def get_staff_dashboard_recent_activity():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        try:
            limit = int(request.args.get("limit", 5))
        except ValueError:
            limit = 5

        if limit < 1:
            limit = 5
        elif limit > 20:
            limit = 20

        recent_intake_cases = (
            db.query(IntakeCase)
            .order_by(IntakeCase.updated_at.desc(), IntakeCase.created_at.desc())
            .limit(limit)
            .all()
        )

        recent_official_cases = (
            db.query(Case)
            .filter(Case.case_origin == "intake_case")
            .order_by(Case.updated_at.desc(), Case.created_at.desc())
            .limit(limit)
            .all()
        )

        recent_legacy_cases = (
            db.query(Case)
            .filter(Case.case_origin == "legacy_encoding")
            .order_by(Case.updated_at.desc(), Case.created_at.desc())
            .limit(limit)
            .all()
        )

        recent_trackers = (
            db.query(IntakeDocumentTracker)
            .order_by(IntakeDocumentTracker.updated_at.desc(), IntakeDocumentTracker.created_at.desc())
            .limit(limit)
            .all()
        )

        recent_compliance_items = (
            db.query(IntakeComplianceItem)
            .order_by(IntakeComplianceItem.updated_at.desc(), IntakeComplianceItem.created_at.desc())
            .limit(limit)
            .all()
        )

        overdue_compliance_items = (
            db.query(IntakeComplianceItem)
            .filter(
                IntakeComplianceItem.compliance_status == "pending",
                IntakeComplianceItem.due_date.isnot(None),
                IntakeComplianceItem.due_date < datetime.utcnow(),
            )
            .order_by(IntakeComplianceItem.due_date.asc(), IntakeComplianceItem.created_at.asc())
            .limit(limit)
            .all()
        )

        due_today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        due_today_end = due_today_start + timedelta(days=1)

        due_today_compliance_items = (
            db.query(IntakeComplianceItem)
            .filter(
                IntakeComplianceItem.compliance_status == "pending",
                IntakeComplianceItem.due_date.isnot(None),
                IntakeComplianceItem.due_date >= due_today_start,
                IntakeComplianceItem.due_date < due_today_end,
            )
            .order_by(IntakeComplianceItem.due_date.asc(), IntakeComplianceItem.created_at.asc())
            .limit(limit)
            .all()
        )

        return success_response(
            "Recent dashboard activity retrieved successfully.",
            data={
                "limit": limit,
                "recent_intake_cases": [
                    serialize_dashboard_intake_row(db, row) for row in recent_intake_cases
                ],
                "recent_official_cases": [
                    serialize_dashboard_case_row(row) for row in recent_official_cases
                ],
                "recent_legacy_cases": [
                    serialize_dashboard_case_row(row) for row in recent_legacy_cases
                ],
                "recent_document_trackers": [
                    serialize_dashboard_tracker_row(row) for row in recent_trackers
                ],
                "recent_compliance_items": [
                    serialize_dashboard_compliance_row(row) for row in recent_compliance_items
                ],
                "overdue_compliance_items": [
                    serialize_dashboard_compliance_row(row) for row in overdue_compliance_items
                ],
                "due_today_compliance_items": [
                    serialize_dashboard_compliance_row(row) for row in due_today_compliance_items
                ],
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_staff_dashboard_recent_activity failed")
        return error_response(
            "Failed to fetch recent dashboard activity.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/dashboard/cards", methods=["GET"])
@role_required(["staff"])
def get_staff_dashboard_cards():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        intake_cases = db.query(IntakeCase).all()
        all_cases = db.query(Case).all()
        legacy_cases = db.query(Case).filter(Case.case_origin == "legacy_encoding").all()

        intake_status_counts = count_by_intake_status(intake_cases)
        all_case_status_counts = count_by_case_status(all_cases)

        intake_compliance_items = (
            db.query(IntakeComplianceItem)
            .filter(IntakeComplianceItem.intake_case_id.isnot(None))
            .all()
        )
        official_compliance_items = (
            db.query(IntakeComplianceItem)
            .filter(IntakeComplianceItem.case_id.isnot(None))
            .all()
        )

        intake_due_summary = count_due_compliance_items(intake_compliance_items)
        official_due_summary = count_due_compliance_items(official_compliance_items)

        return success_response(
            "Dashboard cards retrieved successfully.",
            data={
                "cards": {
                    "intake_for_review": intake_status_counts.get("needs_review", 0),
                    "intake_for_confirmation": intake_status_counts.get("for_confirmation", 0),
                    "intake_ready_for_conversion": intake_status_counts.get("ready_for_conversion", 0),
                    "official_active_total": len(all_cases),
                    "legacy_total": len(legacy_cases),
                    "official_archived": all_case_status_counts.get("archived", 0),
                    "official_decided": all_case_status_counts.get("decided", 0),
                    "intake_overdue_compliance": intake_due_summary.get("overdue", 0),
                    "official_overdue_compliance": official_due_summary.get("overdue", 0),
                    "intake_due_today": intake_due_summary.get("due_today", 0),
                    "official_due_today": official_due_summary.get("due_today", 0),
                }
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_staff_dashboard_cards failed")
        return error_response(
            "Failed to fetch dashboard cards.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()



#LEGACY CASES
@staff_bp.route("/legacy-cases", methods=["POST"])
@role_required(["staff"])
def create_legacy_case():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)
        current_user_id = current_user.user_id

        payload = request.get_json(silent=True) or {}

        case_type = (payload.get("case_type") or "").upper().strip()
        case_number = (payload.get("case_number") or "").strip() or None
        docket_number = (payload.get("docket_number") or "").strip() or None
        case_title = (payload.get("case_title") or "").strip() or None
        offense_or_violation = (payload.get("offense_or_violation") or "").strip() or None
        court_branch = (payload.get("court_branch") or "").strip() or None
        remarks = (payload.get("remarks") or "").strip() or None

        complainants = normalize_case_party_names(payload.get("complainants"))
        respondents = normalize_case_party_names(payload.get("respondents"))

        if case_type not in ALLOWED_CASE_TYPES:
            return error_response(
                "Invalid case_type.",
                errors=["Allowed values: INV or INQ"],
                status_code=400,
            )

        if not case_number and not docket_number and not case_title:
            return error_response(
                "Missing required case reference.",
                errors=["Provide at least one of: case_number, docket_number, or case_title."],
                status_code=400,
            )

        if not complainants and not respondents:
            return error_response(
                "Missing case parties.",
                errors=["Provide at least one complainant or respondent."],
                status_code=400,
            )

        if case_number:
            existing_case_number = (
                db.query(Case)
                .filter(func.lower(Case.case_number) == case_number.lower())
                .first()
            )
            if existing_case_number:
                return error_response(
                    "Case number already exists.",
                    errors=[f"Existing case_id={existing_case_number.id}"],
                    status_code=400,
                )

        if docket_number:
            existing_docket_number = (
                db.query(Case)
                .filter(func.lower(Case.docket_number) == docket_number.lower())
                .first()
            )
            if existing_docket_number:
                return error_response(
                    "Docket number already exists.",
                    errors=[f"Existing case_id={existing_docket_number.id}"],
                    status_code=400,
                )

        filing_date = parse_optional_datetime(payload.get("filing_date"))
        resolution_date = parse_optional_datetime(payload.get("resolution_date"))
        filed_in_court_date = parse_optional_datetime(payload.get("filed_in_court_date"))

        if payload.get("filing_date") and not filing_date:
            return error_response(
                "Invalid filing_date format.",
                errors=["Use YYYY-MM-DD or ISO datetime format."],
                status_code=400,
            )

        if payload.get("resolution_date") and not resolution_date:
            return error_response(
                "Invalid resolution_date format.",
                errors=["Use YYYY-MM-DD or ISO datetime format."],
                status_code=400,
            )

        if payload.get("filed_in_court_date") and not filed_in_court_date:
            return error_response(
                "Invalid filed_in_court_date format.",
                errors=["Use YYYY-MM-DD or ISO datetime format."],
                status_code=400,
            )

        resolved_prosecutor_id, resolved_prosecutor_name = resolve_assigned_prosecutor(
            db,
            assigned_prosecutor_value=payload.get("assigned_prosecutor"),
            assigned_prosecutor_id=payload.get("assigned_prosecutor_id"),
        )

        if not case_title:
            if complainants and respondents:
                case_title = f"{', '.join(complainants)} vs. {', '.join(respondents)}"
            elif complainants:
                case_title = complainants[0]
            elif respondents:
                case_title = respondents[0]
            else:
                case_title = f"Legacy {case_type} Case"

        raw_case_status = payload.get("case_status") or "filed_in_court"
        valid_case_status, normalized_case_status = validate_official_case_status(raw_case_status)
        if not valid_case_status:
            return error_response(
                "Invalid case_status.",
                errors=[normalized_case_status],
                status_code=400,
            )

        raw_court_result = payload.get("court_result") or "none"
        valid_court_result, normalized_court_result = validate_court_result(raw_court_result)
        if not valid_court_result:
            return error_response(
                "Invalid court_result.",
                errors=[normalized_court_result],
                status_code=400,
            )

        prosecution_result = payload.get("prosecution_result")
        custody_result = payload.get("custody_result") or "none"

        summary_payload = {
            "source": "legacy_encoding",
            "legacy_notes": remarks,
            "encoded_at": datetime.utcnow().isoformat(),
            "case_type": case_type,
            "case_number": case_number,
            "docket_number": docket_number,
            "case_title": case_title,
            "complainants": complainants,
            "respondents": respondents,
            "offense_or_violation": offense_or_violation,
            "assigned_prosecutor": resolved_prosecutor_name,
            "assigned_prosecutor_id": resolved_prosecutor_id,
            "filing_date": filing_date.isoformat() if filing_date else None,
            "resolution_date": resolution_date.isoformat() if resolution_date else None,
            "filed_in_court_date": filed_in_court_date.isoformat() if filed_in_court_date else None,
            "court_branch": court_branch,
            "case_status": normalized_case_status,
            "prosecution_result": prosecution_result,
            "court_result": normalized_court_result,
            "custody_result": custody_result,
            "remarks": remarks,
        }

        new_case = Case(
            case_number=case_number,
            docket_number=docket_number,
            case_title=case_title,
            offense_or_violation=offense_or_violation,
            case_type=case_type,
            filing_date=filing_date,
            assigned_prosecutor_id=resolved_prosecutor_id,
            created_by=current_user_id,
            case_origin="legacy_encoding",
            intake_status=None,
            case_status=normalized_case_status,
            prosecution_result=prosecution_result,
            court_result=normalized_court_result,
            custody_result=custody_result,
            summary=json.dumps(summary_payload),
            resolution_date=resolution_date,
            filed_in_court_date=filed_in_court_date,
            court_branch=court_branch,
            source_intake_case_id=None,
            latest_document_type=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(new_case)
        db.commit()
        db.refresh(new_case)

        log_staff_action(
            db,
            user_id=current_user_id,
            action="legacy_case_created",
            entity_type="legacy_case",
            entity_id=new_case.id,
            case_id=new_case.id,
            new_values={
                "case_number": new_case.case_number,
                "docket_number": new_case.docket_number,
                "case_title": new_case.case_title,
                "case_type": new_case.case_type,
                "case_status": new_case.case_status,
                "court_result": new_case.court_result,
            },
        )
        db.commit()

        create_case_parties(
            db,
            new_case.id,
            complainants,
            respondents,
        )
        db.commit()

        parties = (
            db.query(CaseParty)
            .filter(CaseParty.case_id == new_case.id)
            .order_by(CaseParty.id.asc())
            .all()
        )

        return success_response(
            "Legacy case encoded successfully.",
            data={
                "case": serialize_case(new_case, parties=parties)
            },
            status_code=201,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("create_legacy_case failed")
        return error_response(
            "Failed to encode legacy case.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/legacy-cases", methods=["GET"])
@role_required(["staff"])
def list_legacy_cases():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        search = (request.args.get("search") or "").strip()
        case_type = (request.args.get("case_type") or "").upper().strip()
        case_status = (request.args.get("case_status") or "").strip()
        prosecution_result = (request.args.get("prosecution_result") or "").strip()
        court_result = (request.args.get("court_result") or "").strip()
        assigned_prosecutor_id = (request.args.get("assigned_prosecutor_id") or "").strip()
        sort_by = (request.args.get("sort_by") or "created_at").strip()
        sort_dir = normalize_sort_direction(request.args.get("sort_dir"), default="desc")
        page, per_page = parse_pagination_params()

        query = db.query(Case).filter(Case.case_origin == "legacy_encoding")

        if case_type in ALLOWED_CASE_TYPES:
            query = query.filter(Case.case_type == case_type)

        if case_status:
            query = query.filter(Case.case_status == case_status)

        if prosecution_result:
            query = query.filter(Case.prosecution_result == prosecution_result)

        if court_result:
            query = query.filter(Case.court_result == court_result)

        if assigned_prosecutor_id:
            try:
                query = query.filter(Case.assigned_prosecutor_id == int(assigned_prosecutor_id))
            except ValueError:
                return error_response(
                    "Invalid assigned_prosecutor_id.",
                    errors=["assigned_prosecutor_id must be an integer."],
                    status_code=400,
                )

        if search:
            like_term = f"%{search}%"
            query = query.filter(
                (Case.case_number.ilike(like_term)) |
                (Case.docket_number.ilike(like_term)) |
                (Case.case_title.ilike(like_term)) |
                (Case.offense_or_violation.ilike(like_term)) |
                (Case.court_branch.ilike(like_term))
            )

        allowed_sort_fields = {
            "created_at": Case.created_at,
            "updated_at": Case.updated_at,
            "case_number": Case.case_number,
            "docket_number": Case.docket_number,
            "case_title": Case.case_title,
            "case_type": Case.case_type,
            "filing_date": Case.filing_date,
            "case_status": Case.case_status,
            "prosecution_result": Case.prosecution_result,
            "court_result": Case.court_result,
            "filed_in_court_date": Case.filed_in_court_date,
            "resolution_date": Case.resolution_date,
        }

        if sort_by not in allowed_sort_fields:
            return error_response(
                "Invalid sort_by value.",
                errors=[f"Allowed values: {', '.join(sorted(allowed_sort_fields.keys()))}"],
                status_code=400,
            )

        sort_column = allowed_sort_fields[sort_by]
        query = query.order_by(sort_column.asc() if sort_dir == "asc" else sort_column.desc())

        all_cases = query.all()
        paginated = paginate_list(all_cases, page, per_page)

        return success_response(
            "Legacy cases retrieved successfully.",
            data={
                "filters": {
                    "search": search or None,
                    "case_type": case_type or None,
                    "case_status": case_status or None,
                    "prosecution_result": prosecution_result or None,
                    "court_result": court_result or None,
                    "assigned_prosecutor_id": assigned_prosecutor_id or None,
                    "sort_by": sort_by,
                    "sort_dir": sort_dir,
                },
                "pagination": paginated["pagination"],
                "count": len(all_cases),
                "cases": [serialize_case(row) for row in paginated["items"]],
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("list_legacy_cases failed")
        return error_response(
            "Failed to fetch legacy cases.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/legacy-cases/<int:case_id>", methods=["GET"])
@role_required(["staff"])
def get_legacy_case(case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = (
            db.query(Case)
            .filter(
                Case.id == case_id,
                Case.case_origin == "legacy_encoding",
            )
            .first()
        )

        if not case_obj:
            return error_response("Legacy case not found.", status_code=404)

        parties = (
            db.query(CaseParty)
            .filter(CaseParty.case_id == case_id)
            .order_by(CaseParty.id.asc())
            .all()
        )

        documents = (
            db.query(CaseDocument)
            .filter(CaseDocument.case_id == case_id)
            .order_by(CaseDocument.created_at.asc())
            .all()
        )

        trackers = (
            db.query(IntakeDocumentTracker)
            .filter(IntakeDocumentTracker.case_id == case_id)
            .order_by(IntakeDocumentTracker.created_at.asc())
            .all()
        )

        compliance_items = (
            db.query(IntakeComplianceItem)
            .filter(IntakeComplianceItem.case_id == case_id)
            .order_by(IntakeComplianceItem.created_at.asc())
            .all()
        )

        return success_response(
            "Legacy case retrieved successfully.",
            data={
                "case": serialize_case(case_obj, parties=parties, documents=documents),
                "document_trackers": [serialize_document_tracker(item) for item in trackers],
                "compliance_items": [serialize_compliance_item(item) for item in compliance_items],
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_legacy_case failed")
        return error_response(
            "Failed to fetch legacy case.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/legacy-cases/<int:case_id>", methods=["PATCH"])
@role_required(["staff"])
def update_legacy_case(case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        current_user_id = current_user.user_id

        case_obj = (
            db.query(Case)
            .filter(
                Case.id == case_id,
                Case.case_origin == "legacy_encoding",
            )
            .first()
        )

        if not case_obj:
            return error_response("Legacy case not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        if "case_title" in payload:
            case_obj.case_title = payload.get("case_title") or case_obj.case_title

        if "offense_or_violation" in payload:
            case_obj.offense_or_violation = payload.get("offense_or_violation")

        if "case_status" in payload:
            valid_case_status, normalized_case_status = validate_official_case_status(payload.get("case_status"))
            if not valid_case_status:
                return error_response(
                    "Invalid case_status.",
                    errors=[normalized_case_status],
                    status_code=400,
                )
            case_obj.case_status = normalized_case_status

        if "court_result" in payload:
            valid_court_result, normalized_court_result = validate_court_result(payload.get("court_result"))
            if not valid_court_result:
                return error_response(
                    "Invalid court_result.",
                    errors=[normalized_court_result],
                    status_code=400,
                )
            case_obj.court_result = normalized_court_result

        if "prosecution_result" in payload:
            case_obj.prosecution_result = payload.get("prosecution_result")

        if "court_branch" in payload:
            case_obj.court_branch = payload.get("court_branch")

        if "filed_in_court_date" in payload:
            parsed = parse_optional_datetime(payload.get("filed_in_court_date"))
            if payload.get("filed_in_court_date") and not parsed:
                return error_response(
                    "Invalid filed_in_court_date format.",
                    errors=["Use YYYY-MM-DD or ISO datetime format."],
                    status_code=400,
                )
            case_obj.filed_in_court_date = parsed

        if "resolution_date" in payload:
            parsed = parse_optional_datetime(payload.get("resolution_date"))
            if payload.get("resolution_date") and not parsed:
                return error_response(
                    "Invalid resolution_date format.",
                    errors=["Use YYYY-MM-DD or ISO datetime format."],
                    status_code=400,
                )
            case_obj.resolution_date = parsed

        if "filing_date" in payload:
            parsed = parse_optional_datetime(payload.get("filing_date"))
            if payload.get("filing_date") and not parsed:
                return error_response(
                    "Invalid filing_date format.",
                    errors=["Use YYYY-MM-DD or ISO datetime format."],
                    status_code=400,
                )
            case_obj.filing_date = parsed

        if "assigned_prosecutor" in payload or "assigned_prosecutor_id" in payload:
            assigned_prosecutor_id, _assigned_name = resolve_assigned_prosecutor(
                db,
                assigned_prosecutor_value=payload.get("assigned_prosecutor"),
                assigned_prosecutor_id=payload.get("assigned_prosecutor_id"),
            )
            case_obj.assigned_prosecutor_id = assigned_prosecutor_id

        if "case_number" in payload:
            new_case_number = (payload.get("case_number") or "").strip() or None
            if new_case_number:
                existing_case_number = (
                    db.query(Case)
                    .filter(
                        func.lower(Case.case_number) == new_case_number.lower(),
                        Case.id != case_obj.id,
                    )
                    .first()
                )
                if existing_case_number:
                    return error_response(
                        "Case number already exists.",
                        errors=[f"Existing case_id={existing_case_number.id}"],
                        status_code=400,
                    )
            case_obj.case_number = new_case_number

        if "docket_number" in payload:
            new_docket_number = (payload.get("docket_number") or "").strip() or None
            if new_docket_number:
                existing_docket_number = (
                    db.query(Case)
                    .filter(
                        func.lower(Case.docket_number) == new_docket_number.lower(),
                        Case.id != case_obj.id,
                    )
                    .first()
                )
                if existing_docket_number:
                    return error_response(
                        "Docket number already exists.",
                        errors=[f"Existing case_id={existing_docket_number.id}"],
                        status_code=400,
                    )
            case_obj.docket_number = new_docket_number

        case_obj.updated_at = datetime.utcnow()

        # optional summary sync
        try:
            summary_data = json.loads(case_obj.summary) if case_obj.summary else {}
        except Exception:
            summary_data = {}

        summary_data.update({
            "case_number": case_obj.case_number,
            "docket_number": case_obj.docket_number,
            "case_title": case_obj.case_title,
            "offense_or_violation": case_obj.offense_or_violation,
            "filing_date": case_obj.filing_date.isoformat() if case_obj.filing_date else None,
            "resolution_date": case_obj.resolution_date.isoformat() if case_obj.resolution_date else None,
            "filed_in_court_date": case_obj.filed_in_court_date.isoformat() if case_obj.filed_in_court_date else None,
            "court_branch": case_obj.court_branch,
            "case_status": case_obj.case_status,
            "prosecution_result": case_obj.prosecution_result,
            "court_result": case_obj.court_result,
            "updated_at": case_obj.updated_at.isoformat(),
            "updated_by": current_user_id,
        })
        case_obj.summary = json.dumps(summary_data)

        db.commit()
        db.refresh(case_obj)

        parties = (
            db.query(CaseParty)
            .filter(CaseParty.case_id == case_id)
            .order_by(CaseParty.id.asc())
            .all()
        )

        documents = (
            db.query(CaseDocument)
            .filter(CaseDocument.case_id == case_id)
            .order_by(CaseDocument.created_at.asc())
            .all()
        )

        return success_response(
            "Legacy case updated successfully.",
            data={"case": serialize_case(case_obj, parties=parties, documents=documents)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("update_legacy_case failed")
        return error_response(
            "Failed to update legacy case.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()  

@staff_bp.route("/legacy-cases/<int:case_id>", methods=["DELETE"])
@role_required(["staff"])
def delete_legacy_case(case_id):
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = (
            db.query(Case)
            .filter(
                Case.id == case_id,
                Case.case_origin == "legacy_encoding",
            )
            .first()
        )

        if not case_obj:
            return error_response("Legacy case not found.", status_code=404)

        documents = (
            db.query(CaseDocument)
            .filter(CaseDocument.case_id == case_id)
            .all()
        )

        document_ids = [doc.id for doc in documents]
        file_paths = [doc.uploaded_file_path for doc in documents if doc.uploaded_file_path]

        if document_ids:
            db.query(IntakeComplianceItem).filter(
                IntakeComplianceItem.case_id == case_id,
                IntakeComplianceItem.related_document_id.in_(document_ids),
            ).delete(synchronize_session=False)

        db.query(IntakeComplianceItem).filter(
            IntakeComplianceItem.case_id == case_id
        ).delete(synchronize_session=False)

        db.query(IntakeDocumentTracker).filter(
            IntakeDocumentTracker.case_id == case_id
        ).delete(synchronize_session=False)

        db.query(CaseParty).filter(
            CaseParty.case_id == case_id
        ).delete(synchronize_session=False)

        db.query(CaseDocument).filter(
            CaseDocument.case_id == case_id
        ).delete(synchronize_session=False)

        db.delete(case_obj)
        db.commit()

        for path in file_paths:
            safe_remove_file(path)

        return success_response(
            "Legacy case deleted successfully.",
            data={"case_id": case_id},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_legacy_case failed")
        return error_response(
            "Failed to delete legacy case.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/legacy-cases/stats", methods=["GET"])
@role_required(["staff"])
def get_legacy_case_stats():
    db = SessionLocal()

    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        legacy_cases = db.query(Case).filter(Case.case_origin == "legacy_encoding").all()

        return success_response(
            "Legacy case stats retrieved successfully.",
            data={
                "total": len(legacy_cases),
                "inv": len([c for c in legacy_cases if c.case_type == "INV"]),
                "inq": len([c for c in legacy_cases if c.case_type == "INQ"]),
                "filed_in_court": len([c for c in legacy_cases if c.case_status == "filed_in_court"]),
                "for_trial": len([c for c in legacy_cases if c.case_status == "for_trial"]),
                "decided": len([c for c in legacy_cases if c.case_status == "decided"]),
                "archived": len([c for c in legacy_cases if c.case_status == "archived"]),
                "closed": len([c for c in legacy_cases if c.case_status == "closed"]),
            },
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("get_legacy_case_stats failed")
        return error_response(
            "Failed to fetch legacy case stats.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/audit-logs", methods=["GET"])
@role_required(["staff"])
def list_staff_audit_logs():
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        limit = request.args.get("limit", 50)
        try:
            limit = int(limit)
        except ValueError:
            limit = 50

        if limit < 1:
            limit = 50
        elif limit > 200:
            limit = 200

        items = (
            db.query(StaffAuditLog)
            .order_by(StaffAuditLog.created_at.desc())
            .limit(limit)
            .all()
        )

        return success_response(
            "Audit logs retrieved successfully.",
            data={"audit_logs": [serialize_staff_audit_log(item) for item in items]},
            status_code=200,
        )
    except Exception as e:
        current_app.logger.exception("list_staff_audit_logs failed")
        return error_response(
            "Failed to fetch audit logs.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/intake-cases/<int:intake_case_id>/audit-logs", methods=["GET"])
@role_required(["staff"])
def get_intake_case_audit_logs(intake_case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        items = (
            db.query(StaffAuditLog)
            .filter(StaffAuditLog.intake_case_id == intake_case_id)
            .order_by(StaffAuditLog.created_at.desc())
            .all()
        )

        return success_response(
            "Intake case audit logs retrieved successfully.",
            data={"audit_logs": [serialize_staff_audit_log(item) for item in items]},
            status_code=200,
        )
    except Exception as e:
        current_app.logger.exception("get_intake_case_audit_logs failed")
        return error_response(
            "Failed to fetch intake case audit logs.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

@staff_bp.route("/cases/<int:case_id>/audit-logs", methods=["GET"])
@role_required(["staff"])
def get_case_audit_logs(case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        items = (
            db.query(StaffAuditLog)
            .filter(StaffAuditLog.case_id == case_id)
            .order_by(StaffAuditLog.created_at.desc())
            .all()
        )

        return success_response(
            "Case audit logs retrieved successfully.",
            data={"audit_logs": [serialize_staff_audit_log(item) for item in items]},
            status_code=200,
        )
    except Exception as e:
        current_app.logger.exception("get_case_audit_logs failed")
        return error_response(
            "Failed to fetch case audit logs.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()

# -----------------------------
# Official Case Court Event Routes
# -----------------------------
@staff_bp.route("/cases/<int:case_id>/court-events", methods=["POST"])
@role_required(["staff"])
def create_case_court_event(case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Official case not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        event_type = (payload.get("event_type") or "").strip()
        event_date = parse_optional_datetime(payload.get("event_date"))

        if not event_type:
            return error_response("event_type is required.", status_code=400)

        if event_type not in COURT_EVENT_TYPES:
            return error_response(
                "Invalid event_type.",
                errors=[f"Allowed values: {', '.join(sorted(COURT_EVENT_TYPES))}"],
                status_code=400,
            )

        if not event_date:
            return error_response(
                "event_date is required.",
                errors=["Use YYYY-MM-DD or ISO datetime format."],
                status_code=400,
            )

        item = CaseCourtEvent(
            case_id=case_id,
            event_type=event_type,
            event_date=event_date,
            result=payload.get("result"),
            notes=payload.get("notes"),
            related_document_id=payload.get("related_document_id"),
            created_by=current_user.user_id,
            updated_by=current_user.user_id,
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        return success_response(
            "Court event created successfully.",
            data={"court_event": serialize_case_court_event(item)},
            status_code=201,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("create_case_court_event failed")
        return error_response(
            "Failed to create court event.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/cases/<int:case_id>/court-events", methods=["GET"])
@role_required(["staff"])
def list_case_court_events(case_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        case_obj = db.query(Case).filter(Case.id == case_id).first()
        if not case_obj:
            return error_response("Official case not found.", status_code=404)

        items = (
            db.query(CaseCourtEvent)
            .filter(CaseCourtEvent.case_id == case_id)
            .order_by(CaseCourtEvent.event_date.asc(), CaseCourtEvent.created_at.asc())
            .all()
        )

        return success_response(
            "Court events retrieved successfully.",
            data={"court_events": [serialize_case_court_event(item) for item in items]},
            status_code=200,
        )

    except Exception as e:
        current_app.logger.exception("list_case_court_events failed")
        return error_response(
            "Failed to fetch court events.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/cases/<int:case_id>/court-events/<int:event_id>", methods=["PATCH"])
@role_required(["staff"])
def update_case_court_event(case_id, event_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        item = (
            db.query(CaseCourtEvent)
            .filter(
                CaseCourtEvent.id == event_id,
                CaseCourtEvent.case_id == case_id,
            )
            .first()
        )

        if not item:
            return error_response("Court event not found.", status_code=404)

        payload = request.get_json(silent=True) or {}

        if "event_type" in payload:
            event_type = (payload.get("event_type") or "").strip()
            if not event_type:
                return error_response("event_type cannot be empty.", status_code=400)
            if event_type not in COURT_EVENT_TYPES:
                return error_response(
                    "Invalid event_type.",
                    errors=[f"Allowed values: {', '.join(sorted(COURT_EVENT_TYPES))}"],
                    status_code=400,
                )
            item.event_type = event_type

        if "event_date" in payload:
            parsed_event_date = parse_optional_datetime(payload.get("event_date"))
            if payload.get("event_date") and not parsed_event_date:
                return error_response(
                    "Invalid event_date format.",
                    errors=["Use YYYY-MM-DD or ISO datetime format."],
                    status_code=400,
                )
            item.event_date = parsed_event_date

        if "result" in payload:
            item.result = payload.get("result")

        if "notes" in payload:
            item.notes = payload.get("notes")

        if "related_document_id" in payload:
            item.related_document_id = payload.get("related_document_id")

        item.updated_by = current_user.user_id
        item.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(item)

        return success_response(
            "Court event updated successfully.",
            data={"court_event": serialize_case_court_event(item)},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("update_case_court_event failed")
        return error_response(
            "Failed to update court event.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()


@staff_bp.route("/cases/<int:case_id>/court-events/<int:event_id>", methods=["DELETE"])
@role_required(["staff"])
def delete_case_court_event(case_id, event_id):
    db = SessionLocal()
    try:
        current_user = get_current_user()
        if not current_user:
            return error_response("Unauthorized", status_code=401)

        item = (
            db.query(CaseCourtEvent)
            .filter(
                CaseCourtEvent.id == event_id,
                CaseCourtEvent.case_id == case_id,
            )
            .first()
        )

        if not item:
            return error_response("Court event not found.", status_code=404)

        db.delete(item)
        db.commit()

        return success_response(
            "Court event deleted successfully.",
            data={"event_id": event_id},
            status_code=200,
        )

    except Exception as e:
        db.rollback()
        current_app.logger.exception("delete_case_court_event failed")
        return error_response(
            "Failed to delete court event.",
            errors=[str(e)],
            status_code=500,
        )
    finally:
        db.close()