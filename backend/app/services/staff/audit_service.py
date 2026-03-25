from model import StaffAuditLog


def log_staff_action(
    db,
    *,
    user_id,
    action,
    entity_type,
    entity_id,
    intake_case_id=None,
    case_id=None,
    document_id=None,
    old_values=None,
    new_values=None,
    remarks=None,
):
    entry = StaffAuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        intake_case_id=intake_case_id,
        case_id=case_id,
        document_id=document_id,
        old_values=old_values,
        new_values=new_values,
        remarks=remarks,
    )
    db.add(entry)
    return entry