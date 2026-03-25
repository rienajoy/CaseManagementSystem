#backend/app/services/ocr/text_cleaner.py

import re


def clean_ocr_text(text: str) -> str:
    if not text:
        return ""

    text = text.replace("\r", "\n")

        # normalize common OCR confusion: | -> I in affidavit pronouns
    text = re.sub(r"(?m)^\|\s*,", "I,", text)
    text = re.sub(r"(?m)^\|\s+am\b", "I am", text)
    text = re.sub(r"(?m)^\|\s+have\b", "I have", text)
    text = re.sub(r"(?m)^\|\s+saw\b", "I saw", text)
    text = re.sub(r"(?m)^\|\s+noticed\b", "I noticed", text)
    text = re.sub(r"(?m)^\|\s+placed\b", "I placed", text)
    text = re.sub(r"(?m)^\|\s+personally\b", "I personally", text)
    text = re.sub(r"(?m)^\|\s+confronted\b", "I confronted", text)
    text = re.sub(r"(?m)^\|\s+identified\b", "I identified", text)
    text = re.sub(r"(?m)^\|\s+am\s+executing\b", "I am executing", text)

    # also fix mid-line " , | saw" cases
    text = re.sub(r"(?<=\s)\|\s+saw\b", "I saw", text)
    text = re.sub(r"(?<=\s)\|\s+noticed\b", "I noticed", text)
    text = re.sub(r"(?<=\s)\|\s+placed\b", "I placed", text)
    text = re.sub(r"(?<=\s)\|\s+have\b", "I have", text)

    # remove scanner artifacts / recurring noise
    noise_patterns = [
        r"Scanned by CamScanner",
        r"/smer\b",
        r"\bismer\b",
        r"Xone\s+nnn.*",
        r"No\s+smsen.*",
    ]
    for pattern in noise_patterns:
        text = re.sub(pattern, "", text, flags=re.IGNORECASE)

    # normalize quotes/dashes
    text = text.replace("“", '"').replace("”", '"').replace("’", "'")
    text = text.replace("–", "-").replace("—", "-")

    # common OCR fixes for legal terms
    replacements = {
        r"\bArt\.\s+Il\b": "Art. II",
        r"\bArticle\s+Hof\b": "Article II of",
        r"\bArticle\s+Il\b": "Article II",
        r"\biW relation\b": "in relation",
        r"\bScetion\b": "Section",
        r"\bVETSUN\b": "VERSUS",
        r"\bVETSUN\b": "VERSUS",
        r"\bPHS\b": "PHILIPPINES",
        r"\bCASENO\b": "CASE NO.",
        r"\bCRIM\.\s*CASENO\b": "CRIM. CASE NO.",
        r"\bMaintlth\b": "Plaintiff",
        r"\bAksoupite\b": "Associate",
        r"\bAsfochite\b": "Associate",
        r"\bCily\b": "City",
        r"\bLite Member\b": "Life Member",
        r"\bHof\b": "II of",
        r"\bIl\b": "II",
        r"\bgoth day of\b": "20th day of",
        r"\bCOMPLAINT[\s\-]*AFFIDAVIT\b": "COMPLAINT-AFFIDAVIT",
        r"\bCOUNTER[\s\-]*AFFIDAVIT\b": "COUNTER-AFFIDAVIT",
        r"\bSUBPOENA\b": "SUBPOENA",
        r"\bRES0LUTION\b": "RESOLUTION",
        r"\bINF0RMATION\b": "INFORMATION",
        r"\bJUDGEMENT\b": "JUDGMENT",
        r"\bENTRY OF JUDGEMENT\b": "ENTRY OF JUDGMENT",
        r"\bN0\.?\b": "NO.",
        r"\bD0CKET\b": "DOCKET",
        r"\bRESP0NDENT\b": "RESPONDENT",
        r"\bC0MPLAINANT\b": "COMPLAINANT",
        r"\bFlLIPINO\b": "FILIPINO",
    }

    for pattern, replacement in replacements.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

    # normalize common caption markers
    text = re.sub(r"\b[Vv][Ee][Rr][Ss][Uu][Ss]\b", "VERSUS", text)
    text = re.sub(r"[-~]*\s*VERSUS\s*[-~]*", "\nVERSUS\n", text, flags=re.IGNORECASE)
    text = re.sub(r"\bvs\.\b", "vs.", text, flags=re.IGNORECASE)

    # normalize labels
    text = re.sub(r"\bCRIM\s*\.\s*CASE\s*NO\s*\.\s*", "CRIM. CASE NO. ", text, flags=re.IGNORECASE)
    text = re.sub(r"\bCASE\s*NO\s*\.\s*", "CASE NO. ", text, flags=re.IGNORECASE)
    text = re.sub(r"\bDocket\s*No\s*\.\s*", "Docket No. ", text, flags=re.IGNORECASE)
    text = re.sub(r"\bI\s*\.\s*S\s*\.\s*NO\s*\.\s*", "I.S. No. ", text, flags=re.IGNORECASE)

    # merge broken offense lines like:
    # FOR: Violation of Sec. 11, in
    # relation to Sec. 25, Art. II of R.A. 9165
    text = re.sub(
        r"(FOR:\s*[^\n]+)\n(relation to\s+[^\n]+)",
        r"\1 \2",
        text,
        flags=re.IGNORECASE
    )

    # remove excessive spaces and tabs
    text = re.sub(r"[ \t]+", " ", text)

    # reduce too many blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    # trim spaces before punctuation
    text = re.sub(r"\s+([,.;:])", r"\1", text)

    text = re.sub(r"\bI\s*,\s*", "I, ", text)
    text = re.sub(r"\bthis\s+(\d{1,2})\s*\"\s+of\b", r"this \1th of", text, flags=re.IGNORECASE)

    # trim each line
    lines = [line.strip() for line in text.split("\n")]
    lines = [line for line in lines if line]

    return "\n".join(lines)