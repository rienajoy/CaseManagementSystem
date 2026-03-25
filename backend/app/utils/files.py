#backend/app/utils/files.py

import os
import shutil
from flask import current_app
# -----------------------------
# Generic utility helpers
# -----------------------------
def ensure_directory_exists(path: str):
    os.makedirs(path, exist_ok=True)


def safe_remove_file(path: str):
    try:
        if path and os.path.isfile(path):
            os.remove(path)
    except Exception:
        current_app.logger.exception(f"Failed to remove file: {path}")


def safe_remove_directory(path: str):
    try:
        if path and os.path.isdir(path):
            shutil.rmtree(path)
    except Exception:
        current_app.logger.exception(f"Failed to remove directory: {path}")
