# seed_document_types.py
from database import SessionLocal
from model import DocumentType

DEFAULT_DOCUMENT_TYPES = [
    {
        "name": "Complaint Affidavit",
        "description": "Affidavit of complaint",
        "is_required_for_new_case": True,
    },
    {
        "name": "Counter Affidavit",
        "description": "Affidavit of respondent",
        "is_required_for_new_case": False,
    },
    {
        "name": "Police Report",
        "description": "Police investigation/report document",
        "is_required_for_new_case": True,
    },
    {
        "name": "Supporting Evidence",
        "description": "Attachments and supporting files",
        "is_required_for_new_case": True,
    },
]

def seed():
    db = SessionLocal()
    try:
        for item in DEFAULT_DOCUMENT_TYPES:
            existing = db.query(DocumentType).filter(DocumentType.name == item["name"]).first()
            if not existing:
                db.add(DocumentType(**item))
        db.commit()
        print("Document types seeded successfully.")
    except Exception as e:
        db.rollback()
        print("Error seeding document types:", e)
    finally:
        db.close()

if __name__ == "__main__":
    seed()