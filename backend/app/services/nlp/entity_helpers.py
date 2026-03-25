import re
from functools import lru_cache

import nltk
import spacy

from app.services.nlp.normalizer import normalize_whitespace

# Ensure punkt is available
try:
    nltk.data.find("tokenizers/punkt")
except LookupError:
    nltk.download("punkt", quiet=True)


@lru_cache(maxsize=1)
def get_nlp():
    try:
        return spacy.load("en_core_web_sm")
    except Exception:
        return None


def sentence_tokenize(text: str) -> list[str]:
    if not text:
        return []
    try:
        return nltk.sent_tokenize(text)
    except Exception:
        return [s.strip() for s in text.split("\n") if s.strip()]


def extract_person_entities(text: str) -> list[str]:
    nlp = get_nlp()
    if not nlp or not text:
        return []

    doc = nlp(text)
    names = []

    for ent in doc.ents:
        if ent.label_ == "PERSON":
            value = normalize_whitespace(ent.text)
            if value and len(value) >= 4:
                names.append(value)

    return list(dict.fromkeys(names))


def extract_date_entities(text: str) -> list[str]:
    nlp = get_nlp()
    if not nlp or not text:
        return []

    doc = nlp(text)
    values = []

    for ent in doc.ents:
        if ent.label_ == "DATE":
            value = normalize_whitespace(ent.text)
            if value:
                values.append(value)

    return list(dict.fromkeys(values))


def extract_name_after_i_clause(text: str) -> str | None:
    if not text:
        return None

    patterns = [
        r"\bI,\s*([A-Z][A-Za-z\s\.\-']+?),\s*Filipino",
        r"\bI,\s*([A-Z][A-Za-z\s\.\-']+?),\s*of legal age",
        r"\bI,\s*([A-Z][A-Za-z\s\.\-']+?),\s*after having been duly sworn",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return normalize_whitespace(match.group(1))

    return None