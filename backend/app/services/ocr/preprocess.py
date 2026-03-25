# backend/app/services/ocr/preprocess.py

import cv2
import numpy as np
from PIL import Image


def pil_to_cv2(pil_image: Image.Image):
    return cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)


def cv2_to_pil(image):
    if len(image.shape) == 2:
        return Image.fromarray(image)
    return Image.fromarray(cv2.cvtColor(image, cv2.COLOR_BGR2RGB))


def upscale_if_needed(gray, min_width=1800):
    h, w = gray.shape[:2]
    if w < min_width:
        scale = min_width / w
        gray = cv2.resize(
            gray,
            None,
            fx=scale,
            fy=scale,
            interpolation=cv2.INTER_CUBIC
        )
    return gray


def deskew_image(gray):
    coords = np.column_stack(np.where(gray < 250))
    if len(coords) == 0:
        return gray

    angle = cv2.minAreaRect(coords)[-1]

    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.3:
        return gray

    (h, w) = gray.shape[:2]
    center = (w // 2, h // 2)
    matrix = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        gray,
        matrix,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE
    )
    return rotated


def preprocess_base(image):
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()

    gray = upscale_if_needed(gray)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    gray = deskew_image(gray)

    return gray


def preprocess_variant_otsu(image):
    gray = preprocess_base(image)
    processed = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )[1]
    return processed


def preprocess_variant_adaptive(image):
    gray = preprocess_base(image)
    processed = cv2.adaptiveThreshold(
        gray,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15
    )
    return processed


def preprocess_variant_binary_inv(image):
    gray = preprocess_base(image)
    processed = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )[1]
    processed = 255 - processed
    return processed


def preprocess_pdf_page_variants(image):
    return [
        preprocess_variant_otsu(image),
        preprocess_variant_adaptive(image),
        preprocess_variant_binary_inv(image),
    ]


def preprocess_uploaded_image_variants(image):
    return [
        preprocess_variant_otsu(image),
        preprocess_variant_adaptive(image),
        preprocess_variant_binary_inv(image),
    ]