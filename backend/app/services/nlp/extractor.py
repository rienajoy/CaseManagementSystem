#backend/app/services/nlp/extractor.py

import re

from app.services.nlp.patterns import (
    DATE_PATTERNS,
    DOCKET_PATTERNS,
    CASE_NUMBER_PATTERNS,
)
from app.services.nlp.normalizer import normalize_date, normalize_whitespace
from app.services.nlp.confidence import confidence_found, confidence_missing

from app.services.nlp.entity_helpers import (
    sentence_tokenize,
    extract_person_entities,
    extract_date_entities,
    extract_name_after_i_clause,
)


# =========================================================
# Generic helpers
# =========================================================

HEADER_BAD_EXACT = {
    "republic of the philippines",
    "department of justice",
    "office of the city prosecutor",
    "office of the provincial prosecutor",
    "office of the prosecutor",
    "paranaque city",
    "bohol",
    "cebu",
    "quezon city",
    "butuan city",
    "city of butuan",
    "complaint-affidavit",
    "counter-affidavit",
    "resolution",
    "information",
    "order",
    "commitment order",
    "release order",
    "entry of judgment",
    "notice of appeal",
    "judgment",
    "decision",
    "the revised penal code",
    "under the revised penal code",
    "plaintiff",
    "accused",
    "complainant",
    "respondent",
    "respondents",
    "revised penal code",
    "other applicable offenses",
    "applicable offenses",
    "versus",
}

HEADER_BAD_CONTAINS = [
    "article 353",
    "article 355",
    "article 315",
    "statement of facts",
    "for:",
    "page ",
    "case no.",
    "crim case no.",
    "criminal case no.",
    "revised penal code",
    "applicable offenses",
    "other applicable offenses",
    "versus",
]


def extract_first_match(patterns: list[str], text: str):
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            if match.groups():
                return match.group(1).strip()
            return match.group(0).strip()
    return None

def get_affidavit_body_only(text: str) -> str:
    if not text:
        return text

    split_markers = [
        "IN WITNESS WHEREOF",
        "SUBSCRIBED AND SWORN",
        "SUPPORTING DOCUMENTARY EVIDENCE",
    ]

    upper_text = text.upper()
    cut_positions = []

    for marker in split_markers:
        idx = upper_text.find(marker)
        if idx != -1:
            cut_positions.append(idx)

    if cut_positions:
        return text[:min(cut_positions)]

    return text

def choose_best_offense_candidate(candidates: list[str]) -> str | None:
    cleaned = []

    for value in candidates:
        norm = normalize_legal_text(value)
        if not norm:
            continue

        low = norm.lower()

        # reject obvious junk
        bad_fragments = [
            "complainant",
            "respondent",
            "affidavit",
            "subscribed and sworn",
            "annex",
            "witness",
            "assistant city prosecutor",
            "barangay",
        ]
        if any(fragment in low for fragment in bad_fragments):
            continue

        if len(norm) < 4:
            continue

        cleaned.append(norm)

    if not cleaned:
        return None

    # prefer most legally-specific phrase
    scored = []
    for value in cleaned:
        score = 0
        low = value.lower()

        if "violation of" in low:
            score += 4
        if "article" in low:
            score += 3
        if "section" in low or "sec." in low:
            score += 3
        if "r.a." in low:
            score += 3
        if len(value.split()) >= 2:
            score += 1

        scored.append((score, len(value), value))

    scored.sort(reverse=True)
    return scored[0][2]

def looks_like_legal_continuation(line: str) -> bool:
    low = (line or "").lower().strip()
    if not low:
        return False

    legal_markers = [
        "revised penal code",
        "penal code",
        "revised",
        "penal",
        "code",
        "article",
        "art.",
        "section",
        "sec.",
        "violation of",
        "republic act",
        "r.a.",
        "in relation to",
        "qualified",
        "theft",
        "estafa",
        "robbery",
        "physical injuries",
        "bp blg.",
        "b.p. blg.",
    ]

    if any(marker in low for marker in legal_markers):
        return True

    if re.fullmatch(r"(revised|penal|code|act|acts)", low, re.IGNORECASE):
        return True

    return False

def get_caption_lines(text: str, max_lines: int = 20) -> list[str]:
    lines = text.splitlines()
    lines = [line.strip() for line in lines if line.strip()]
    return lines[:max_lines]


def normalize_joined_lines(lines: list[str]) -> str:
    return normalize_whitespace(" ".join([line.strip() for line in lines if line.strip()]))


