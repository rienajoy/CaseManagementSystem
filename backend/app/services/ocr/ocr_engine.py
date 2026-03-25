import cv2
import numpy as np
import pytesseract

from app.services.ocr.preprocess import (
    preprocess_pdf_page_variants,
    preprocess_uploaded_image_variants,
)
from app.utils.pdf_utils import pdf_to_images

pytesseract.pytesseract.tesseract_cmd = r"C:\Users\RCHimo\Desktop\Tesseract\tesseract.exe"


def pil_to_cv2(pil_image):
    return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)


OCR_CONFIGS = [
    "--oem 3 --psm 6 -l eng",
    "--oem 3 --psm 4 -l eng",
    "--oem 3 --psm 11 -l eng",
]


def score_ocr_text(text: str) -> float:
    if not text:
        return 0.0

    stripped = text.strip()
    if not stripped:
        return 0.0

    length_score = min(len(stripped), 5000) / 5000.0
    alpha_chars = sum(ch.isalpha() for ch in stripped)
    digit_chars = sum(ch.isdigit() for ch in stripped)
    useful_chars = alpha_chars + digit_chars
    useful_ratio = useful_chars / max(len(stripped), 1)
    newline_bonus = min(stripped.count("\n"), 100) / 100.0

    penalty = 0.0
    if len(stripped) < 30:
        penalty += 0.4

    return (length_score * 0.45) + (useful_ratio * 0.45) + (newline_bonus * 0.10) - penalty


def run_ocr_variants(image, is_pdf_page=False):
    variants = (
        preprocess_pdf_page_variants(image)
        if is_pdf_page
        else preprocess_uploaded_image_variants(image)
    )

    best_text = ""
    best_score = -1.0

    for processed in variants:
        for config in OCR_CONFIGS:
            text = pytesseract.image_to_string(processed, config=config)
            score = score_ocr_text(text)

            if score > best_score:
                best_score = score
                best_text = text

    return best_text


def extract_text_from_file(file_path: str, mime_type: str | None = None):
    pages = []
    full_text_parts = []

    if mime_type == "application/pdf" or file_path.lower().endswith(".pdf"):
        images = pdf_to_images(file_path)

        for i, pil_img in enumerate(images, start=1):
            image = pil_to_cv2(pil_img)
            text = run_ocr_variants(image, is_pdf_page=True)

            pages.append({
                "page_number": i,
                "text": text
            })
            full_text_parts.append(text)

    else:
        image = cv2.imread(file_path)

        if image is None:
            raise ValueError(f"Could not read image file: {file_path}")

        text = run_ocr_variants(image, is_pdf_page=False)

        pages.append({
            "page_number": 1,
            "text": text
        })
        full_text_parts.append(text)

    raw_text = "\n\n".join(full_text_parts)

    return {
        "raw_text": raw_text,
        "pages": pages
    }