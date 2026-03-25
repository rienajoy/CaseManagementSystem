import os
import uuid
from werkzeug.utils import secure_filename

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg"}


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_file_extension(filename: str) -> str:
    return filename.rsplit(".", 1)[1].lower() if "." in filename else ""


def save_uploaded_file(file_storage, upload_folder: str) -> tuple[str, str]:
    original_name = secure_filename(file_storage.filename)
    ext = get_file_extension(original_name)
    unique_name = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(upload_folder, unique_name)
    file_storage.save(save_path)
    return original_name, save_path


def guess_mime_type(filename: str) -> str:
    ext = get_file_extension(filename)
    mapping = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
    }
    return mapping.get(ext, "application/octet-stream")