def clean_party_name(value: str) -> str | None:
    if not value:
        return None

    value = normalize_whitespace(value)

    # remove leading/trailing junk
    value = re.sub(r"^[~\-\–—,:.;/\\|\"'`]+", "", value).strip()
    value = re.sub(r"[~\-\–—,:.;/\\|\"'`]+$", "", value).strip()

    # remove role labels and everything after them
    value = re.sub(r"\bComplainant\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bRespondents?\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bAccused\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bPlaintiff\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bPetitioner\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")

    # remove versus markers and anything after
    value = re.sub(r"\bversus\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bvs\.?\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bv\.\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")

    # remove docket / case number fragments attached to names
    value = re.sub(
        r",?\s*(CRIM(?:INAL)?\.?\s*CASE\s*NO\.?\s*[:\-]?\s*[A-Za-z0-9\-/]+).*",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip(" ,.;:-")

    value = re.sub(
        r",?\s*(CASE\s*NO\.?\s*[:\-]?\s*[A-Za-z0-9\-/]+).*",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip(" ,.;:-")

    value = re.sub(
        r",?\s*(DOCKET\s*NO\.?\s*[:\-]?\s*[A-Za-z0-9\-/]+).*",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip(" ,.;:-")

        # remove "Docket Number" fragments attached to names
    value = re.sub(
        r",?\s*Docket\s+Number\s*[:\-]?\s*[A-Za-z0-9\-/]+.*",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip(" ,.;:-")

    value = re.sub(
        r",?\s*NPS\s+Docket\s+No\.?\s*[:\-]?\s*[A-Za-z0-9\-/]+.*",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip(" ,.;:-")

    value = re.sub(
        r",?\s*I\.?\s*S\.?\s*No\.?\s*[:\-]?\s*[A-Za-z0-9\-/]+.*",
        "",
        value,
        flags=re.IGNORECASE,
    ).strip(" ,.;:-")

    # remove offense fragments accidentally attached to a party line
    value = re.sub(r"\bFOR\s*:.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bViolation\s+of\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bOffense\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bSec\.?\s*\d+.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bSection\s+\d+.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bArt\.?\s*[A-Za-z0-9IVXLC]+.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bArticle\s+[A-Za-z0-9IVXLC]+.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bR\.?\s*A\.?\s*\d+.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")

    # remove leading numeric junk
    value = re.sub(r"^\d{3,5}\s+", "", value).strip()

    # remove page markers
    value = re.sub(r"\bPage\s+\d+\s+of\s+\d+\b", "", value, flags=re.IGNORECASE).strip()

    # remove legal phrase fragments
    value = re.sub(r"^(under\s+the\s+revised\s+penal\s+code)\b", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"^(the\s+revised\s+penal\s+code)\b", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bunderthe revised penal code\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bunder the revised penal code\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\band other applicable offenses\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bother applicable offenses\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")

    value = normalize_whitespace(value)
    value = value.strip(" ,.;:-")

    lowered = value.lower()
    if lowered in HEADER_BAD_EXACT:
        return None

    if any(bp in lowered for bp in HEADER_BAD_CONTAINS):
        return None

    if re.fullmatch(r"[\d\-/]+", value):
        return None

    if len(value) < 3:
        return None

    return value or None

def dedupe_preserve_order(values: list[str]) -> list[str]:
    return list(dict.fromkeys([v for v in values if v]))


def find_persons_near_keywords(text: str, keywords: list[str]) -> list[str]:
    if not text:
        return []

    sentences = sentence_tokenize(text)
    results = []

    for sentence in sentences:
        low = sentence.lower()
        if any(keyword.lower() in low for keyword in keywords):
            for person in extract_person_entities(sentence):
                cleaned = clean_extracted_person(person)
                if cleaned:
                    results.append(cleaned)

    return dedupe_preserve_order(results)


def looks_like_affidavit_intro_line(line: str) -> bool:
    if not line:
        return False

    low = line.lower()
    return (
        "filipino" in low
        or "of legal age" in low
        or "after having been duly sworn" in low
        or "resident of" in low
    )
def join_name_lines(lines: list[str]) -> str | None:
    cleaned = []
    for line in lines:
        value = clean_party_name(line)
        if value:
            cleaned.append(value)

    if not cleaned:
        return None

    joined = normalize_whitespace(" ".join(cleaned))
    return joined if joined else None
def split_joined_party_chunk(value: str) -> list[str]:
    if not value:
        return []

    value = normalize_whitespace(value).strip(" ,.;:-")
    if not value:
        return []

    words = value.split()

    if len(words) <= 3:
        return [value]

    def looks_like_name_word(w: str) -> bool:
        return bool(re.fullmatch(r"[A-Z][A-Za-z\-']+", w))

    # Example:
    # "GRETA ANGELIA SHAYLA ACENAS"
    if len(words) == 4 and all(looks_like_name_word(w) for w in words):
        return [
            f"{words[0]} {words[1]}",
            f"{words[2]} {words[3]}",
        ]

    return [value]



def normalize_legal_text(value: str | None) -> str | None:
    if not value:
        return None

    text = normalize_whitespace(value)

    replacements = [
        (r"\biW\s+relation\s+to\b", "in relation to"),
        (r"\bin\s+telation\s+to\b", "in relation to"),
        (r"\bin\s+reiation\s+to\b", "in relation to"),
        (r"\bin\s+relation\s+ta\b", "in relation to"),
        (r"\bScetion\b", "Section"),
        (r"\bSecti0n\b", "Section"),
        (r"\bSectlon\b", "Section"),
        (r"\bHof\b", "II of"),
        (r"\bIl\s+of\b", "II of"),
        (r"\bAtt\b", "Art."),
        (r"\bArt\s+Tof\b", "Art. II of"),
        (r"\bArticle\s+Hof\b", "Article II of"),
        (r"\bArticle\s+Il\s+of\b", "Article II of"),
        (r"\bR\.A,\s*(\d+)\b", r"R.A. \1"),
        (r"\bRA\s*(\d+)\b", r"R.A. \1"),
        (r"\bR\.A\s+(\d+)\b", r"R.A. \1"),
        (r"\bSec\.\s*", "Sec. "),
        (r"\bArt\.\s*", "Art. "),
    ]

    for pattern, replacement in replacements:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    # remove leading noise
    text = re.sub(r"^\s*(for|offense|charge)\s*:\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^\s*the\s+crime\s+of\s+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^\s*crime\s+of\s+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^\s*violation\s+of\b", "Violation of", text, flags=re.IGNORECASE)
    text = re.sub(r"^\s*section\b", "Section", text, flags=re.IGNORECASE)
    text = re.sub(r"^\s*article\b", "Article", text, flags=re.IGNORECASE)

    # cut obvious trailing non-offense content
    text = re.sub(r"\bcommitted\s+as\s+follows\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bpenalized\s+under\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bcontrary\s+to\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bunder\s+the\s+following\s+circumstances\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bherein\s+referred\s+to\b.*$", "", text, flags=re.IGNORECASE)

    text = re.sub(r"\bcomplainant\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\brespondents?\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\baccused\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bplaintiff\b.*$", "", text, flags=re.IGNORECASE)

    # remove trailing all-caps person names accidentally attached to offense
    text = re.sub(
        r"\s+[A-Z][A-Z]+(?:\s+[A-Z][A-Z.\-']+){1,5}\s*$",
        "",
        text
    ).strip()

    # remove trailing title-case person names only if they look like actual people,
    # not legal phrases like "Revised Penal Code"
    trailing_match = re.search(
        r"(\s+[A-Z][a-z]+(?:\s+[A-Z][a-z.\-']+){1,5})\s*$",
        text
    )
    if trailing_match:
        trailing_value = trailing_match.group(1).strip()
        trailing_low = trailing_value.lower()

        legal_phrase_exceptions = {
            "revised penal code",
            "penal code",
            "republic act",
        }

        if trailing_low not in legal_phrase_exceptions:
            maybe_name = clean_extracted_person(trailing_value) or clean_party_name(trailing_value)
            if maybe_name:
                text = text[:trailing_match.start()].strip()

    # repair common truncated legal phrases
    text = re.sub(
        r"\bof the Revised\s*$",
        "of the Revised Penal Code",
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r"\bof the Revised Penal\s*$",
        "of the Revised Penal Code",
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r"\bRevised\s*$",
        "Revised Penal Code",
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r"\bRevised Penal\s*$",
        "Revised Penal Code",
        text,
        flags=re.IGNORECASE
    )
    text = re.sub(
        r"\brevised penal code\b",
        "Revised Penal Code",
        text,
        flags=re.IGNORECASE
    )

    text = normalize_whitespace(text)
    text = text.strip(" ,.;:-")

    return text if text else None


def build_case_title(complainants: list[str], respondents: list[str]):
    if complainants and respondents:
        return f"{', '.join(complainants)} VS. {', '.join(respondents)}"
    return None

def clean_person_name(value: str | None) -> str | None:
    if not value:
        return None

    value = normalize_whitespace(value)

    # remove OCR junk quotes / brackets
    value = re.sub(r"[‘’`´\[\]\(\)\|]+", " ", value)

    # collapse spaced initials like "f ." -> "F."
    value = re.sub(r"\b([A-Za-z])\s*\.\s*", lambda m: f"{m.group(1).upper()}. ", value)

    # remove isolated single lowercase OCR garbage between names
    value = re.sub(r"\b[a-z]\b", "", value)

    value = normalize_whitespace(value).strip(" ,.;:-")

    # title case only if mostly uppercase/noisy
    if value.upper() == value or sum(ch.isupper() for ch in value) >= sum(ch.islower() for ch in value):
        value = " ".join(
            part if re.fullmatch(r"[A-Z]\.", part) else part.title()
            for part in value.split()
        )

    return value or None


# =========================================================
# for INQ
# =========================================================

def extract_arrest_date(text: str):
    if not text:
        return None

    patterns = [
        r"arrested on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"apprehended on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4}),?\s+.*?(?:was arrested|was apprehended)",
        r"on\s+(\d{1,2}/\d{1,2}/\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            normalized = normalize_date(match.group(1))
            if normalized:
                return normalized

    return None


def extract_arrest_time(text: str):
    if not text:
        return None

    patterns = [
        r"at around\s+(\d{1,2}:\d{2}\s*[APMapm]{2})",
        r"at about\s+(\d{1,2}:\d{2}\s*[APMapm]{2})",
        r"at\s+(\d{1,2}:\d{2}\s*[APMapm]{2})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return normalize_whitespace(match.group(1))

    return None


def extract_arrest_place(text: str):
    if not text:
        return None

    patterns = [
        r"arrested at\s+(.+?)(?:\.|\n)",
        r"apprehended at\s+(.+?)(?:\.|\n)",
        r"arrested in\s+(.+?)(?:\.|\n)",
        r"apprehended in\s+(.+?)(?:\.|\n)",
        r"committed at\s+(.+?)(?:\.|\n)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            value = normalize_whitespace(match.group(1))
            if value and len(value) >= 4:
                return value.strip(" ,.;:-")

    return None


def extract_arresting_officers(text: str):
    if not text:
        return []

    officers = []

    patterns = [
        r"(PO\d+\s+[A-Z][A-Za-z\.\s'\-]+)",
        r"(SPO\d+\s+[A-Z][A-Za-z\.\s'\-]+)",
        r"(PS[SgTt\.]*\s+[A-Z][A-Za-z\.\s'\-]+)",
        r"(Police Officer\s+\d+\s+[A-Z][A-Za-z\.\s'\-]+)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            value = normalize_whitespace(match.group(1))
            if value:
                officers.append(value)

    return dedupe_preserve_order(officers)


def extract_warrantless_arrest_basis(text: str):
    if not text:
        return None

    upper = text.upper()

    if "IN FLAGRANTE" in upper or "IN HIS PRESENCE" in upper or "IN HER PRESENCE" in upper:
        return "in_flagrante"

    if "HOT PURSUIT" in upper:
        return "hot_pursuit"

    if "ESCAPED PRISONER" in upper or "ESCAPEE" in upper:
        return "escapee"

    return None


def extract_inquest_referral_date(text: str):
    if not text:
        return None

    patterns = [
        r"([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()
        if len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized
        elif len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized

    return None


def extract_affidavit_of_arrest_respondents(text: str):
    respondents = []

    patterns = [
        r"\barrested\s+([A-Z][A-Z\s\.\-']{4,}?)(?:,|\n|\.| was\b| who\b| on\b| at\b)",
        r"\bapprehended\s+([A-Z][A-Z\s\.\-']{4,}?)(?:,|\n|\.| was\b| who\b| on\b| at\b)",
        r"\bsuspect\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,}?)(?:,|\n|\.|$)",
        r"\brespondent\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,}?)(?:,|\n|\.|$)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            value = clean_extracted_person(match.group(1))
            if value:
                respondents.append(value)

    return dedupe_preserve_order(respondents)


def extract_affidavit_of_arrest_date(text: str):
    return extract_arrest_date(text)


def extract_affidavit_of_arrest_time(text: str):
    return extract_arrest_time(text)


def extract_affidavit_of_arrest_place(text: str):
    return extract_arrest_place(text)


def extract_affidavit_of_arrest_officers(text: str):
    return extract_arresting_officers(text)


def extract_affidavit_of_arrest_basis(text: str):
    return extract_warrantless_arrest_basis(text)


def extract_affidavit_of_arrest_offense(text: str):
    value, _ = extract_offense(text, document_type="information")
    return value


def extract_police_report_respondents(text: str):
    respondents = []

    patterns = [
        r"\bsuspect[s]?\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
        r"\brespondent[s]?\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
        r"\barrested\s+([A-Z][A-Z\s\.\-']{4,}?)(?:,|\n|\.| was\b| who\b| on\b| at\b)",
        r"\bapprehended\s+([A-Z][A-Z\s\.\-']{4,}?)(?:,|\n|\.| was\b| who\b| on\b| at\b)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            block = normalize_whitespace(match.group(1))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part)
                if value:
                    respondents.append(value)

    return dedupe_preserve_order(respondents)


def extract_police_report_complainants(text: str):
    complainants = []

    patterns = [
        r"\bcomplainant[s]?\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
        r"\bvictim[s]?\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
        r"\boffended party\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            block = normalize_whitespace(match.group(1))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part)
                if value:
                    complainants.append(value)

    return dedupe_preserve_order(complainants)


def extract_police_report_offense(text: str):
    value, _ = extract_offense(text, document_type="information")
    return value


#INQ OFFENSE WRAPPER

def extract_affidavit_of_arrest_offense(text: str):
    value, _ = extract_offense(text, document_type="information")
    return value


def extract_police_report_offense(text: str):
    value, _ = extract_offense(text, document_type="information")
    return value


def extract_referral_letter_offense(text: str):
    value, _ = extract_offense(text, document_type="information")
    return value



def extract_referral_letter_respondents(text: str):
    respondents = []

    patterns = [
        r"\bagainst\s+([A-Z][A-Z\s\.\-']{4,}?)(?:,|\n|\.| for\b)",
        r"\brespondent[s]?\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
        r"\bsuspect[s]?\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            block = normalize_whitespace(match.group(1))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part)
                if value:
                    respondents.append(value)

    return dedupe_preserve_order(respondents)


def extract_referral_letter_complainants(text: str):
    complainants = []

    patterns = [
        r"\bcomplainant[s]?\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
        r"\boffended party\s*[:\-]?\s*([A-Z][A-Z\s\.\-']{4,})(?:\n|$)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            block = normalize_whitespace(match.group(1))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part)
                if value:
                    complainants.append(value)

    return dedupe_preserve_order(complainants)


def extract_referral_letter_offense(text: str):
    value, _ = extract_offense(text, document_type="information")
    return value


def extract_referral_letter_date(text: str):
    return extract_inquest_referral_date(text)



# =========================================================
# Docket / case number
# =========================================================

def is_valid_docket_number(value: str) -> bool:
    if not value:
        return False

    value = normalize_whitespace(value).strip(" ,.;:-")
    upper = value.upper()

    bad_values = {
        "VERSUS",
        "VS",
        "VS.",
        "NO",
        "N0",
        "RESPONDENT",
        "RESPONDENTS",
        "COMPLAINANT",
    }

    if upper in bad_values:
        return False

    if not re.search(r"\d", value):
        return False

    return bool(re.match(r"^[A-Za-z0-9\-/]+$", value))


def extract_docket_number(text: str):
    value = extract_first_match(DOCKET_PATTERNS, text)
    if value:
        cleaned = normalize_whitespace(value)
        if cleaned and is_valid_docket_number(cleaned):
            return cleaned, confidence_found(True)

    caption = "\n".join(get_caption_lines(text, max_lines=25))
    fallback_patterns = [
        r"\b[IL]\.?\s*S\.?\s*NO\.?\s*([A-Za-z0-9\-/]+)",
        r"\b[IL]S\.?\s*NO\.?\s*([A-Za-z0-9\-/]+)",
        r"\bNPS\s+DOCKET\s+NO\.?\s*([A-Za-z0-9\-/]+)",
    ]

    for pattern in fallback_patterns:
        match = re.search(pattern, caption, re.IGNORECASE)
        if match:
            cleaned = normalize_whitespace(match.group(1))
            if cleaned and is_valid_docket_number(cleaned):
                return cleaned, confidence_found(False)

    return None, confidence_missing()


def extract_case_number(text: str):
    value = extract_first_match(CASE_NUMBER_PATTERNS, text)
    if value:
        return normalize_whitespace(value), confidence_found(True)

    lines = text.splitlines()
    for i, line in enumerate(lines[:-1]):
        current = line.strip()
        nxt = lines[i + 1].strip()

        if re.search(r"(criminal|crim\.?|case)\s+case?\s*no\.?$", current, re.IGNORECASE) or re.search(
            r"case\s+no\.?$", current, re.IGNORECASE
        ):
            if nxt and re.match(r"^[A-Za-z0-9\-/]+$", nxt):
                return normalize_whitespace(nxt), confidence_found(False)

    return None, confidence_missing()


def extract_information_case_number(text: str):
    patterns = [
        r"CRIMINAL\s+CASE\s+NO\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
        r"Criminal\s+Case\s+No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
        r"CRIM\.?\s*CASE\s*NO\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
        r"Crim\.?\s*Case\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
        r"CASE\s+NO\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
    ]

    searchable = "\n".join(get_caption_lines(text, max_lines=35))

    def is_valid_case_number(value: str) -> bool:
        if not value:
            return False

        value = normalize_whitespace(value).strip(" ,.;:-").replace(".", "-")

        bad_values = {"NO", "N0", "CASE", "CRIM", "CRIMINAL"}
        if value.upper() in bad_values:
            return False

        if len(value) < 4:
            return False

        if not re.search(r"\d", value):
            return False

        return bool(re.match(r"^[A-Za-z0-9\-/]+$", value))

    for pattern in patterns:
        match = re.search(pattern, searchable, re.IGNORECASE)
        if match:
            value = normalize_whitespace(match.group(1)).replace(".", "-")
            if is_valid_case_number(value):
                return value

    # fallback: multiline "CASE NO." then next line value
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for i, line in enumerate(lines[:-1]):
        if re.search(r"(criminal\s+case|crim\.?\s*case|case)\s*no\.?$", line, re.IGNORECASE):
            nxt = lines[i + 1].strip(" ,.;:-")
            nxt = nxt.replace(".", "-")
            if is_valid_case_number(nxt):
                return nxt

    return None


# =========================================================
# Offense extraction
# =========================================================

def extract_counter_affidavit_offense(text: str):
    candidates = []

    patterns = [
        r"\bcase\s+for\s+(.+?)(?:\.|\n)",
        r"\bcomplaint\s+for\s+(.+?)(?:\.|\n)",
        r"\bcharged\s+with\s+(.+?)(?:\.|\n)",
        r"\bfor\s+(Violation\s+of\s+.+?)(?:\.|\n)",
        r"\bfor\s+([A-Z][A-Za-z0-9 ,.\-()]+?under\s+Article\s+\d+[A-Za-z0-9 ,.\-()]*)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            candidates.append(match.group(1))

    return choose_best_offense_candidate(candidates)

def extract_caption_offense(lines: list[str], max_scan: int = 35):
    def clean_fragment(line: str) -> str:
        if not line:
            return ""

        value = line.strip()
        value = re.sub(r'^[\"\'“”‘’`~\-\–—,:.;=\s]+', "", value).strip()

        if re.fullmatch(r"(versus|vs\.?|v\.|=)", value, re.IGNORECASE):
            return ""

        return value

        

    def looks_like_party_name_line(line: str) -> bool:
        candidate = clean_extracted_person(line) or clean_party_name(line)
        return bool(candidate)

    def stop_line(line: str) -> bool:
        low = line.lower().strip()
        if not low:
            return True

        stop_markers = [
            "complainant",
            "respondent",
            "respondents",
            "plaintiff",
            "accused",
            "resolution",
            "information",
            "order",
            "counter-affidavit",
            "complaint-affidavit",
            "docket no.",
            "docket number",
            "i.s. no.",
            "is no.",
        ]

        if any(marker in low for marker in stop_markers):
            return True

        # do not stop if clearly legal continuation
        if looks_like_legal_continuation(line):
            return False

        # stop if this now looks like a person line
        if looks_like_party_name_line(line):
            return True

        return False

    for i, line in enumerate(lines[:max_scan]):
        if re.search(r"^\s*FOR\s*:", line, re.IGNORECASE):
            first = re.sub(r"^\s*FOR\s*:\s*", "", line, flags=re.IGNORECASE).strip()
            collected = []

            cleaned_first = clean_fragment(first)
            if cleaned_first:
                collected.append(cleaned_first)

            for j in range(i + 1, min(i + 8, len(lines))):
                nxt = clean_fragment(lines[j])
                if not nxt:
                    continue

                if stop_line(nxt):
                    break

                collected.append(nxt)

            print("RESOLUTION/CAPTION OFFENSE COLLECTED:", collected)
            value = normalize_whitespace(" ".join(collected))
            value = normalize_legal_text(value)
            if value:
                return value

    return None

def extract_offense(text: str, document_type: str | None = None):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    caption_offense = extract_caption_offense(lines)

    # 1. for caption-based legal docs, prioritize FOR: / caption offense first
    if document_type in {"resolution", "subpoena", "information", "order", "judgment", "notice_of_appeal", "entry_of_judgment"}:
        if caption_offense:
            return caption_offense, confidence_found(True)

    # 2. affidavit-specific body offense only for affidavit docs
    if document_type in {"complaint_affidavit", "counter_affidavit"}:
        affidavit_offense = extract_affidavit_body_offense(text)
        if affidavit_offense:
            return affidavit_offense, confidence_found(False)

    # 3. "accuses ... of ..." pattern, useful for information
    body_patterns = [
        r"accuses\s+.+?\s+of\s+(violation\s+of\s+.+?)\s+committed\s+as\s+follows",
        r"accuses\s+.+?\s+of\s+(.+?)\s+committed\s+as\s+follows",
        r"accused\s+of\s+(violation\s+of\s+.+?)(?:\.|\n)",
        r"accused\s+of\s+(.+?)(?:\.|\n)",
    ]

    joined_text = "\n".join(lines[:100])

    for pattern in body_patterns:
        match = re.search(pattern, joined_text, re.IGNORECASE | re.DOTALL)
        if match:
            value = normalize_legal_text(match.group(1))
            if value:
                return value, confidence_found(False)

    # 4. generic FOR: block fallback for any remaining doc
    for i, line in enumerate(lines[:35]):
        if re.search(r"^\s*FOR\s*:", line, re.IGNORECASE):
            first = re.sub(r"^\s*FOR\s*:\s*", "", line, flags=re.IGNORECASE).strip()
            collected = [first] if first else []

            for j in range(i + 1, min(i + 8, len(lines))):
                nxt = lines[j].strip()
                if not nxt:
                    break

                low = nxt.lower()

                if any(marker in low for marker in [
                    "complainant", "respondent", "respondents", "plaintiff", "accused",
                    "resolution", "information", "order", "counter-affidavit", "complaint-affidavit"
                ]):
                    break

                # stop if obvious docket/caption metadata
                if any(marker in low for marker in [
                    "docket no.", "docket number", "i.s. no.", "is no.", "case no."
                ]):
                    break

                collected.append(nxt)

            value = choose_best_offense_candidate([" ".join(collected)])
            if value:
                return value, confidence_found(True)

    # 5. direct caption offense helper fallback
    if caption_offense:
        return caption_offense, confidence_found(True)

    # 6. generic labeled line fallback
    for line in lines[:40]:
        if re.search(r"\b(offense|violation)\b", line, re.IGNORECASE):
            value = normalize_legal_text(line.split(":")[-1].strip())
            if value:
                return value, confidence_found(False)

    return None, confidence_missing()

def extract_commitment_order_result(text: str):
    if not text:
        return None, None

    upper_text = text.upper()

    commitment_markers = [
        "COMMITMENT ORDER",
        "COMMIT THE ACCUSED",
        "HEREBY COMMITTED",
        "TO THE CUSTODY OF",
        "CITY JAIL",
        "PROVINCIAL JAIL",
        "BJMP",
        "COMMITMENT TO JAIL",
    ]

    if any(marker in upper_text for marker in commitment_markers):
        return "committed", "committed"

    return None, None


# =========================================================
# Generic party extraction
# =========================================================

def extract_parties(text: str, document_type: str | None = None):
    complainants = []
    respondents = []

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    if document_type in [
        "complaint_affidavit",
        "counter_affidavit",
        "resolution",
        "information",
        "order",
        "judgment",
        "notice_of_appeal",
        "entry_of_judgment",
    ]:
        caption_lines = lines[:20]

        for i, line in enumerate(caption_lines):
            low = line.lower()

            if "complainant" in low and i > 0:
                candidate_lines = []
                for j in range(max(0, i - 3), i):
                    val = clean_party_name(caption_lines[j].strip(" ,.;:-"))
                    if val:
                        candidate_lines.append(val)

                possible = join_name_lines(candidate_lines)
                if possible:
                    complainants.append(possible)

            elif "plaintiff" in low and i > 0:
                possible = clean_party_name(caption_lines[i - 1].strip(" ,.;:-"))
                if possible:
                    complainants.append(possible)

        joined_caption = "\n".join(caption_lines).upper()
        if "PEOPLE OF THE PHILIPPINES" in joined_caption:
            complainants.append("PEOPLE OF THE PHILIPPINES")

        respondent_block = []
        collecting_respondents = False

        for line in caption_lines:
            upper_line = line.upper()

            if "VERSUS" in upper_line or "-VERSUS-" in upper_line or "VS." in upper_line:
                collecting_respondents = True
                continue

            if not collecting_respondents:
                continue

            if "RESPONDENT" in upper_line or "ACCUSED" in upper_line:
                break

            if upper_line.startswith("FOR:"):
                continue

            if "I.S. NO." in upper_line or "CASE NO." in upper_line or "CRIMINAL CASE NO." in upper_line:
                continue

            respondent_block.append(line)

        if respondent_block:
            respondent_text = normalize_whitespace(" ".join(respondent_block))
            respondent_text = re.sub(r"\bPage\s+\d+\s+of\s+\d+\b", "", respondent_text, flags=re.IGNORECASE)
            respondent_text = re.sub(r"\bunder\s+the\s+Revised\s+Penal\s+Code\b", "", respondent_text, flags=re.IGNORECASE)
            respondent_text = re.sub(r"\bFor:\s*.*$", "", respondent_text, flags=re.IGNORECASE)
            respondent_text = respondent_text.strip(" ,.;:-")

            parts = re.split(r",|\band\b|&", respondent_text, flags=re.IGNORECASE)
            for p in parts:
                value = clean_party_name(p.strip(" ,.;:-"))
                if value:
                    respondents.append(value)

        complainants = list(dict.fromkeys([c for c in complainants if c]))
        respondents = list(dict.fromkeys([r for r in respondents if r]))

    return complainants, respondents


# =========================================================
# Resolution
# =========================================================

def extract_resolution_complainants(text: str):
    lines = get_caption_lines(text, max_lines=35)
    complainants = []

    complainant_idx = None
    for i, line in enumerate(lines):
        if re.fullmatch(r"complainant,?", line, re.IGNORECASE):
            complainant_idx = i
            break

    if complainant_idx is not None:
        candidate_lines = []

        for j in range(max(0, complainant_idx - 6), complainant_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if not raw:
                continue

            if any(marker in low for marker in [
                "republic of the philippines",
                "department of justice",
                "office of the city prosecutor",
                "office of the provincial prosecutor",
                "office of the prosecutor",
                "resolution",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "docket no.",
                "docket number",
                "i.s. no.",
                "is no.",
            ]):
                continue

            raw = re.sub(
                r",?\s*Docket\s+Number\s*[:\-]?\s*[A-Za-z0-9\-/]+.*$",
                "",
                raw,
                flags=re.IGNORECASE,
            ).strip(" ,.;:-")

            value = clean_extracted_person(raw) or clean_party_name(raw)
            if value:
                candidate_lines.append(value)

        possible = join_name_lines(candidate_lines)
        possible = clean_extracted_person(possible) or clean_party_name(possible)
        if possible:
            complainants.append(possible)

    return dedupe_preserve_order(complainants)

def extract_resolution_respondents(text: str):
    lines = get_caption_lines(text, max_lines=45)
    respondents = []

    respondent_idx = None
    for i, line in enumerate(lines):
        if re.fullmatch(r"respondents?\.?,?", line, re.IGNORECASE):
            respondent_idx = i
            break

    if respondent_idx is not None:
        candidate_lines = []

        for j in range(max(0, respondent_idx - 5), respondent_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if not raw:
                continue

            if any(marker in low for marker in [
                "resolution",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "i.s. no.",
                "is no.",
                "docket no.",
                "docket number",
                "complainant",
                "department of justice",
                "office of the city prosecutor",
                "office of the provincial prosecutor",
                "office of the prosecutor",
                "republic of the philippines",
            ]):
                continue

            # skip if exact same as already-known complainant-looking line
            candidate_lines.append(raw)

        if candidate_lines:
            # IMPORTANT: prefer nearest non-empty line before Respondent label
            for raw in reversed(candidate_lines):
                value = clean_extracted_person(raw) or clean_party_name(raw)
                if value:
                    respondents.append(value)
                    break

    # fallback: block between VERSUS and Respondent
    if not respondents:
        caption_text = "\n".join(lines)
        match = re.search(
            r"(?:VERSUS|VS\.?)\s*\n(.+?)\n\s*Respondents?\.?",
            caption_text,
            re.IGNORECASE | re.DOTALL
        )
        if match:
            block = match.group(1)
            block_lines = [ln.strip() for ln in block.splitlines() if ln.strip()]

            for raw in reversed(block_lines):
                low = raw.lower()
                if any(marker in low for marker in [
                    "docket no.", "docket number", "i.s. no.", "is no.", "for:"
                ]):
                    continue

                value = clean_extracted_person(raw) or clean_party_name(raw)
                if value:
                    respondents.append(value)
                    break

    return dedupe_preserve_order(respondents)

def extract_resolution_result(text: str):
    if not text:
        return None, None

    upper_text = text.upper()

    negative_markers = [
        "NO PROBABLE CAUSE",
        "WITHOUT PROBABLE CAUSE",
        "LACK OF PROBABLE CAUSE",
        "COMPLAINT IS DISMISSED",
        "CASE IS DISMISSED",
        "HEREBY DISMISSED",
        "RECOMMENDED FOR DISMISSAL",
        "DISMISSED FOR LACK OF MERIT",
        "DISMISSED FOR INSUFFICIENCY OF EVIDENCE",
    ]

    positive_markers = [
        "THERE IS PROBABLE CAUSE",
        "THERE EXISTS PROBABLE CAUSE",
        "FINDS PROBABLE CAUSE",
        "RESPONDENT SHOULD BE INDICTED",
        "RESPONDENTS SHOULD BE INDICTED",
        "BE INDICTED",
        "BE CHARGED IN COURT",
        "FOR FILING IN COURT",
        "AN INFORMATION BE FILED",
        "INFORMATION BE FILED",
        "LET THE CORRESPONDING INFORMATION BE FILED",
        "LET THE INFORMATION BE FILED",
    ]

    reinvestigation_markers = [
        "FOR REINVESTIGATION",
        "REINVESTIGATION",
        "RE-INVESTIGATION",
        "FURTHER INVESTIGATION",
        "FOR FURTHER INVESTIGATION",
        "REFERRED FOR FURTHER INVESTIGATION",
    ]

    # priority: WHEREFORE / dispositive portion
    wherefore_match = re.search(
        r"WHEREFORE,?(.*?)(?:SO ORDERED\.|RESPECTFULLY SUBMITTED\.|$)",
        upper_text,
        re.IGNORECASE | re.DOTALL
    )
    dispositive_text = wherefore_match.group(1) if wherefore_match else upper_text

    for marker in negative_markers:
        if marker in dispositive_text:
            return "no_probable_cause", "dismissed"

    for marker in positive_markers:
        if marker in dispositive_text:
            return "with_probable_cause", "for_filing"

    for marker in reinvestigation_markers:
        if marker in dispositive_text:
            return None, "for_reinvestigation"

    # fallback: whole text
    for marker in negative_markers:
        if marker in upper_text:
            return "no_probable_cause", "dismissed"

    for marker in positive_markers:
        if marker in upper_text:
            return "with_probable_cause", "for_filing"

    for marker in reinvestigation_markers:
        if marker in upper_text:
            return None, "for_reinvestigation"

    return None, None


def extract_resolution_date(text: str):
    if not text:
        return None, confidence_missing()

    patterns = [
        r"Butuan\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Cebu\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Quezon\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Panglao,\s*Bohol,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b\s*\n\s*(?:PROSECUTOR\s+)?[A-Z][A-Z\s\.\-']+\n\s*(?:Assistant|Associate|City|Provincial)\s+Prosecutor",
        r"\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b",
    ]

    for idx, pattern in enumerate(patterns):
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()
        if len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized, confidence_found(idx < 6)

        elif len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized, confidence_found(True)

    return None, confidence_missing()


def extract_resolution_date_value(text: str):
    value, _ = extract_resolution_date(text)
    return value


def extract_resolution_prosecutor(text: str):
    if not text:
        return None

    lines = [normalize_whitespace(line).strip(" ,.;:-") for line in text.splitlines() if line.strip()]

    title_patterns = [
        r"Assistant Provincial Prosecutor",
        r"Assistant City Prosecutor",
        r"Associate City Prosecutor",
        r"Provincial Prosecutor",
        r"City Prosecutor",
    ]

    for i, line in enumerate(lines):
        for title in title_patterns:
            if re.fullmatch(title, line, re.IGNORECASE):
                if i > 0:
                    candidate = lines[i - 1]
                    candidate = re.sub(r"^\s*PROSECUTOR\s+", "", candidate, flags=re.IGNORECASE).strip()
                    candidate = clean_extracted_person(candidate) or clean_party_name(candidate)
                    if candidate:
                        return candidate

    return None

def page_still_belongs_to_resolution(text: str) -> bool:
    if not text:
        return False

    upper = text.upper()
    continuation_markers = [
        "WHEREFORE",
        "BE INDICTED",
        "RESPECTFULLY RECOMMENDED",
        "ASSISTANT PROVINCIAL PROSECUTOR",
        "ASSISTANT CITY PROSECUTOR",
        "PROVINCIAL PROSECUTOR",
        "CITY PROSECUTOR",
        "APPROVED:",
        "SO ORDERED",
        "PANGLAO, BOHOL",
    ]
    return any(marker in upper for marker in continuation_markers)


# =========================================================
# Information
# =========================================================

def extract_information_offense(text: str):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    candidates = []

    # priority: FOR: caption block
    for i, line in enumerate(lines[:35]):
        if re.search(r"^\s*FOR\s*:", line, re.IGNORECASE):
            first = re.sub(r"^\s*FOR\s*:\s*", "", line, flags=re.IGNORECASE).strip()
            collected = [first] if first else []

            for j in range(i + 1, min(i + 10, len(lines))):
                nxt = lines[j].strip()
                if not nxt:
                    continue

                low = nxt.lower()

                if any(marker in low for marker in [
                    "accused",
                    "complainant",
                    "plaintiff",
                    "criminal case no.",
                    "crim. case no.",
                    "case no.",
                    "information",
                    "people of the philippines",
                ]):
                    break

                if any(marker in low for marker in [
                    "docket no.", "docket number", "i.s. no.", "is no."
                ]):
                    break

                if looks_like_legal_continuation(nxt):
                    collected.append(nxt)
                    continue

                maybe_name = clean_extracted_person(nxt) or clean_party_name(nxt)
                if maybe_name:
                    break

                collected.append(nxt)

            value = normalize_legal_text(" ".join(collected))
            if value:
                candidates.append(value)

    # body fallback
    body_patterns = [
        r"accuses\s+.+?\s+of\s+(violation\s+of\s+.+?)\s+committed\s+as\s+follows",
        r"accuses\s+.+?\s+of\s+(.+?)\s+committed\s+as\s+follows",
        r"for\s+(Violation\s+of\s+.+?)(?:\.|\n)",
    ]

    for pattern in body_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            value = normalize_legal_text(match.group(1))
            if value:
                candidates.append(value)

    if not candidates:
        return None

    candidates = [c for c in candidates if c]
    candidates.sort(key=lambda x: (x.lower().endswith("revised penal code"), len(x)), reverse=True)
    return candidates[0]

def extract_information_complainants(text: str):
    upper_text = text.upper()
    strong_markers = [
        "PEOPLE OF THE PHILIPPINES",
        "PEOPLE OF PHS",
        "PULP PINES",
        "PULP PHINES",
        "PHILIPPINES",
    ]

    if any(marker in upper_text for marker in strong_markers):
        return ["PEOPLE OF THE PHILIPPINES"]

    return []


def extract_information_respondents(text: str):
    respondents = []

    if not text:
        return respondents

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    # -------------------------------------------------
    # First choice: extract caption block between VERSUS and ACCUSED
    # -------------------------------------------------
    start_idx = None
    end_idx = None

    for i, line in enumerate(lines[:30]):
        upper = line.upper()
        if "VERSUS" in upper or "-VERSUS-" in upper or re.fullmatch(r"VS\.?", upper):
            start_idx = i + 1
            continue

        if start_idx is not None and re.search(r"\bACCUSED\b", line, re.IGNORECASE):
            end_idx = i
            break

    if start_idx is not None and end_idx is not None and start_idx < end_idx:
        candidate_lines = []

        for raw in lines[start_idx:end_idx]:
            low = raw.lower()

            if (
                "for:" in low
                or "revised penal code" in low
                or "page " in low
                or "i.s. no." in low
                or "is. no." in low
                or "is no." in low
                or "criminal case no." in low
                or "case no." in low
            ):
                continue

            raw = re.sub(r"\bunder the revised penal code\b", "", raw, flags=re.IGNORECASE).strip(" ,.;:-")
            if raw:
                candidate_lines.append(raw)

        if candidate_lines:
            block = normalize_whitespace(" ".join(candidate_lines))
            parts = re.split(r"\s*,\s*|\s+\band\b\s+|\s*&\s*", block, flags=re.IGNORECASE)

            caption_respondents = []
            for part in parts:
                value = clean_party_name(part)
                if value:
                    split_values = split_joined_party_chunk(value)
                    for sv in split_values:
                        cleaned_sv = clean_party_name(sv)
                        if cleaned_sv:
                            caption_respondents.append(cleaned_sv)

            caption_respondents = list(dict.fromkeys(caption_respondents))

            # trust caption over body OCR if it looks usable
            if caption_respondents:
                return caption_respondents

    # -------------------------------------------------
    # Fallback: extract from accusation sentence
    # -------------------------------------------------
    body_patterns = [
        r"accuses\s+(.+?)\s+of\s+the\s+crime\b",
        r"accuses\s+(.+?)\s+of\s+violation\b",
        r"accuses\s+(.+?)\s+committed\s+as\s+follows\b",
    ]

    for pattern in body_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            block = normalize_whitespace(match.group(1))
            parts = re.split(r"\s*,\s*|\s+\band\b\s+|\s*&\s*", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_party_name(part)
                if value:
                    respondents.append(value)

            respondents = list(dict.fromkeys(respondents))
            if respondents:
                return respondents

    return respondents

def extract_filed_in_court_date(text: str):
    if not text:
        return None

    # normalize common OCR issue first: Ist -> 1st
    working = text
    working = re.sub(r"\b[I|l|L]st\b", "1st", working, flags=re.IGNORECASE)
    working = re.sub(r"\b[I|l|L]nd\b", "1nd", working, flags=re.IGNORECASE)
    working = re.sub(r"\b[I|l|L]rd\b", "1rd", working, flags=re.IGNORECASE)
    working = re.sub(r"\b[I|l|L]th\b", "1th", working, flags=re.IGNORECASE)

    patterns = [
        r"SUBSCRIBED\s+AND\s+SWORN\s+to\s+before\s+me\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"SUBSCRIBED\s+AND\s+SWORN\s+TO\s+before\s+me\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"before\s+me\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})\s+in\s+Butuan\s+City",
        r"Butuan\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+20\d{2})",
        r"Cebu\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+20\d{2})",
        r"Quezon\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+20\d{2})",
    ]

    for pattern in patterns:
        match = re.search(pattern, working, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()

        if len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized

        elif len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized

    return None

def correct_information_date_year(
    extracted_date: str | None,
    text: str,
    case_number: str | None = None,
) -> tuple[str | None, list[str]]:
    review_flags = []

    if not extracted_date or len(extracted_date) < 10:
        return extracted_date, review_flags

    year = extracted_date[:4]
    month_day = extracted_date[5:]
    candidate_years = {}

    for match in re.findall(r"\b(20\d{2})\b", text):
        candidate_years[match] = candidate_years.get(match, 0) + 1

    if case_number:
        case_year_match = re.match(r"^(20\d{2})[-/]", case_number)
        if case_year_match:
            case_year = case_year_match.group(1)
            candidate_years[case_year] = candidate_years.get(case_year, 0) + 2

    sworn_patterns = [
        r"SUBSCRIBED\s+AND\s+SWORN.*?\b(20\d{2})\b",
        r"before me this .*?\b(20\d{2})\b",
        r"Butuan City,\s*Philippines\.\s*\(?[A-Z]?\s*\b(20\d{2})\b",
    ]
    for pattern in sworn_patterns:
        for match in re.findall(pattern, text, re.IGNORECASE | re.DOTALL):
            candidate_years[match] = candidate_years.get(match, 0) + 2

    if not candidate_years:
        return extracted_date, review_flags

    dominant_year, dominant_score = max(candidate_years.items(), key=lambda x: x[1])

    if dominant_year != year and dominant_score >= 2:
        corrected_date = f"{dominant_year}-{month_day}"
        review_flags.append("possible_ocr_year_error_on_information_date")
        review_flags.append("filed_in_court_date_corrected_from_same_document_context")
        return corrected_date, review_flags

    return extracted_date, review_flags


def extract_information_prosecutor(text: str):
    if not text:
        return None

    lines = [normalize_whitespace(line).strip() for line in text.splitlines() if line.strip()]

    title_priority = [
        r"Assistant Provincial Prosecutor",
        r"Senior Assistant Provincial Prosecutor",
        r"Assistant City Prosecutor",
        r"Associate City Prosecutor",
        r"City Prosecutor",
        r"Provincial Prosecutor",
    ]

    for title in title_priority:
        for i, line in enumerate(lines):
            if re.fullmatch(title, line, re.IGNORECASE):
                if i > 0:
                    candidate = lines[i - 1]
                    candidate = re.sub(r"^\s*PROSECUTOR\s+", "", candidate, flags=re.IGNORECASE).strip()
                    candidate = re.sub(r"^[^A-Z]*(?=[A-Z])", "", candidate).strip()
                    candidate = clean_party_name(candidate)
                    candidate = clean_person_name(candidate)

                    if candidate:
                        return candidate

    return None

def extract_information_date_from_signature(text: str):
    if not text:
        return None

    working = text
    working = re.sub(r"\b[I|l|L]st\b", "1st", working, flags=re.IGNORECASE)
    working = re.sub(r"\b[I|l|L]nd\b", "1nd", working, flags=re.IGNORECASE)
    working = re.sub(r"\b[I|l|L]rd\b", "1rd", working, flags=re.IGNORECASE)
    working = re.sub(r"\b[I|l|L]th\b", "1th", working, flags=re.IGNORECASE)

    patterns = [
        r"SUBSCRIBED\s+AND\s+SWORN\s+to\s+before\s+me\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"SUBSCRIBED\s+AND\s+SWORN\s+TO\s+before\s+me\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"before\s+me\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"Butuan\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+20\d{2})",
    ]

    for pattern in patterns:
        match = re.search(pattern, working, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()

        if len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized

        elif len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized

    return None


# =========================================================
# Complaint affidavit
# =========================================================

def extract_complaint_affidavit_complainants(text: str):
    complainants = []
    body_text = get_affidavit_body_only(text)

    # primary: body intro
    body_name = extract_affidavit_body_complainant(body_text)
    if body_name:
        complainants.append(body_name)

    # caption fallback
    lines = get_caption_lines(body_text, max_lines=35)
    complainant_idx = None

    for i, line in enumerate(lines):
        if re.fullmatch(r"complainant,?", line, re.IGNORECASE) or re.fullmatch(r"complainant-affiant,?", line, re.IGNORECASE):
            complainant_idx = i
            break

    if complainant_idx is not None:
        candidate_lines = []

        for j in range(max(0, complainant_idx - 5), complainant_idx):
            line = lines[j].strip()
            lower = line.lower()

            if (
                "i.s. no." in lower
                or "is no." in lower
                or "nps docket no." in lower
                or "for:" in lower
                or "versus" in lower
                or "-versus-" in lower
                or "vs." in lower
                or "revised penal code" in lower
                or "article " in lower
                or "violation of" in lower
            ):
                continue

            candidate_lines.append(line)

        possible = join_name_lines(candidate_lines)
        possible = clean_extracted_person(possible)
        if possible:
            complainants.append(possible)

    # signature fallback
    signature_match = re.search(
        r"\n([A-Z][A-Z\s\.\-']{4,})\n\s*Complainant-Affiant\b",
        text,
        re.IGNORECASE
    )
    if signature_match:
        candidate = clean_extracted_person(signature_match.group(1))
        if candidate:
            complainants.append(candidate)

    # entity fallback
    if not complainants:
        complainants.extend(
            find_persons_near_keywords(
                body_text[:1500],
                ["filipino", "of legal age", "complainant", "duly sworn"]
            )
        )

    return dedupe_preserve_order(complainants)


def extract_complaint_affidavit_respondents(text: str):
    respondents = []
    body_text = get_affidavit_body_only(text)

    patterns = [
        r"\bI\s+saw\s+([A-Z][A-Z\s\.\-']{4,}?)\s+taking\b",
        r"\bI\s+saw\s+([A-Z][A-Z\s\.\-']{4,}?)\s+steal(?:ing)?\b",
        r"\brespondent\s*,?\s*([A-Z][A-Z\s\.\-']{4,}?)(?:[,\n.]|$)",
        r"\bI\s+confronted\s+([A-Z][A-Z\s\.\-']{4,}?)(?:[,\n.]|$)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, body_text, re.IGNORECASE | re.MULTILINE):
            candidate = clean_extracted_person(match.group(1))
            if candidate:
                respondents.append(candidate)

    return list(dict.fromkeys(respondents))


def extract_complaint_affidavit_date(text: str):
    value = extract_affidavit_execution_date(text)
    if value:
        return value, confidence_found(True)

    patterns = [
        r"IN WITNESS WHEREOF.*?this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day of\s+([A-Za-z]+)\s+(\d{4})",
        r"set my hand this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day of\s+([A-Za-z]+)\s+(\d{4})",
        r"executed this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day of\s+([A-Za-z]+)\s+(\d{4})",
        r"SUBSCRIBED AND SWORN.*?this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day of\s+([A-Za-z]+)\s+(\d{4})",
        r"executed on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()
        if len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized, confidence_found(True)

        elif len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized, confidence_found(True)

    # fallback: first strong date in upper part of affidavit
    for value in extract_date_entities(text[:1800]):
        normalized = normalize_date(value)
        if normalized:
            return normalized, confidence_found(False)

    return None, confidence_missing()

# =========================================================
# Counter affidavit
# =========================================================

def extract_counter_affidavit_complainants(text: str):
    lines = get_caption_lines(text, max_lines=35)
    complainants = []

    complainant_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bComplainant\b", line, re.IGNORECASE):
            complainant_idx = i
            break

    if complainant_idx is not None:
        candidate_lines = []

        for j in range(max(0, complainant_idx - 5), complainant_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if not raw:
                continue

            if any(marker in low for marker in [
                "republic of the philippines",
                "department of justice",
                "office of the city prosecutor",
                "office of the provincial prosecutor",
                "office of the prosecutor",
                "counter-affidavit",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "docket no.",
                "i.s. no.",
                "is no.",
            ]):
                continue

            value = clean_extracted_person(raw) or clean_party_name(raw)
            if value:
                candidate_lines.append(value)

        possible = join_name_lines(candidate_lines)
        possible = clean_extracted_person(possible) or clean_party_name(possible)
        if possible:
            complainants.append(possible)

    # fallback from caption before VERSUS
    if not complainants:
        caption_text = "\n".join(lines)
        match = re.search(
            r"([A-Z][A-Z\s\.\-,'`]{4,})\s*\n\s*(?:-?\s*VERSUS\s*-?|VS\.?)",
            caption_text,
            re.IGNORECASE
        )
        if match:
            candidate = clean_extracted_person(match.group(1)) or clean_party_name(match.group(1))
            if candidate:
                complainants.append(candidate)

    if not complainants:
        complainants.extend(
            find_persons_near_keywords(text[:1200], ["complainant", "counter-affidavit", "against"])
        )

    return dedupe_preserve_order(complainants)

def extract_counter_affidavit_respondents(text: str):
    lines = get_caption_lines(text, max_lines=40)
    respondents = []

    respondent_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bRespondents?\b|\bRespondent\b", line, re.IGNORECASE):
            respondent_idx = i
            break

    if respondent_idx is not None:
        candidate_lines = []

        for j in range(max(0, respondent_idx - 6), respondent_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if not raw:
                continue

            if any(marker in low for marker in [
                "republic of the philippines",
                "department of justice",
                "office of the city prosecutor",
                "office of the provincial prosecutor",
                "office of the prosecutor",
                "counter-affidavit",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "complainant",
                "docket no.",
                "i.s. no.",
                "is no.",
            ]):
                continue

            candidate_lines.append(raw)

        if candidate_lines:
            block = normalize_whitespace(" ".join(candidate_lines))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part) or clean_party_name(part)
                if value:
                    respondents.append(value)

    # fallback: affiant intro in counter-affidavit usually respondent is the affiant
    if not respondents:
        patterns = [
            r"\bI,\s*([A-Z][A-Za-z\.\s'\-]+?),\s*Filipino\b",
            r"\bI,\s*([A-Z][A-Za-z\.\s'\-]+?),\s*of legal age\b",
            r"\bI,\s*([A-Z][A-Za-z\.\s'\-]+?),\s*after having been duly sworn\b",
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                candidate = clean_extracted_person(match.group(1))
                if candidate:
                    respondents.append(candidate)
                    break

    if not respondents:
        respondents.extend(
            find_persons_near_keywords(text[:1500], ["respondent", "counter-affidavit", "affiant"])
        )

    return dedupe_preserve_order(respondents)

def extract_counter_affidavit_date(text: str):
    patterns = [
        r"IN WITNESS WHEREOF.*?this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day of\s+([A-Za-z]+)\s+(20\d{2})",
        r"executed\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"SUBSCRIBED\s+AND\s+SWORN\s+TO.*?this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"before\s+me\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(20\d{2})",
        r"([A-Za-z]+\s+\d{1,2},\s+20\d{2})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            groups = match.groups()

            if len(groups) == 1:
                normalized = normalize_date(groups[0])
                if normalized:
                    return normalized, confidence_found(False)

            elif len(groups) == 3:
                day, month, year = groups
                raw_value = f"{month} {day}, {year}"
                normalized = normalize_date(raw_value)
                if normalized:
                    return normalized, confidence_found(True)

    return None, confidence_missing()

# =========================================================
# Subpoena
# =========================================================

def extract_subpoena_complainants(text: str):
    lines = get_caption_lines(text, max_lines=30)
    complainants = []

    complainant_idx = None
    for i, line in enumerate(lines):
        if re.fullmatch(r"complainant,?", line, re.IGNORECASE):
            complainant_idx = i
            break

    if complainant_idx is not None:
        candidate_lines = []

        for j in range(max(0, complainant_idx - 5), complainant_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if not raw:
                continue

            if any(marker in low for marker in [
                "republic of the philippines",
                "department of justice",
                "office of the city prosecutor",
                "office of the provincial prosecutor",
                "office of the prosecutor",
                "city of",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "docket no.",
                "i.s. no.",
                "is no.",
                "subpoena",
            ]):
                continue

            raw = re.sub(
                r",?\s*docket\s+no\.?\s*[:\-]?\s*[A-Za-z0-9\-/]+.*$",
                "",
                raw,
                flags=re.IGNORECASE,
            ).strip(" ,.;:-")

            value = clean_extracted_person(raw) or clean_party_name(raw)
            if value:
                candidate_lines.append(value)

        possible = join_name_lines(candidate_lines)
        possible = clean_extracted_person(possible) or clean_party_name(possible)
        if possible:
            complainants.append(possible)

    # fallback: complainant before VERSUS block
    if not complainants:
        caption_text = "\n".join(lines)
        match = re.search(
            r"([A-Z][A-Z\s\.\-,'`]{4,})\s*\n\s*(?:-?\s*VERSUS\s*-?|VS\.?)",
            caption_text,
            re.IGNORECASE
        )
        if match:
            candidate = clean_extracted_person(match.group(1)) or clean_party_name(match.group(1))
            if candidate:
                complainants.append(candidate)

    # entity fallback near complainant
    if not complainants:
        complainants.extend(
            find_persons_near_keywords(text[:1200], ["complainant", "filed by", "subpoena"])
        )

    return dedupe_preserve_order(complainants)

def extract_subpoena_respondents(text: str):
    lines = get_caption_lines(text, max_lines=35)
    respondents = []

    respondent_idx = None
    for i, line in enumerate(lines):
        if re.fullmatch(r"respondents?\.?,?", line, re.IGNORECASE):
            respondent_idx = i
            break

    if respondent_idx is not None:
        candidate_lines = []

        for j in range(max(0, respondent_idx - 5), respondent_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if not raw:
                continue

            if any(marker in low for marker in [
                "for:",
                "violation of",
                "section ",
                "sec.",
                "r.a.",
                "republic act",
                "dangerous drugs",
                "versus",
                "-versus-",
                "vs.",
                "complainant",
                "docket no.",
                "i.s. no.",
                "is no.",
                "office of the city prosecutor",
                "office of the provincial prosecutor",
                "office of the prosecutor",
                "city of",
                "subpoena",
            ]):
                continue

            candidate_lines.append(raw)

        if candidate_lines:
            block = normalize_whitespace(" ".join(candidate_lines))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part) or clean_party_name(part)
                if value:
                    respondents.append(value)

    # fallback: TO: line
    if not respondents:
        all_lines = [line.strip() for line in text.splitlines() if line.strip()]
        for line in all_lines:
            if re.search(r"^\s*TO\s*[:\-]", line, re.IGNORECASE):
                value = re.sub(r"^\s*TO\s*[:\-]\s*", "", line, flags=re.IGNORECASE).strip()
                first_chunk = re.split(r",|;", value)[0].strip()
                cleaned = clean_extracted_person(first_chunk) or clean_party_name(first_chunk)
                if cleaned:
                    respondents.append(cleaned)
                    break

    # fallback: respondent before role line
    if not respondents:
        caption_text = "\n".join(lines)
        match = re.search(
            r"([A-Z][A-Z\s\.\-,'`]{4,})\s*\n\s*Respondents?\.?",
            caption_text,
            re.IGNORECASE
        )
        if match:
            candidate = clean_extracted_person(match.group(1)) or clean_party_name(match.group(1))
            if candidate:
                respondents.append(candidate)

    # entity fallback near respondent-related cues
    if not respondents:
        respondents.extend(
            find_persons_near_keywords(text[:1600], ["respondent", "to:", "appear before", "subpoena"])
        )

    return dedupe_preserve_order(respondents)   

def extract_subpoena_docket_number(text: str):
    header = "\n".join(get_caption_lines(text, max_lines=30))

    patterns = [
        r"NPS\s+Docket\s+No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
        r"Docket\s+No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
        r"I\.?\s*S\.?\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
        r"\b([A-Z]{1,6}-\d{2,4}-INV-\d{2,6})\b",
        r"\b([A-Z]{1,6}-\d{4}-INV-\d+)\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, header, re.IGNORECASE)
        if match:
            value = normalize_whitespace(match.group(1)).strip(" ,.;:-")
            if value and is_valid_docket_number(value):
                return value, confidence_found(True)

    # fallback scan wider text
    wider_patterns = [
        r"NPS\s+Docket\s+No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
        r"I\.?\s*S\.?\s*No\.?\s*[:\-]?\s*([A-Za-z0-9\-/]+)",
    ]

    for pattern in wider_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            value = normalize_whitespace(match.group(1)).strip(" ,.;:-")
            if value and is_valid_docket_number(value):
                return value, confidence_found(False)

    return None, confidence_missing()

def extract_subpoena_offense(text: str):
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    candidates = []

    def looks_like_legal_continuation(line: str) -> bool:
        low = line.lower().strip()
        if not low:
            return False

        legal_markers = [
            "revised penal code",
            "penal code",
            "article",
            "art.",
            "section",
            "sec.",
            "violation of",
            "republic act",
            "r.a.",
            "in relation to",
            "qualified",
            "theft",
            "estafa",
            "robbery",
            "physical injuries",
            "bp blg.",
            "b.p. blg.",
        ]

        return any(marker in low for marker in legal_markers)

    def stop_subpoena_offense_line(line: str) -> bool:
        low = line.lower().strip()
        if not low:
            return True

        stop_markers = [
            "respondent",
            "respondents",
            "complainant",
            "subpoena",
            "to:",
            "docket no.",
            "i.s. no.",
            "is no.",
            "office of the city prosecutor",
            "office of the provincial prosecutor",
            "office of the prosecutor",
        ]
        if any(marker in low for marker in stop_markers):
            return True

        # do NOT stop if this is clearly legal continuation text
        if looks_like_legal_continuation(line):
            return False

        # stop only if it looks like a person name and not legal text
        candidate = clean_extracted_person(line) or clean_party_name(line)
        if candidate:
            return True

        return False

    # primary: FOR: block
    for i, line in enumerate(lines[:30]):
        if re.search(r"^\s*For\s*:", line, re.IGNORECASE):
            first = re.sub(r"^\s*For\s*:\s*", "", line, flags=re.IGNORECASE).strip()
            collected = [first] if first else []

            for j in range(i + 1, min(i + 6, len(lines))):
                nxt = lines[j].strip()
                if stop_subpoena_offense_line(nxt):
                    break
                collected.append(nxt)

            candidates.append(" ".join(collected))

    # secondary: complaint for ...
    body_patterns = [
        r"complaint\s+for\s+(.+?)(?:\.|\n)",
        r"case\s+for\s+(.+?)(?:\.|\n)",
        r"for\s+(Violation\s+of\s+.+?)(?:\.|\n)",
        r"for\s+([A-Z][A-Za-z0-9 ,.\-()]+?under\s+Article\s+\d+[A-Za-z0-9 ,.\-()]*)",
    ]

    for pattern in body_patterns:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            candidates.append(match.group(1))


    print("SUBPOENA OFFENSE CANDIDATES:", candidates)

    value = choose_best_offense_candidate(candidates)
    if value:
        return value, confidence_found(True)

    return None, confidence_missing()

def extract_subpoena_prosecutor(text: str):
    lines = [normalize_whitespace(line).strip(" ,.;:-") for line in text.splitlines() if line.strip()]

    title_patterns = [
        r"assistant\s+.*prosecut",
        r"associate\s+.*prosecut",
        r"city\s+prosecut",
        r"provincial\s+prosecut",
    ]

    for i in range(len(lines) - 1, 0, -1):
        current = lines[i]
        prev_line = lines[i - 1]

        if any(re.search(pat, current, re.IGNORECASE) for pat in title_patterns):
            candidate = clean_extracted_person(prev_line) or clean_party_name(prev_line)
            if candidate and not reject_non_party_person(candidate):
                return candidate

    return None

def extract_subpoena_date(text: str):
    patterns = [
        r"Issued\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"Given\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"Done\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"Given\s+at\s+.*?,\s*this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"Issued\s+at\s+.*?,\s*this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"([A-Za-z]+\s+\d{1,2},\s+\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()

        if len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized, confidence_found(False)

        elif len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized, confidence_found(True)

    return None, confidence_missing()

def extract_subpoena_hearing_date(text: str):
    patterns = [
        r"appear\s+on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"appear\s+before.*?on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"scheduled\s+on\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            normalized = normalize_date(match.group(1))
            if normalized:
                return normalized
    return None


# =========================================================
# Orders / commitment / release
# =========================================================

def extract_order_date(text: str):
    patterns = [
        r"Done in chambers,\s*this\s+(\d{1,2})(?:st|nd|rd|th|\"|”)?\s+day of\s+([A-Za-z]+)\s+(\d{4})",
        r"SO ORDERED\.\s*Done in chambers,\s*this\s+(\d{1,2})(?:st|nd|rd|th|\"|”)?\s+day of\s+([A-Za-z]+)\s+(\d{4})",
        r"Done in chambers,\s*this\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Done in chambers,\s*this\s+(\d{1,2})(?:st|nd|rd|th|\"|”)?\s+of\s+([A-Za-z]+)\s+(\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            groups = match.groups()

            if len(groups) == 3:
                day, month, year = groups
                raw_value = normalize_whitespace(f"{month} {day}, {year}")
                normalized = normalize_date(raw_value)
                if normalized:
                    return normalized, confidence_found(True)

            elif len(groups) == 1:
                raw_value = groups[0].strip()
                raw_value = re.sub(r"(\d{1,2})(st|nd|rd|th)", r"\1", raw_value, flags=re.IGNORECASE)
                raw_value = re.sub(r"\bday of\b", "", raw_value, flags=re.IGNORECASE)
                raw_value = normalize_whitespace(raw_value)

                normalized = normalize_date(raw_value)
                if normalized:
                    return normalized, confidence_found(True)

    return None, confidence_missing()


def extract_order_complainants(text: str):
    lines = get_caption_lines(text, max_lines=30)
    complainants = []

    upper_text = "\n".join(lines).upper()
    if "PEOPLE OF THE PHILIPPINES" in upper_text:
        complainants.append("PEOPLE OF THE PHILIPPINES")
        return dedupe_preserve_order(complainants)

    plaintiff_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bPlaintiff\b|\bComplainant\b", line, re.IGNORECASE):
            plaintiff_idx = i
            break

    if plaintiff_idx is not None:
        candidate_lines = []
        for j in range(max(0, plaintiff_idx - 5), plaintiff_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if not raw:
                continue

            if any(marker in low for marker in [
                "order",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "case no.",
                "criminal case no.",
                "crim. case no.",
                "branch",
            ]):
                continue

            value = clean_extracted_person(raw) or clean_party_name(raw)
            if value:
                candidate_lines.append(value)

        possible = join_name_lines(candidate_lines)
        possible = clean_extracted_person(possible) or clean_party_name(possible)
        if possible:
            complainants.append(possible)

    return dedupe_preserve_order(complainants)


def extract_order_respondents(text: str):
    lines = get_caption_lines(text, max_lines=35)
    respondents = []

    accused_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bAccused\b|\bRespondent\b|\bRespondents\b", line, re.IGNORECASE):
            accused_idx = i
            break

    if accused_idx is not None:
        candidate_lines = []

        for j in range(max(0, accused_idx - 6), accused_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if (
                not raw
                or "for:" in low
                or "violation of" in low
                or "section" in low
                or "sec." in low
                or "article" in low
                or "art." in low
                or "r.a." in low
                or "versus" in low
                or "-versus-" in low
                or "~versus" in low
                or "vs." in low
                or "plaintiff" in low
                or "complainant" in low
                or "people of the philippines" in low
                or "case no." in low
                or "criminal case no." in low
                or "crim. case no." in low
                or "branch" in low
                or "order" in low
            ):
                continue

            candidate_lines.append(raw)

        if candidate_lines:
            block = normalize_whitespace(" ".join(candidate_lines))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part) or clean_party_name(part)
                if value:
                    respondents.append(value)

    return dedupe_preserve_order(respondents)

def extract_order_result(text: str):
    if not text:
        return None, None

    upper_text = text.upper()

    dismissal_markers = [
        "CASE IS HEREBY DISMISSED",
        "CASE IS DISMISSED",
        "COMPLAINT IS DISMISSED",
        "DISMISSED FOR LACK OF MERIT",
        "DISMISSED",
    ]

    archive_markers = [
        "ARCHIVED",
        "ARCHIVE",
        "ORDERED ARCHIVED",
    ]

    warrant_markers = [
        "LET A WARRANT OF ARREST BE ISSUED",
        "WARRANT OF ARREST",
        "ISSUE A WARRANT",
    ]

    hold_markers = [
        "HOLD DEPARTURE ORDER",
        "HDO",
    ]

    for marker in dismissal_markers:
        if marker in upper_text:
            return "dismissed", "dismissed"

    for marker in archive_markers:
        if marker in upper_text:
            return "archived", "archived"

    for marker in warrant_markers:
        if marker in upper_text:
            return "warrant_issued", "for_arrest"

    for marker in hold_markers:
        if marker in upper_text:
            return "hold_departure_order", "pending"

    return None, None


def extract_release_order_date(text: str):
    return extract_order_date(text)


def extract_release_order_complainants(text: str):
    lines = get_caption_lines(text, max_lines=30)
    complainants = []

    upper_text = "\n".join(lines).upper()
    if "PEOPLE OF THE PHILIPPINES" in upper_text:
        complainants.append("PEOPLE OF THE PHILIPPINES")
        return dedupe_preserve_order(complainants)

    for i, line in enumerate(lines):
        if re.search(r"\bPlaintiff\b|\bComplainant\b", line, re.IGNORECASE) and i > 0:
            candidate = clean_extracted_person(lines[i - 1]) or clean_party_name(lines[i - 1])
            if candidate:
                complainants.append(candidate)

    return dedupe_preserve_order(complainants)


def extract_release_order_respondents(text: str):
    lines = get_caption_lines(text, max_lines=35)
    respondents = []

    accused_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bAccused\b|\bRespondent\b|\bRespondents\b", line, re.IGNORECASE):
            accused_idx = i
            break

    if accused_idx is not None:
        candidate_lines = []

        for j in range(max(0, accused_idx - 5), accused_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if (
                not raw
                or "for:" in low
                or "violation of" in low
                or "section" in low
                or "sec." in low
                or "article" in low
                or "art." in low
                or "r.a." in low
                or "versus" in low
                or "-versus-" in low
                or "~versus" in low
                or "vs." in low
                or "plaintiff" in low
                or "people of the philippines" in low
                or "case no." in low
                or "criminal case no." in low
                or "crim. case no." in low
                or "release order" in low
            ):
                continue

            candidate_lines.append(raw)

        if candidate_lines:
            block = normalize_whitespace(" ".join(candidate_lines))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part) or clean_party_name(part)
                if value:
                    respondents.append(value)

    return dedupe_preserve_order(respondents)


def extract_release_order_result(text: str):
    if not text:
        return None, None

    upper_text = text.upper()
    release_markers = [
        "RELEASE ORDER",
        "ORDERED RELEASED",
        "IS HEREBY RELEASED",
        "DIRECTED TO RELEASE",
        "IMMEDIATE RELEASE",
        "FORTHWITH RELEASE",
        "RELEASE THE ACCUSED",
        "CAUSE THE RELEASE",
        "FROM DETENTION",
        "UNLESS HELD FOR SOME OTHER LAWFUL CAUSE",
    ]

    if any(marker in upper_text for marker in release_markers):
        return "released", "released"

    return None, None

def extract_commitment_order_complainants(text: str):
    return extract_order_complainants(text)

def extract_commitment_order_respondents(text: str):
    return extract_order_respondents(text)

def extract_commitment_order_date(text: str):
    return extract_order_date(text)

# =========================================================
# Judgment / decision
# =========================================================

def extract_judgment_date(text: str):
    if not text:
        return None, confidence_missing()

    patterns = [
        r"SO ORDERED\.\s*\n?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Butuan\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Cebu\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Quezon\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"\b([A-Za-z]+\s+\d{1,2},\s+\d{4})\b",
    ]

    for idx, pattern in enumerate(patterns):
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()

        if len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized, confidence_found(idx < 5)

        elif len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized, confidence_found(True)

    return None, confidence_missing()

def extract_judgment_complainants(text: str):
    lines = get_caption_lines(text, max_lines=35)
    complainants = []

    upper_text = "\n".join(lines).upper()
    if "PEOPLE OF THE PHILIPPINES" in upper_text:
        complainants.append("PEOPLE OF THE PHILIPPINES")
        return dedupe_preserve_order(complainants)

    complainant_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bPlaintiff\b|\bComplainant\b", line, re.IGNORECASE):
            complainant_idx = i
            break

    if complainant_idx is not None:
        candidate_lines = []
        for j in range(max(0, complainant_idx - 6), complainant_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if not raw:
                continue

            if any(marker in low for marker in [
                "judgment",
                "decision",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "case no.",
                "criminal case no.",
                "crim. case no.",
                "branch",
            ]):
                continue

            value = clean_extracted_person(raw) or clean_party_name(raw)
            if value:
                candidate_lines.append(value)

        possible = join_name_lines(candidate_lines)
        possible = clean_extracted_person(possible) or clean_party_name(possible)
        if possible:
            complainants.append(possible)

    return dedupe_preserve_order(complainants)

def extract_judgment_respondents(text: str):
    lines = get_caption_lines(text, max_lines=40)
    respondents = []

    accused_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bAccused\b|\bRespondent\b|\bRespondents\b", line, re.IGNORECASE):
            accused_idx = i
            break

    if accused_idx is not None:
        candidate_lines = []

        for j in range(max(0, accused_idx - 6), accused_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if (
                not raw
                or "for:" in low
                or "violation of" in low
                or "section" in low
                or "sec." in low
                or "article" in low
                or "art." in low
                or "r.a." in low
                or "versus" in low
                or "-versus-" in low
                or "~versus" in low
                or "vs." in low
                or "plaintiff" in low
                or "complainant" in low
                or "people of the philippines" in low
                or "case no." in low
                or "criminal case no." in low
                or "crim. case no." in low
                or "branch" in low
                or "judgment" in low
                or "decision" in low
            ):
                continue

            candidate_lines.append(raw)

        if candidate_lines:
            block = normalize_whitespace(" ".join(candidate_lines))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part) or clean_party_name(part)
                if value:
                    respondents.append(value)

    return dedupe_preserve_order(respondents)


def extract_judgment_result(text: str):
    if not text:
        return None, None

    upper_text = text.upper()

    acquittal_markers = [
        "ACQUITTED",
        "IS HEREBY ACQUITTED",
        "ACCUSED IS HEREBY ACQUITTED",
        "ACCUSED ARE HEREBY ACQUITTED",
        "NOT GUILTY",
        "REASONABLE DOUBT",
    ]

    conviction_markers = [
        "FOUND GUILTY",
        "ACCUSED IS HEREBY FOUND GUILTY",
        "ACCUSED ARE HEREBY FOUND GUILTY",
        "CONVICTED",
        "SENTENCED TO",
        "SUFFER THE PENALTY",
    ]

    dismissal_markers = [
        "CASE IS DISMISSED",
        "HEREBY DISMISSED",
        "DISMISSED FOR LACK OF EVIDENCE",
        "DISMISSED FOR FAILURE",
    ]

    wherefore_match = re.search(
        r"WHEREFORE,?(.*?)(?:SO ORDERED\.|$)",
        upper_text,
        re.IGNORECASE | re.DOTALL
    )
    dispositive_text = wherefore_match.group(1) if wherefore_match else upper_text

    for marker in acquittal_markers:
        if marker in dispositive_text:
            return "acquitted", "acquitted"

    for marker in conviction_markers:
        if marker in dispositive_text:
            return "convicted", "convicted"

    for marker in dismissal_markers:
        if marker in dispositive_text:
            return "dismissed", "dismissed"

    for marker in acquittal_markers:
        if marker in upper_text:
            return "acquitted", "acquitted"

    for marker in conviction_markers:
        if marker in upper_text:
            return "convicted", "convicted"

    for marker in dismissal_markers:
        if marker in upper_text:
            return "dismissed", "dismissed"

    return None, None

# =========================================================
# Notice of appeal
# =========================================================

def extract_notice_of_appeal_date(text: str):
    if not text:
        return None, confidence_missing()

    patterns = [
        r"this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"dated\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Butuan\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Quezon\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Cebu\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"([A-Za-z]+\s+\d{1,2},\s+\d{4})",
    ]

    for idx, pattern in enumerate(patterns):
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()

        if len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized, confidence_found(True)

        elif len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized, confidence_found(idx < 5)

    return None, confidence_missing()

def extract_notice_of_appeal_complainants(text: str):
    lines = get_caption_lines(text, max_lines=35)
    complainants = []

    upper_text = "\n".join(lines).upper()
    if "PEOPLE OF THE PHILIPPINES" in upper_text:
        complainants.append("PEOPLE OF THE PHILIPPINES")
        return dedupe_preserve_order(complainants)

    complainant_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bPlaintiff\b|\bComplainant\b", line, re.IGNORECASE):
            complainant_idx = i
            break

    if complainant_idx is not None:
        candidate_lines = []
        for j in range(max(0, complainant_idx - 6), complainant_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if any(marker in low for marker in [
                "notice of appeal",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "case no.",
                "criminal case no.",
                "crim. case no.",
                "branch",
            ]):
                continue

            value = clean_extracted_person(raw) or clean_party_name(raw)
            if value:
                candidate_lines.append(value)

        possible = join_name_lines(candidate_lines)
        possible = clean_extracted_person(possible) or clean_party_name(possible)
        if possible:
            complainants.append(possible)

    return dedupe_preserve_order(complainants)


def extract_notice_of_appeal_respondents(text: str):
    lines = get_caption_lines(text, max_lines=40)
    respondents = []

    accused_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bAccused\b|\bRespondent\b|\bRespondents\b", line, re.IGNORECASE):
            accused_idx = i
            break

    if accused_idx is not None:
        candidate_lines = []

        for j in range(max(0, accused_idx - 6), accused_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if (
                not raw
                or "for:" in low
                or "violation of" in low
                or "section" in low
                or "sec." in low
                or "article" in low
                or "art." in low
                or "r.a." in low
                or "versus" in low
                or "-versus-" in low
                or "~versus" in low
                or "vs." in low
                or "plaintiff" in low
                or "complainant" in low
                or "people of the philippines" in low
                or "case no." in low
                or "criminal case no." in low
                or "crim. case no." in low
                or "notice of appeal" in low
                or "branch" in low
            ):
                continue

            candidate_lines.append(raw)

        if candidate_lines:
            block = normalize_whitespace(" ".join(candidate_lines))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part) or clean_party_name(part)
                if value:
                    respondents.append(value)

    return dedupe_preserve_order(respondents)


def extract_notice_of_appeal_status(text: str):
    if not text:
        return None

    upper_text = text.upper()
    if "NOTICE OF APPEAL" in upper_text:
        return "on_appeal"

    return None


def extract_notice_of_appeal_result(text: str):
    upper = text.upper()
    if "NOTICE OF APPEAL" in upper or "HEREBY APPEALS" in upper:
        return "appealed", "on_appeal"
    return None, None


# =========================================================
# Entry of judgment
# =========================================================

def extract_entry_of_judgment_date(text: str):
    if not text:
        return None, confidence_missing()

    patterns = [
        r"Entered\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"done\s+this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"dated\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Butuan\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Quezon\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"Cebu\s+City,\s*Philippines,?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})",
        r"([A-Za-z]+\s+\d{1,2},\s+\d{4})",
    ]

    for idx, pattern in enumerate(patterns):
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue

        groups = match.groups()

        if len(groups) == 3:
            day, month, year = groups
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized, confidence_found(True)

        elif len(groups) == 1:
            normalized = normalize_date(groups[0])
            if normalized:
                return normalized, confidence_found(idx < 6)

    return None, confidence_missing()


def extract_entry_of_judgment_complainants(text: str):
    lines = get_caption_lines(text, max_lines=35)
    complainants = []

    upper_text = "\n".join(lines).upper()
    if "PEOPLE OF THE PHILIPPINES" in upper_text:
        complainants.append("PEOPLE OF THE PHILIPPINES")
        return dedupe_preserve_order(complainants)

    complainant_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bPlaintiff\b|\bComplainant\b", line, re.IGNORECASE):
            complainant_idx = i
            break

    if complainant_idx is not None:
        candidate_lines = []
        for j in range(max(0, complainant_idx - 6), complainant_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if any(marker in low for marker in [
                "entry of judgment",
                "for:",
                "versus",
                "-versus-",
                "vs.",
                "case no.",
                "criminal case no.",
                "crim. case no.",
                "branch",
            ]):
                continue

            value = clean_extracted_person(raw) or clean_party_name(raw)
            if value:
                candidate_lines.append(value)

        possible = join_name_lines(candidate_lines)
        possible = clean_extracted_person(possible) or clean_party_name(possible)
        if possible:
            complainants.append(possible)

    return dedupe_preserve_order(complainants)


def extract_entry_of_judgment_respondents(text: str):
    lines = get_caption_lines(text, max_lines=40)
    respondents = []

    accused_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\bAccused\b|\bRespondent\b|\bRespondents\b", line, re.IGNORECASE):
            accused_idx = i
            break

    if accused_idx is not None:
        candidate_lines = []

        for j in range(max(0, accused_idx - 6), accused_idx):
            raw = lines[j].strip()
            low = raw.lower()

            if (
                not raw
                or "for:" in low
                or "violation of" in low
                or "section" in low
                or "sec." in low
                or "article" in low
                or "art." in low
                or "r.a." in low
                or "versus" in low
                or "-versus-" in low
                or "~versus" in low
                or "vs." in low
                or "plaintiff" in low
                or "complainant" in low
                or "people of the philippines" in low
                or "case no." in low
                or "criminal case no." in low
                or "crim. case no." in low
                or "entry of judgment" in low
                or "branch" in low
            ):
                continue

            candidate_lines.append(raw)

        if candidate_lines:
            block = normalize_whitespace(" ".join(candidate_lines))
            parts = re.split(r",|\band\b|&", block, flags=re.IGNORECASE)

            for part in parts:
                value = clean_extracted_person(part) or clean_party_name(part)
                if value:
                    respondents.append(value)

    return dedupe_preserve_order(respondents)

def extract_entry_of_judgment_result(text: str):
    if not text:
        return None, None

    upper_text = text.upper()
    if "ENTRY OF JUDGMENT" in upper_text:
        return "judgment_entered", "final_and_executory"

    return None, None


# =========================================================
# Court branch
# =========================================================

def extract_court_branch(text: str):
    if not text:
        return None

    # scan more broadly because branch often appears after signatures
    searchable_text = normalize_whitespace(text)

    patterns = [
        r"\bBRANCH\s*[:\-]?\s*(\d{1,3})\b",
        r"\bBranch\s*[:\-]?\s*(\d{1,3})\b",
        r"\bBRANCH(\d{1,3})\b",
        r"\bBranch(\d{1,3})\b",
        r"\bRranech\s*[:\-]?\s*(\d{1,3})\b",
        r"\bBraneh\s*[:\-]?\s*(\d{1,3})\b",
        r"\bBRANCH\s*[:\-]?\s*([I1l]\d|\d{1,3})\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, searchable_text, re.IGNORECASE)
        if match:
            value = match.group(1)
            value = value.replace("I", "1").replace("l", "1")
            return f"Branch {value}"

    return None


# =========================================================
# Relevant text slicer
# =========================================================

def get_relevant_text_for_document_type(text: str, document_type: str | None):
    if not text or not document_type:
        return text

    upper_text = text.upper()

    marker_map = {
        "complaint_affidavit": "COMPLAINT-AFFIDAVIT",
        "counter_affidavit": "COUNTER-AFFIDAVIT",
        "resolution": "RESOLUTION",
        "information": "INFORMATION",
        "subpoena": "SUBPOENA",
        "commitment_order": "COMMITMENT ORDER",
        "release_order": "RELEASE ORDER",
        "entry_of_judgment": "ENTRY OF JUDGMENT",
        "notice_of_appeal": "NOTICE OF APPEAL",
        "judgment": "JUDGMENT",
        "order": "ORDER",
        "affidavit_of_arrest": "AFFIDAVIT OF ARREST",
        "affidavit_of_apprehension": "AFFIDAVIT OF APPREHENSION",
        "police_investigation_report": "INVESTIGATION REPORT",
        "referral_letter": "REFERRAL LETTER",
        "inquest_resolution": "INQUEST RESOLUTION",
    }

    marker = marker_map.get(document_type)
    if not marker:
        return text

    idx = upper_text.find(marker)
    if idx == -1:
        return text

    if document_type in {
        "resolution",
        "inquest_resolution",
        "counter_affidavit",
        "complaint_affidavit",
        "information",
        "affidavit_of_arrest",
        "affidavit_of_apprehension",
        "police_investigation_report",
        "referral_letter",
    }:
        return text

    start = max(0, idx - 1200)
    end = min(len(text), idx + 2500)
    return text[start:end]


# =========================================================
# Main date_filed dispatcher
# =========================================================

def extract_date_filed(text: str, document_type: str | None = None):
    if not text:
        return None, confidence_missing()

    if document_type == "resolution":
        return None, confidence_missing()

    if document_type == "judgment":
        return extract_judgment_date(text)

    if document_type in ["commitment_order", "order"]:
        return extract_order_date(text)

    if document_type == "release_order":
        return extract_release_order_date(text)

    if document_type == "notice_of_appeal":
        return extract_notice_of_appeal_date(text)

    if document_type == "entry_of_judgment":
        return extract_entry_of_judgment_date(text)

    if document_type == "complaint_affidavit":
        return extract_complaint_affidavit_date(text)

    if document_type == "counter_affidavit":
        return extract_counter_affidavit_date(text)

    if document_type == "subpoena":
        return extract_subpoena_date(text)

    if document_type == "information":
        return None, confidence_missing()

    lines = text.splitlines()

    for line in lines:
        if "filed" in line.lower():
            for pattern in DATE_PATTERNS:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    return normalize_date(match.group(0)), confidence_found(True)

    for pattern in DATE_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return normalize_date(match.group(0)), confidence_found(False)

    return None, confidence_missing()


# =========================================================
# Main metadata extractor
# =========================================================

def extract_metadata(text: str, document_type: str | None, case_type: str | None = None):
    warnings = []
    confidence = {}

    working_text = get_relevant_text_for_document_type(text, document_type)

    docket_number, docket_conf = extract_docket_number(working_text)
    case_number, case_conf = extract_case_number(working_text)
    date_filed, date_conf = extract_date_filed(working_text, document_type)
    offense, offense_conf = extract_offense(working_text, document_type)
    offense = normalize_legal_text(offense)

    filed_in_court_date = None
    court_branch = extract_court_branch(text) or extract_court_branch(working_text)
    resolution_date = None
    case_status = None
    prosecution_result = None
    assigned_prosecutor = None
    court_result = None
    derived_case_status = None

    arrest_date = None
    arrest_time = None
    arrest_place = None
    arresting_officers = []
    inquest_referral_date = None
    warrantless_arrest_basis = None

    complainants = []
    respondents = []
    metadata_review_flags = []

    if document_type in ["resolution", "inquest_resolution"]:
        complainants = extract_resolution_complainants(working_text)
        respondents = extract_resolution_respondents(working_text)

    elif document_type == "information":
        complainants = extract_information_complainants(working_text)
        respondents = extract_information_respondents(working_text)

    elif document_type == "complaint_affidavit":
        complainants = extract_complaint_affidavit_complainants(working_text)
        respondents = extract_complaint_affidavit_respondents(working_text)

    elif document_type == "counter_affidavit":
        complainants = extract_counter_affidavit_complainants(working_text)
        respondents = extract_counter_affidavit_respondents(working_text)

        counter_offense = extract_counter_affidavit_offense(working_text)
        if counter_offense:
            offense = counter_offense
            offense_conf = confidence_found(False)

    elif document_type == "subpoena":
        complainants = extract_subpoena_complainants(working_text)
        respondents = extract_subpoena_respondents(working_text)

        sub_docket, sub_docket_conf = extract_subpoena_docket_number(working_text)
        if sub_docket:
            docket_number = sub_docket
            docket_conf = sub_docket_conf

        sub_offense, sub_offense_conf = extract_subpoena_offense(working_text)
        if sub_offense:
            offense = sub_offense
            offense_conf = sub_offense_conf

        sub_date, sub_date_conf = extract_subpoena_date(working_text)
        if sub_date:
            date_filed = sub_date
            date_conf = sub_date_conf

        assigned_prosecutor = extract_subpoena_prosecutor(working_text)

    elif document_type == "release_order":
        complainants = extract_release_order_complainants(working_text)
        respondents = extract_release_order_respondents(working_text)

    elif document_type == "commitment_order":
        complainants = extract_commitment_order_complainants(working_text)
        respondents = extract_commitment_order_respondents(working_text)

    elif document_type == "judgment":
        complainants = extract_judgment_complainants(working_text)
        respondents = extract_judgment_respondents(working_text)

    elif document_type == "notice_of_appeal":
        complainants = extract_notice_of_appeal_complainants(working_text)
        respondents = extract_notice_of_appeal_respondents(working_text)

    elif document_type == "entry_of_judgment":
        complainants = extract_entry_of_judgment_complainants(working_text)
        respondents = extract_entry_of_judgment_respondents(working_text)

    elif document_type in ["commitment_order", "order"]:
        complainants = extract_order_complainants(working_text)
        respondents = extract_order_respondents(working_text)

    else:
        complainants, respondents = extract_parties(working_text, document_type)

    if document_type in ["resolution", "inquest_resolution"]:
        resolution_date = extract_resolution_date_value(working_text)
        prosecution_result, case_status = extract_resolution_result(working_text)
        assigned_prosecutor = extract_resolution_prosecutor(working_text)

        date_filed = None
        date_conf = confidence_missing()

    if document_type == "information":
        filed_in_court_date = extract_filed_in_court_date(working_text)
        case_status = "filed_in_court"
        assigned_prosecutor = extract_information_prosecutor(working_text)

        info_offense = extract_information_offense(working_text)
        if info_offense:
            offense = info_offense
            offense_conf = confidence_found(True)

        info_signature_date = extract_information_date_from_signature(working_text)
        if info_signature_date:
            filed_in_court_date = info_signature_date

        if not case_number:
            info_case_number = extract_information_case_number(working_text)
            if info_case_number:
                case_number = info_case_number
                case_conf = confidence_found(False)

        if filed_in_court_date:
            corrected_info_date, info_review_flags = correct_information_date_year(
                extracted_date=filed_in_court_date,
                text=working_text,
                case_number=case_number,
            )
            filed_in_court_date = corrected_info_date
            metadata_review_flags.extend(info_review_flags)

        date_filed = None
        date_conf = confidence_missing()
        print("INFO FILED DATE RAW:", extract_filed_in_court_date(working_text))
        print("INFO SIGNATURE DATE RAW:", extract_information_date_from_signature(working_text))


    elif document_type in ["affidavit_of_arrest", "affidavit_of_apprehension"]:
        respondents = extract_affidavit_of_arrest_respondents(working_text)

        arrest_date = extract_arrest_date(working_text)
        arrest_time = extract_arrest_time(working_text)
        arrest_place = extract_arrest_place(working_text)
        arresting_officers = extract_arresting_officers(working_text)
        warrantless_arrest_basis = extract_warrantless_arrest_basis(working_text)

        arrest_offense = extract_affidavit_of_arrest_offense(working_text)
        if arrest_offense:
            offense = arrest_offense
            offense_conf = confidence_found(False)




    elif document_type == "police_investigation_report":
        complainants = extract_police_report_complainants(working_text)
        respondents = extract_police_report_respondents(working_text)

        arrest_date = extract_arrest_date(working_text)
        arrest_time = extract_arrest_time(working_text)
        arrest_place = extract_arrest_place(working_text)
        arresting_officers = extract_arresting_officers(working_text)

        report_offense = extract_police_report_offense(working_text)
        if report_offense:
            offense = report_offense
            offense_conf = confidence_found(False)

    elif document_type == "referral_letter":
        complainants = extract_referral_letter_complainants(working_text)
        respondents = extract_referral_letter_respondents(working_text)

        inquest_referral_date = extract_referral_letter_date(working_text)

        ref_offense = extract_referral_letter_offense(working_text)
        if ref_offense:
            offense = ref_offense
            offense_conf = confidence_found(False)


    if document_type == "release_order":
        court_result, derived_case_status = extract_release_order_result(working_text)
        if derived_case_status:
            case_status = derived_case_status
    if document_type == "commitment_order":
        court_result, derived_case_status = extract_commitment_order_result(working_text)
        if derived_case_status:
            case_status = derived_case_status

    if document_type == "order":
        derived_court_result, derived_case_status = extract_order_result(working_text)
        if derived_court_result:
            court_result = derived_court_result
        if derived_case_status:
            case_status = derived_case_status

    if document_type == "judgment":
        court_result, derived_case_status = extract_judgment_result(working_text)
        if derived_case_status:
            case_status = derived_case_status

    if document_type == "notice_of_appeal":
        court_result, derived_case_status = extract_notice_of_appeal_result(working_text)
        if derived_case_status:
            case_status = derived_case_status

    if document_type == "entry_of_judgment":
        derived_court_result, derived_case_status = extract_entry_of_judgment_result(working_text)
        if derived_court_result:
            court_result = derived_court_result
        if derived_case_status:
            case_status = derived_case_status

    if case_type == "INQ":
        if document_type in ["affidavit_of_arrest", "affidavit_of_apprehension", "police_investigation_report", "referral_letter"]:
            if not case_status:
                case_status = "under_inquest"

        if document_type == "inquest_resolution":
            if prosecution_result == "with_probable_cause":
                case_status = "for_filing"
            elif prosecution_result == "no_probable_cause":
                case_status = "dismissed"

        if document_type == "information":
            case_status = "filed_in_court"


    if complainants and respondents:
        if len(complainants) == 1 and len(respondents) == 1:
            if complainants[0].strip().lower() == respondents[0].strip().lower():
                respondents = []

    case_title = build_case_title(complainants, respondents)

    confidence["docket_number"] = docket_conf
    confidence["case_number"] = case_conf
    confidence["date_filed"] = date_conf
    confidence["offense_or_violation"] = offense_conf
    confidence["complainants"] = 0.95 if complainants else 0.0
    confidence["respondents"] = 0.95 if respondents else 0.0
    confidence["case_title"] = 0.95 if case_title else 0.0

    if not docket_number:
        warnings.append("docket_number not found")
    if not case_number:
        warnings.append("case_number not found")
    if not date_filed and document_type not in ["information", "resolution"]:
        warnings.append("date_filed not found")
    if document_type == "information" and not filed_in_court_date:
        warnings.append("filed_in_court_date not found")
    if not complainants:
        warnings.append("complainants not found")
    if not respondents:
        warnings.append("respondents not found")
    if not offense:
        warnings.append("offense_or_violation not found")

    if document_type in ["resolution", "inquest_resolution"] and not resolution_date:
        warnings.append("resolution_date not found")

    if document_type in ["affidavit_of_arrest", "affidavit_of_apprehension"]:
        if not arrest_date:
            warnings.append("arrest_date not found")
        if not respondents:
            warnings.append("respondents not found")

    if document_type == "police_investigation_report":
        if not respondents:
            warnings.append("respondents not found")

    if document_type == "referral_letter":
        if not inquest_referral_date:
            warnings.append("inquest_referral_date not found")
    metadata = {
        "document_type": document_type,
        "date_filed": date_filed,
        "docket_number": docket_number,
        "case_number": case_number,
        "complainants": complainants,
        "respondents": respondents,
        "offense_or_violation": offense,
        "case_title": case_title,
        "assigned_prosecutor": assigned_prosecutor,
        "resolution_date": resolution_date,
        "filed_in_court_date": filed_in_court_date,
        "court_branch": court_branch,
        "case_status": case_status,
        "prosecution_result": prosecution_result,
        "court_result": court_result,

        "arrest_date": arrest_date,
        "arrest_time": arrest_time,
        "arrest_place": arrest_place,
        "arresting_officers": arresting_officers,
        "inquest_referral_date": inquest_referral_date,
        "warrantless_arrest_basis": warrantless_arrest_basis,

        "created_by": None,
        "last_updated": None,
        "review_flags": list(dict.fromkeys(metadata_review_flags)),
    }

    return metadata, confidence, warnings

def looks_like_full_name(value: str) -> bool:
    if not value:
        return False

    value = normalize_whitespace(value)
    if not value:
        return False

    if re.search(r"\d", value):
        return False

    words = value.split()
    if len(words) < 2 or len(words) > 5:
        return False

    valid_words = 0
    for w in words:
        if re.fullmatch(r"[A-Z][a-z]+", w):
            valid_words += 1
        elif re.fullmatch(r"[A-Z]\.", w):
            valid_words += 1
        elif re.fullmatch(r"[A-Z]{2,}", w):
            valid_words += 1
        else:
            return False

    return valid_words >= 2 


def reject_sentence_like_name(value: str) -> bool:
    if not value:
        return True

    lowered = value.lower()

    bad_fragments = [
        "at around",
        "upon reviewing",
        "noticed that",
        "taking the wallet",
        "placing it",
        "after having",
        "executing this",
        "in witness whereof",
        "subscribed and sworn",
        "after having been duly sworn",
        "of legal age",
        "resident of",
        "barangay",
        "city of",
        "butuan city",
        "complaint-affidavit",
        "counter-affidavit",
        "revised penal code",
        "wallet",
        "store located",
        "cctv footage",
    ]

    bad_fragments.extend([
        "assistant city prosecutor",
        "assistant provincial prosecutor",
        "associate city prosecutor",
        "city prosecutor",
        "provincial prosecutor",
        "sworn statement",
        "witness",
        "annex",
        "agusan del norte",
        "butuan",
        "ampayon",
    ])

    if any(fragment in lowered for fragment in bad_fragments):
        return True

    if re.search(r"\b(complaint|affidavit|resolution|information|subpoena|respondent|complainant)\b", lowered):
        return True

    if "," in value and len(value.split(",")) > 2:
        return True

    return False

def clean_extracted_person(value: str) -> str | None:
    value = clean_person_name(value)
    value = clean_party_name(value)

    if not value:
        return None

    value = re.sub(r"\bFilipino\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bof legal age\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\band a resident of\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")
    value = re.sub(r"\bresident of\b.*$", "", value, flags=re.IGNORECASE).strip(" ,.;:-")

    value = normalize_whitespace(value)

    if not value:
        return None

    if reject_sentence_like_name(value):
        return None

    if reject_non_party_person(value):
        return None

    if not looks_like_full_name(value):
        return None

    return value

def reject_non_party_person(value: str) -> bool:
    if not value:
        return True

    lowered = value.lower()

    bad_exact = {
        "agusan del norte",
        "butuan city",
        "butuan",
        "ampayon",
    }
    if lowered in bad_exact:
        return True

    bad_contains = [
        "prosecutor",
        "witness",
        "annex",
        "barangay",
        "city of",
        "province of",
        "agusan del norte",
    ]
    if any(term in lowered for term in bad_contains):
        return True

    return False

def extract_affidavit_body_complainant(text: str):
    if not text:
        return None

    patterns = [
        r"\bI,\s*([A-Z][A-Za-z\.\s'\-]+?),\s*Filipino\b",
        r"\bI,\s*([A-Z][A-Za-z\.\s'\-]+?),\s*of legal age\b",
        r"\bI,\s*([A-Z][A-Za-z\.\s'\-]+?),\s*after having been duly sworn\b",
        r"(?:^|\n)\s*[\]\[]?\s*([A-Z][A-Z\s\.\-']{4,})\s*,\s*Filipino\b",
        r"(?:^|\n)\s*[\]\[]?\s*([A-Z][A-Z\s\.\-']{4,})\s*,\s*of legal age\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            cleaned = clean_extracted_person(match.group(1))
            if cleaned:
                return cleaned

    # line-based fallback
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for i, line in enumerate(lines[:20]):
        if looks_like_affidavit_intro_line(line):
            match = re.search(r"([A-Z][A-Z\s\.\-']{4,})", line)
            if match:
                cleaned = clean_extracted_person(match.group(1))
                if cleaned:
                    return cleaned

    # entity fallback near intro cues
    candidates = find_persons_near_keywords(
        text[:1500],
        ["filipino", "of legal age", "duly sworn", "resident of"]
    )
    return candidates[0] if candidates else None


def extract_affidavit_body_respondents(text: str):
    if not text:
        return []

    respondents = []
    body_text = get_affidavit_body_only(text)

    patterns = [
        r"(?<!\w)(?:I|\|)\s+saw\s+([A-Z][A-Z\s\.\-']{4,}?)\s+taking\b",
        r"(?<!\w)(?:I|\|)\s+saw\s+([A-Z][A-Z\s\.\-']{4,}?)\s+steal(?:ing)?\b",
        r"(?<!\w)(?:I|\|)\s+identified\s+([A-Z][A-Z\s\.\-']{4,}?)\s+(?:in|on)\b",
        r"(?<!\w)(?:I|\|)\s+confronted\s+([A-Z][A-Z\s\.\-']{4,}?)(?:[,\n.]|$)",
        r"\brespondent\s*,?\s*([A-Z][A-Z\s\.\-']{4,}?)(?:[,\n.]|$)",
        r"\brespondent\s+([A-Z][A-Z\s\.\-']{4,}?)\s+taking\b",
        r"\brespondent\s+([A-Z][A-Z\s\.\-']{4,}?)\s+steal(?:ing)?\b",
        r"\bagainst\s+([A-Z][A-Z\s\.\-']{4,}?)(?:[,\n.]|$)",
        r"\bcharge\s+the\s+respondent\s+([A-Z][A-Z\s\.\-']{4,}?)(?:[,\n.]|$)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, body_text, re.IGNORECASE | re.MULTILINE):
            candidate = clean_extracted_person(match.group(1))
            if candidate:
                respondents.append(candidate)

    # fallback for names split after action lines
    fallback_patterns = [
        r"(?:saw|identified)\s*\n\s*([A-Z][A-Z\s\.\-']{6,})\s+taking\b",
        r"(?:saw|identified)\s*\n\s*([A-Z][A-Z\s\.\-']{6,})\s+steal(?:ing)?\b",
        r"(?:saw|identified)\s*\n\s*([A-Z][A-Z\s\.\-']{6,})\s+placing\b",
    ]

    for pattern in fallback_patterns:
        for match in re.finditer(pattern, body_text, re.IGNORECASE | re.MULTILINE):
            candidate = clean_extracted_person(match.group(1))
            if candidate:
                respondents.append(candidate)

    if not respondents:
        respondents.extend(
            find_persons_near_keywords(
                body_text,
                ["respondent", "saw", "taking", "stealing", "confronted", "identified"]
            )
        )

    return dedupe_preserve_order(respondents)


def extract_affidavit_body_offense(text: str):
    if not text:
        return None

    body_text = get_affidavit_body_only(text)
    candidates = []

    patterns = [
        r"\bcase\s+for\s+(.+?)(?:\.|\n)",
        r"\bcomplainant\s+in\s+this\s+case\s+for\s+(.+?)(?:\.|\n)",
        r"\bcharge\s+the\s+respondent\s+for\s+(.+?)(?:\.|\n)",
        r"\bexecuting\s+this\s+.*?\s+to\s+charge\s+the\s+respondent\s+for\s+(.+?)(?:\.|\n)",
        r"\bfor\s+([A-Z][A-Za-z0-9 ,.\-()]+?under\s+Article\s+\d+[A-Za-z0-9 ,.\-()]*)",
        r"\bfor\s+(Violation\s+of\s+.+?)(?:\.|\n)",
        r"\bfor\s+(Theft)\b",
        r"\bfor\s+(Estafa)\b",
        r"\bfor\s+(Robbery)\b",
        r"\bfor\s+(Qualified\s+Theft)\b",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, body_text, re.IGNORECASE):
            candidates.append(match.group(1))

    # sentence-level fallback
    for sentence in sentence_tokenize(body_text[:2000]):
        low = sentence.lower()
        if (
            "case for" in low
            or "charge the respondent for" in low
            or "complainant in this case for" in low
        ):
            match = re.search(r"\bfor\s+(.+?)(?:\.|$)", sentence, re.IGNORECASE)
            if match:
                candidates.append(match.group(1))

    return choose_best_offense_candidate(candidates)

def extract_affidavit_execution_date(text: str):
    patterns = [
        r"set my hand this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"executed this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"IN WITNESS WHEREOF.*?this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4})",
        r"this\s+(\d{1,2})(?:st|nd|rd|th)?\s+day\s+of\s+([A-Za-z]+)\s+(\d{4}),?\s+in\s+([A-Za-z\s]+)",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            day = match.group(1)
            month = match.group(2)
            year = match.group(3)
            normalized = normalize_date(f"{month} {day}, {year}")
            if normalized:
                return normalized

    for value in extract_date_entities(text[:1200]):
        normalized = normalize_date(value)
        if normalized:
            return normalized

    return None