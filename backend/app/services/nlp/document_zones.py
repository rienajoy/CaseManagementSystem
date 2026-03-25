# backend/app/services/nlp/document_zones.py

import re


def split_document_zones(text: str) -> dict:
    if not text:
        return {
            "full_text": "",
            "header_text": "",
            "caption_text": "",
            "body_text": "",
            "signature_text": "",
            "tail_text": "",
        }

    lines = [line.rstrip() for line in text.splitlines()]
    non_empty = [line.strip() for line in lines if line.strip()]

    header_lines = non_empty[:25]
    header_text = "\n".join(header_lines)

    upper = text.upper()

    signature_markers = [
        "IN WITNESS WHEREOF",
        "SUBSCRIBED AND SWORN",
        "SO ORDERED",
        "WHEREFORE",
        "RESPECTFULLY SUBMITTED",
        "DONE IN CHAMBERS",
    ]

    sig_idx = len(text)
    for marker in signature_markers:
        idx = upper.find(marker)
        if idx != -1:
            sig_idx = min(sig_idx, idx)

    if sig_idx < len(text):
        body_text = text[:sig_idx].strip()
        signature_text = text[sig_idx:].strip()
    else:
        body_text = text
        signature_text = ""

    caption_text = "\n".join(non_empty[:18])

    tail_text = "\n".join(non_empty[-20:])

    return {
        "full_text": text,
        "header_text": header_text,
        "caption_text": caption_text,
        "body_text": body_text,
        "signature_text": signature_text,
        "tail_text": tail_text,
    }