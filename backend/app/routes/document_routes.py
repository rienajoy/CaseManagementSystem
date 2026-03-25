import json
from flask import Blueprint, current_app, jsonify, request

from database import SessionLocal
from model import DocumentExtraction
from app.utils.file_utils import allowed_file, save_uploaded_file, guess_mime_type
from app.services.nlp.pipeline import process_document_pipeline

document_bp = Blueprint("document_bp", __name__)


@document_bp.route("/extract", methods=["POST"])
def extract_document():
    db = SessionLocal()

    try:
        if "file" not in request.files:
            return jsonify({
                "success": False,
                "message": "No file provided.",
                "errors": ["file is required"],
            }), 400

        file = request.files["file"]

        if not file or file.filename == "":
            return jsonify({
                "success": False,
                "message": "Empty filename.",
                "errors": ["uploaded file has no filename"],
            }), 400

        if not allowed_file(file.filename):
            return jsonify({
                "success": False,
                "message": "Unsupported file type.",
                "errors": ["allowed file types only"],
            }), 400

        original_name, saved_path = save_uploaded_file(
            file,
            current_app.config["OCR_UPLOAD_FOLDER"]
        )
        mime_type = guess_mime_type(original_name)

        extraction = DocumentExtraction(
            file_name=original_name,
            original_file_path=saved_path,
            mime_type=mime_type,
            extraction_status="processing",
            review_status="needs_review",
        )
        db.add(extraction)
        db.commit()
        db.refresh(extraction)

        pipeline_result = process_document_pipeline(
            file_path=saved_path,
            mime_type=mime_type,
            forced_document_type=None,
        )

        raw_text = pipeline_result["raw_text"]
        clean_text = pipeline_result["clean_text"]
        pages = pipeline_result["pages"]
        extracted_documents = pipeline_result["documents"]
        first_document_type = pipeline_result["first_document_type"]

        extraction.document_type = first_document_type
        extraction.raw_text = raw_text
        extraction.clean_text = clean_text
        extraction.pages_json = json.dumps(pages)
        extraction.extracted_json = json.dumps(extracted_documents)
        extraction.confidence_json = json.dumps({})
        extraction.warnings_json = json.dumps([])
        extraction.extraction_status = "completed"

        db.commit()
        db.refresh(extraction)

        return jsonify({
            "success": True,
            "message": "Document processed successfully.",
            "data": {
                "document_id": extraction.id,
                "raw_text": raw_text,
                "clean_text": clean_text,
                "pages": pages,
                "documents": extracted_documents,
                "first_document_type": first_document_type,
            }
        }), 200

    except Exception as e:
        db.rollback()
        current_app.logger.exception("extract_document failed")
        return jsonify({
            "success": False,
            "message": "Failed to process document.",
            "errors": [str(e)],
        }), 500

    finally:
        db.close()