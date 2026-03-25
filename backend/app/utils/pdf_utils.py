import os
from pdf2image import convert_from_path

POPPLER_PATH = r"C:\Users\RCHimo\Desktop\poppler\poppler-24.08.0\Library\bin"


def pdf_to_images(pdf_path: str):
    """
    Convert PDF pages into PIL Images.
    Returns a list of images, one per page.
    """

    if os.path.exists(POPPLER_PATH):
        images = convert_from_path(
            pdf_path,
            dpi=300,
            poppler_path=POPPLER_PATH
        )
    else:
        images = convert_from_path(pdf_path, dpi=300)

    return images