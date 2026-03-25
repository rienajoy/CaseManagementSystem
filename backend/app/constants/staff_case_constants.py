#app/constants/staff_case_constants.py

ALLOWED_CASE_TYPES = {"INV", "INQ"}

INV_FOLLOWING_DOCUMENT_TYPES = {
    "subpoena",
    "counter_affidavit",
    "resolution",
    "information",
}

INQ_INITIATING_DOCUMENT_TYPES = {
    "police_report",
    "arrest_report",
    "affidavit_of_arrest",
    "affidavit_of_apprehension",
}

INQ_FOLLOWING_DOCUMENT_TYPES = {
    "inquest_resolution",
    "resolution",
    "information",
}

INITIAL_DOCUMENT_TYPES_BY_CASE_TYPE = {
    "INV": {"complaint_affidavit"},
    "INQ": INQ_INITIATING_DOCUMENT_TYPES,
}

FOLLOWUP_DOCUMENT_TYPES_BY_CASE_TYPE = {
    "INV": INV_FOLLOWING_DOCUMENT_TYPES.union({
        "reply_affidavit",
        "rejoinder",
        "other_supporting_document",
    }),
    "INQ": INQ_FOLLOWING_DOCUMENT_TYPES.union({
        "referral_letter",
        "complaint_affidavit",
        "other_supporting_document",
    }),
}

OFFICIAL_CASE_STATUSES = {
    "filed_in_court",
    "for_arraignment",
    "for_pre_trial",
    "for_trial",
    "for_decision",
    "decided",
    "dismissed_by_court",
    "archived",
    "closed",
}

OFFICIAL_CASE_DOCUMENT_TYPES = {
    "information",
    "arraignment_order",
    "pre_trial_order",
    "trial_order",
    "court_decision",
    "judgment",
    "archive_order",
    "release_order",
    "warrant",
    "commitment_order",
    "other_court_document",
}

COURT_RESULT_VALUES = {
    "none",
    "convicted",
    "acquitted",
    "dismissed",
    "archived",
    "closed",
}

COURT_EVENT_TYPES = {
    "information_filed",
    "arraignment",
    "pre_trial",
    "hearing",
    "trial",
    "decision",
    "judgment",
    "archive",
    "closure",
    "warrant_issued",
    "warrant_served",
    "release_order",
}