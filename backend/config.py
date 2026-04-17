# config.py
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    DATABASE_URL = os.getenv("DATABASE_URL")
    SECRET_KEY = os.getenv("SECRET_KEY", "change_this_to_a_long_random_secret_key_32_chars_min")
    DEBUG = os.getenv("DEBUG", "False").lower() == "true"
    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads/profile_pics")
    OCR_UPLOAD_FOLDER = os.getenv("OCR_UPLOAD_FOLDER", "uploads/ocr_documents")
    JWT_EXP_HOURS = int(os.getenv("JWT_EXP_HOURS", 2))
    MAX_FAILED_ATTEMPTS = int(os.getenv("MAX_FAILED_ATTEMPTS", 5))
    LOCKOUT_DURATION_MINUTES = int(os.getenv("LOCKOUT_DURATION_MINUTES", 15))
    TESSERACT_PATH= r"C:\Users\RCHimo\Desktop\Tesseract\tesseract.exe"
