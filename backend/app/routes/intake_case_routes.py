from datetime import datetime
from flask import Blueprint, jsonify, request

from database import SessionLocal
from model import IntakeCase, IntakeCaseDocument, DocumentExtraction


intake_case_bp = Blueprint("intake_case_bp", __name__)


@intake_case_bp.route("/intake-cases", methods=["POST"])
def create_intake_case():
    db = SessionLocal()

    try:
        data = request.get_json() or {}

        case_type = data.get("case_type")
        created_by = data.get("created_by")
        review_notes = data.get("review_notes")
        extracted_data = data.get("extracted_data") or {}

        document_extraction_id = data.get("document_extraction_id")
        save_document = data.get("save_document", True)

        if not case_type:
            return jsonify({"message": "case_type is required"}), 400

        if not created_by:
            return jsonify({"message": "created_by is required"}), 400

        if not extracted_data:
            return jsonify({"message": "extracted_data is required"}), 400

        intake_case = IntakeCase(
            case_type=case_type,
            intake_status="received",
            review_notes=review_notes,
            extracted_data=extracted_data,
            created_by=created_by,
            received_by=created_by,
            received_at=datetime.utcnow(),
        )

        db.add(intake_case)
        db.commit()
        db.refresh(intake_case)

        created_document = None

        if save_document and document_extraction_id:
            extraction = db.query(DocumentExtraction).filter(
                DocumentExtraction.id == document_extraction_id
            ).first()

            if extraction:
                document_type = (
                    extracted_data.get("document_type")
                    or extraction.document_type
                    or "complaint_affidavit"
                )

                extracted_documents = extraction.extracted_json or []

                start_page = None
                end_page = None

                if isinstance(extracted_documents, list) and extracted_documents:
                    first_doc = extracted_documents[0]
                    start_page = first_doc.get("start_page")
                    end_page = first_doc.get("end_page")

                intake_case_document = IntakeCaseDocument(
                    intake_case_id=intake_case.id,
                    document_type=document_type,
                    uploaded_file_name=extraction.file_name,
                    uploaded_file_path=extraction.original_file_path,
                    file_mime_type=extraction.mime_type,
                    uploaded_by=created_by,
                    ocr_text=extraction.clean_text or extraction.raw_text,
                    extracted_data=extracted_data,
                    reviewed_data=extracted_data,
                    has_extraction_issues=False,
                    review_priority="normal",
                    is_reviewed=True,
                    reviewed_by=created_by,
                    reviewed_at=datetime.utcnow(),
                    ocr_status="completed",
                    nlp_status="completed",
                    document_status="reviewed",
                    start_page=start_page,
                    end_page=end_page,
                )

                db.add(intake_case_document)
                db.commit()
                db.refresh(intake_case_document)

                created_document = {
                    "id": intake_case_document.id,
                    "document_type": intake_case_document.document_type,
                    "uploaded_file_name": intake_case_document.uploaded_file_name,
                }

        return jsonify({
            "message": "Intake case saved successfully",
            "intake_case": {
                "id": intake_case.id,
                "case_type": intake_case.case_type,
                "intake_status": intake_case.intake_status,
                "review_notes": intake_case.review_notes,
                "extracted_data": intake_case.extracted_data,
                "created_by": intake_case.created_by,
                "received_by": intake_case.received_by,
                "received_at": intake_case.received_at.isoformat() if intake_case.received_at else None,
                "created_at": intake_case.created_at.isoformat() if intake_case.created_at else None,
            },
            "document": created_document,
        }), 201

    except Exception as e:
        db.rollback()
        return jsonify({
            "message": "Failed to save intake case",
            "error": str(e),
        }), 500

    finally:
        db.close()