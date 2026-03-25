#backend/app/services/staff/case_service.py

from sqlalchemy import func
from model import User, CaseParty
from app.constants.staff_case_constants import OFFICIAL_CASE_STATUSES, COURT_RESULT_VALUES


def resolve_assigned_prosecutor(db, assigned_prosecutor_value=None, assigned_prosecutor_id=None):
    if assigned_prosecutor_id:
        user = (
            db.query(User)
            .filter(
                User.user_id == assigned_prosecutor_id,
                User.role == "prosecutor"
            )
            .first()
        )
        if user:
            return user.user_id, f"{user.first_name} {user.last_name}".strip()

    if assigned_prosecutor_value and str(assigned_prosecutor_value).strip():
        full_name = str(assigned_prosecutor_value).strip()
        parts = full_name.split()

        if len(parts) >= 2:
            first = parts[0]
            last = " ".join(parts[1:])

            user = (
                db.query(User)
                .filter(
                    func.lower(User.first_name) == first.lower(),
                    func.lower(User.last_name) == last.lower(),
                    User.role == "prosecutor",
                )
                .first()
            )
            if user:
                return user.user_id, f"{user.first_name} {user.last_name}".strip()

        return None, full_name

    return None, None


def create_case_parties(db, case_id, complainants, respondents):
    for name in complainants or []:
        if name and str(name).strip():
            db.add(
                CaseParty(
                    case_id=case_id,
                    party_type="complainant",
                    full_name=str(name).strip(),
                )
            )

    for name in respondents or []:
        if name and str(name).strip():
            db.add(
                CaseParty(
                    case_id=case_id,
                    party_type="respondent",
                    full_name=str(name).strip(),
                )
            )


def validate_official_case_status(value):
    if value is None:
        return True, None

    normalized = str(value).strip()
    if not normalized:
        return True, None

    if normalized not in OFFICIAL_CASE_STATUSES:
        return False, f"Allowed values: {', '.join(sorted(OFFICIAL_CASE_STATUSES))}"

    return True, normalized


def validate_court_result(value):
    if value is None:
        return True, None

    normalized = str(value).strip()
    if not normalized:
        return True, None

    if normalized not in COURT_RESULT_VALUES:
        return False, f"Allowed values: {', '.join(sorted(COURT_RESULT_VALUES))}"

    return True, normalized