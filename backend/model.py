from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)

    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)

    password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # super_admin/admin/staff/prosecutor

    status = Column(String, default="offline")
    failed_login_attempts = Column(Integer, default=0)

    must_change_password = Column(Boolean, default=False, nullable=False)
    last_password_change = Column(DateTime, default=datetime.utcnow, nullable=False)

    permissions = Column(JSON, default=list, nullable=False)

    last_active = Column(DateTime, default=datetime.utcnow)
    profile_pic = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AdminActionLog(Base):
    __tablename__ = "admin_action_logs"

    log_id = Column(Integer, primary_key=True, index=True)

    admin_user_id = Column(Integer, nullable=False)
    admin_name = Column(String, nullable=False)

    action = Column(String, nullable=False)

    target_user_id = Column(Integer, nullable=True)
    target_name = Column(String, nullable=True)

    details = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Case(Base):
    __tablename__ = "cases"

    id = Column(Integer, primary_key=True, index=True)
    case_number = Column(String, unique=True, index=True, nullable=True)
    docket_number = Column(String, unique=True, nullable=True)
    case_title = Column(String, nullable=True)
    offense_or_violation = Column(String, nullable=True)
    case_type = Column(String, nullable=True)  # INV or INQ
    filing_date = Column(DateTime, nullable=False, default=datetime.utcnow)

    receiving_office_id = Column(Integer, nullable=True)
    assigned_prosecutor_id = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    case_origin = Column(String, nullable=False, default="new")
    intake_status = Column(String, nullable=False, default="draft")
    case_status = Column(String, nullable=False, default="new")

    prosecution_result = Column(String, nullable=False, default="none")
    court_result = Column(String, nullable=False, default="none")
    custody_result = Column(String, nullable=False, default="none")

    summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolution_date = Column(DateTime, nullable=True)
    filed_in_court_date = Column(DateTime, nullable=True)
    court_branch = Column(String, nullable=True)
    source_intake_case_id = Column(Integer, ForeignKey("intake_cases.id"), nullable=True)
    latest_document_type = Column(String, nullable=True)


