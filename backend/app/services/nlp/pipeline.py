#backend/app/services/nlp/pipeline.py

from app.services.ocr.ocr_engine import extract_text_from_file
from app.services.ocr.text_cleaner import clean_ocr_text
from app.services.nlp.classifier import classify_document
from app.services.nlp.extractor import extract_metadata
from app.services.nlp.document_reconciler import (
    fill_missing_case_fields,
    cleanup_resolved_warnings,
    add_review_suggestions,
)
from app.services.nlp.confidence_recalculator import recalculate_document_confidence
from app.services.nlp.document_splitter import split_pages_into_documents
from app.services.nlp.entity_helpers import extract_person_entities

from app.services.nlp.document_zones import split_document_zones

def process_document_pipeline(
    file_path: str,
    mime_type: str,
    forced_document_type: str | None = None,
    case_type: str | None = None,
):
    """
    Shared OCR + NLP pipeline used by:
    - /api/documents/extract
    - /staff intake routes

    Responsibilities:
    1. OCR the file
    2. Clean OCR text
    3. Split pages into logical documents
    4. Detect or force document type
    5. Extract metadata per logical document
    6. Reconcile document bundle fields
    7. Return one consistent result structure
    """

    ocr_result = extract_text_from_file(file_path, mime_type)
    raw_text = ocr_result.get("raw_text", "") or ""
    pages = ocr_result.get("pages", []) or []

    clean_text = clean_ocr_text(raw_text)
    grouped_documents = split_pages_into_documents(pages)

    extracted_documents = []
    first_document_type = None

    for grouped_doc in grouped_documents:
        grouped_text = clean_ocr_text(grouped_doc.get("text", "") or "")
        zones = split_document_zones(grouped_text)
        
        document_type = forced_document_type or grouped_doc.get("document_type")
        if document_type:
            doc_conf = 0.99
        else:
            document_type, doc_conf = classify_document(grouped_text)

        metadata, confidence, warnings = extract_metadata(
            grouped_text,
            document_type,
            case_type=case_type,
        )        
        confidence["document_type"] = doc_conf

        if not document_type:
            warnings.append("document_type not recognized")

        extracted_documents.append({
            "document_type": document_type,
            "start_page": grouped_doc.get("start_page"),
            "end_page": grouped_doc.get("end_page"),
            "zones": zones,
            "pages": grouped_doc.get("pages", []),
            "text": grouped_text,
            "extracted_metadata": metadata,
            "confidence": confidence,
            "warnings": warnings,
        })

        if first_document_type is None and document_type:
            first_document_type = document_type

    extracted_documents = fill_missing_case_fields(
        extracted_documents,
        case_type=case_type,
    )
    extracted_documents = cleanup_resolved_warnings(
        extracted_documents,
        case_type=case_type,
    )
    extracted_documents = add_review_suggestions(
        extracted_documents,
        case_type=case_type,
    )

    primary_document = extracted_documents[0] if extracted_documents else None

    return {
        "raw_text": raw_text,
        "clean_text": clean_text,
        "pages": pages,
        "documents": extracted_documents,
        "primary_document": primary_document,
        "first_document_type": first_document_type,
    }