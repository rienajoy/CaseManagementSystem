INV_REQUIRED_INITIATING_DOCS = [
    "complaint_affidavit",
]

INV_EXPECTED_FOLLOWUP_DOCS = [
    "subpoena",
    "counter_affidavit",
    "resolution",
]

INV_LATER_STAGE_DOCS = [
    "information",
    "order",
    "judgment",
    "notice_of_appeal",
    "entry_of_judgment",
]


INQ_REQUIRED_INITIATING_DOCS = [
    "affidavit_of_arrest",
    "police_investigation_report",
]

INQ_OPTIONAL_INITIATING_DOCS = [
    "affidavit_of_apprehension",
    "referral_letter",
    "complaint_affidavit",
]

INQ_EXPECTED_FOLLOWUP_DOCS = [
    "inquest_resolution",
]

INQ_LATER_STAGE_DOCS = [
    "information",
    "order",
    "judgment",
    "notice_of_appeal",
    "entry_of_judgment",
]


CASE_TYPE_DOCUMENT_RULES = {
    "INV": {
        "required_initiating": INV_REQUIRED_INITIATING_DOCS,
        "optional_initiating": [],
        "expected_followup": INV_EXPECTED_FOLLOWUP_DOCS,
        "later_stage": INV_LATER_STAGE_DOCS,
    },
    "INQ": {
        "required_initiating": INQ_REQUIRED_INITIATING_DOCS,
        "optional_initiating": INQ_OPTIONAL_INITIATING_DOCS,
        "expected_followup": INQ_EXPECTED_FOLLOWUP_DOCS,
        "later_stage": INQ_LATER_STAGE_DOCS,
    },
}