class DocumentType(Base):
    __tablename__ = "document_types"

    document_type_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)

    is_required_for_new_case = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CaseRequiredDocument(Base):
    __tablename__ = "case_required_documents"

    case_required_document_id = Column(Integer, primary_key=True, index=True)

    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)
    document_type_id = Column(Integer, ForeignKey("document_types.document_type_id"), nullable=False)

    is_required = Column(Boolean, default=True, nullable=False)
    is_submitted = Column(Boolean, default=False, nullable=False)
    is_uploaded = Column(Boolean, default=False, nullable=False)

    date_requested = Column(DateTime, nullable=True)
    date_received = Column(DateTime, nullable=True)

    status = Column(String, nullable=False, default="missing")
    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CaseParty(Base):
    __tablename__ = "case_parties"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    party_type = Column(String, nullable=False)  # complainant, respondent
    full_name = Column(String, nullable=False)
    normalized_name = Column(String, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class IntakeCase(Base):
    __tablename__ = "intake_cases"

    id = Column(Integer, primary_key=True, index=True)

    case_type = Column(String(10), nullable=False)  # INV or INQ
    intake_status = Column(String(50), nullable=False, default="received")
    review_notes = Column(Text, nullable=True)

    extracted_data = Column(JSON, nullable=True)

    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    received_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    received_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    converted_case_id = Column(Integer, ForeignKey("cases.id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)

    

class IntakeCaseDocument(Base):
    __tablename__ = "intake_case_documents"

    id = Column(Integer, primary_key=True, index=True)

    intake_case_id = Column(Integer, ForeignKey("intake_cases.id"), nullable=False)

    document_type = Column(String, nullable=False)

    uploaded_file_name = Column(String, nullable=False)
    uploaded_file_path = Column(String, nullable=False)

    file_mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)

    uploaded_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    date_received = Column(DateTime, nullable=True)

    ocr_text = Column(Text, nullable=True)
    extracted_data = Column(JSON, nullable=True)
    reviewed_data = Column(JSON, nullable=True)

    has_extraction_issues = Column(Boolean, default=False, nullable=False)
    review_priority = Column(String, nullable=False, default="normal")
    review_notes = Column(Text, nullable=True)

    is_reviewed = Column(Boolean, default=False, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    is_case_applied = Column(Boolean, default=False, nullable=False)
    case_applied_at = Column(DateTime, nullable=True)

    ocr_status = Column(String, nullable=False, default="pending")
    nlp_status = Column(String, nullable=False, default="pending")
    document_status = Column(String, nullable=False, default="uploaded")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document_extraction_id = Column(Integer, ForeignKey("document_extractions.id"), nullable=True)
    start_page = Column(Integer, nullable=True)
    end_page = Column(Integer, nullable=True)

    document_date = Column(DateTime, nullable=True)
    document_group_key = Column(String(100), nullable=True)
    version_no = Column(Integer, nullable=False, default=1)
    is_latest = Column(Boolean, nullable=False, default=True)
    version_status = Column(String(30), nullable=False, default="active")
    supersedes_document_id = Column(Integer, nullable=True)

    is_initiating_document = Column(Boolean, default=False, nullable=False)
    
class CaseDocument(Base):
    __tablename__ = "case_documents"

    id = Column(Integer, primary_key=True, index=True)

    case_id = Column(Integer, ForeignKey("cases.id"), nullable=False)

    document_type = Column(String, nullable=False)

    uploaded_file_name = Column(String, nullable=False)
    uploaded_file_path = Column(String, nullable=False)

    file_mime_type = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)

    uploaded_by = Column(Integer, ForeignKey("users.user_id"), nullable=False)

    is_initiating_document = Column(Boolean, default=False, nullable=False)

    ocr_text = Column(Text, nullable=True)
    extracted_data = Column(JSON, nullable=True)
    reviewed_data = Column(JSON, nullable=True)

    has_extraction_issues = Column(Boolean, default=False, nullable=False)
    review_priority = Column(String, nullable=False, default="normal")
    review_notes = Column(Text, nullable=True)

    is_reviewed = Column(Boolean, default=False, nullable=False)
    reviewed_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    is_case_applied = Column(Boolean, default=False, nullable=False)
    case_applied_at = Column(DateTime, nullable=True)

    document_status = Column(String, nullable=False, default="uploaded")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    document_extraction_id = Column(Integer, ForeignKey("document_extractions.id"), nullable=True)
    source_intake_case_document_id = Column(Integer, ForeignKey("intake_case_documents.id"), nullable=True)
    start_page = Column(Integer, nullable=True)
    end_page = Column(Integer, nullable=True)
    source_confidence = Column(JSON, nullable=True)
    source_warnings = Column(JSON, nullable=True)

    document_date = Column(DateTime, nullable=True)
    document_group_key = Column(String(100), nullable=True)
    version_no = Column(Integer, nullable=False, default=1)
    is_latest = Column(Boolean, nullable=False, default=True)
    version_status = Column(String(30), nullable=False, default="active")
    supersedes_document_id = Column(Integer, nullable=True)


class DocumentExtraction(Base):
    __tablename__ = "document_extractions"

    id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String, nullable=False)
    original_file_path = Column(String, nullable=False)
    mime_type = Column(String, nullable=True)

    document_type = Column(String, nullable=True)
    extraction_status = Column(String, nullable=False, default="uploaded")
    review_status = Column(String, nullable=False, default="needs_review")

    raw_text = Column(Text, nullable=True)
    clean_text = Column(Text, nullable=True)

    extracted_json = Column(JSON, nullable=True)
    confidence_json = Column(JSON, nullable=True)
    warnings_json = Column(JSON, nullable=True)
    pages_json = Column(JSON, nullable=True)

    uploaded_by = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class IntakeDocumentTracker(Base):
    __tablename__ = "intake_document_trackers"

    id = Column(Integer, primary_key=True, index=True)
    intake_case_id = Column(Integer, ForeignKey("intake_cases.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)

    document_type = Column(String(100), nullable=False)
    tracking_type = Column(String(50), nullable=False, default="missing")  # missing / expected / requested / followup
    source_location = Column(String(255), nullable=True)
    office_department = Column(String(255), nullable=True)
    responsible_party = Column(String(255), nullable=True)

    requested_date = Column(DateTime, nullable=True)
    expected_date = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    received_date = Column(DateTime, nullable=True)

    status = Column(String(50), nullable=False, default="missing")  # missing / requested / awaiting / received / overdue / not_applicable
    remarks = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class IntakeComplianceItem(Base):
    __tablename__ = "intake_compliance_items"

    id = Column(Integer, primary_key=True, index=True)
    intake_case_id = Column(Integer, ForeignKey("intake_cases.id"), nullable=False, index=True)
    intake_case_id = Column(Integer, ForeignKey("intake_cases.id"), nullable=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"), nullable=True, index=True)
    related_document_id = Column(Integer, ForeignKey("intake_case_documents.id"), nullable=True)

    compliance_type = Column(String(100), nullable=False)  # subpoena_compliance, counter_affidavit_submission, etc.
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    issued_date = Column(DateTime, nullable=True)
    due_date = Column(DateTime, nullable=True)
    days_to_comply = Column(Integer, nullable=True)
    complied_date = Column(DateTime, nullable=True)

    compliance_status = Column(String(50), nullable=False, default="pending")  # pending / complied / overdue / cancelled
    responsible_party = Column(String(255), nullable=True)
    remarks = Column(Text, nullable=True)

    created_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)
    updated_by = Column(Integer, ForeignKey("users.user_id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StaffAuditLog(Base):
    __tablename__ = "staff_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer, nullable=False)

    intake_case_id = Column(Integer, nullable=True)
    case_id = Column(Integer, nullable=True)
    document_id = Column(Integer, nullable=True)

    old_values = Column(JSON, nullable=True)
    new_values = Column(JSON, nullable=True)
    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)



class CaseCourtEvent(Base):
    __tablename__ = "case_court_events"

    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, nullable=False)
    event_type = Column(String(50), nullable=False)
    event_date = Column(DateTime, nullable=False)
    result = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    related_document_id = Column(Integer, nullable=True)

    created_by = Column(Integer, nullable=True)
    updated_by = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)