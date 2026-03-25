# main.py
import os
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

from config import Config
from database import engine, SessionLocal
from model import Base, User
from utility import create_jwt, verify_password, verify_jwt, hash_password

from app.middleware.auth import role_required, update_last_active
from app.routes.admin_routes import admin_bp
from app.routes.document_routes import document_bp
from app.routes.intake_case_routes import intake_case_bp
from app.routes.staff_routes import staff_bp




app = Flask(__name__)

CORS(app)
app.register_blueprint(admin_bp)
app.register_blueprint(staff_bp)
app.register_blueprint(document_bp, url_prefix="/api/documents")
app.register_blueprint(intake_case_bp)


UPLOAD_FOLDER = Config.UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

OCR_UPLOAD_FOLDER = Config.OCR_UPLOAD_FOLDER
os.makedirs(OCR_UPLOAD_FOLDER, exist_ok=True)
app.config["OCR_UPLOAD_FOLDER"] = OCR_UPLOAD_FOLDER

INTAKE_DRAFTS_FOLDER = "uploads/intake_drafts"
os.makedirs(INTAKE_DRAFTS_FOLDER, exist_ok=True)
app.config["INTAKE_DRAFTS_FOLDER"] = INTAKE_DRAFTS_FOLDER

CASE_DOCUMENTS_FOLDER = "uploads/case_documents"
os.makedirs(CASE_DOCUMENTS_FOLDER, exist_ok=True)
app.config["CASE_DOCUMENTS_FOLDER"] = CASE_DOCUMENTS_FOLDER

app.config["SECRET_KEY"] = Config.SECRET_KEY
app.config["DEBUG"] = Config.DEBUG

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "Backend is running",
        "routes": [
            "POST /login",
            "POST /change-password",
            "GET /my-profile",
            "GET /staff-dashboard",
            "GET /admin-dashboard",
            "PUT /admin/users/<id>/lock",
            "PUT /admin/users/<id>/unlock",
            "PUT /admin/users/<id>/reset-password",
        ]
    })

MAX_FAILED_ATTEMPTS = Config.MAX_FAILED_ATTEMPTS
LOCKOUT_DURATION_MINUTES = Config.LOCKOUT_DURATION_MINUTES

@app.route("/login", methods=["POST"])
def login():
    data = request.json or {}
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"message": "email and password are required"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return jsonify({"message": "Invalid credentials"}), 401

        if user.status == "locked" or user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
            return jsonify({
                "message": f"Account locked. Try again after {LOCKOUT_DURATION_MINUTES} minutes"
            }), 403

        if not verify_password(password, user.password):
            user.failed_login_attempts += 1
            db.commit()
            return jsonify({"message": "Invalid credentials"}), 401

        user.failed_login_attempts = 0
        user.last_active = datetime.utcnow()
        db.commit()
        db.refresh(user)

        must_change = bool(getattr(user, "must_change_password", False))
        token = create_jwt(user.user_id, user.role)

        return jsonify({
            "message": "Login successful",
            "user": {
                "id": user.user_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "role": user.role,
                "status": user.status,
                "last_active": user.last_active.isoformat() if user.last_active else None,
                "must_change_password": must_change,
            },
            "token": token
        })
    finally:
        db.close()

@app.route("/change-password", methods=["POST"])
@update_last_active
def change_password():
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        return jsonify({"message": "Token missing"}), 401

    token = token.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        return jsonify({"message": "Invalid token"}), 401

    data = request.json or {}
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    if not old_password or not new_password:
        return jsonify({"message": "old_password and new_password are required"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == payload["user_id"]).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        if not verify_password(old_password, user.password):
            return jsonify({"message": "Old password is incorrect"}), 401

        user.password = hash_password(new_password)
        user.last_password_change = datetime.utcnow()
        user.must_change_password = False  # ✅ clear flag
        db.commit()

        return jsonify({"message": "Password updated successfully"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@app.route("/update-profile", methods=["PUT"])
@update_last_active
def update_profile():
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        return jsonify({"message": "Token missing"}), 401

    token = token.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        return jsonify({"message": "Invalid token"}), 401

    user_id = payload["user_id"]
    data = request.json or {}

    new_email = data.get("email")
    new_username = data.get("username")
    first_name = data.get("first_name")
    last_name = data.get("last_name")

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        if new_email:
            existing_email = db.query(User).filter(
                User.email == new_email,
                User.user_id != user_id
            ).first()
            if existing_email:
                return jsonify({"message": "Email already in use"}), 400
            user.email = new_email

        if new_username:
            existing_username = db.query(User).filter(
                User.username == new_username,
                User.user_id != user_id
            ).first()
            if existing_username:
                return jsonify({"message": "Username already taken"}), 400
            user.username = new_username

        if first_name:
            user.first_name = first_name
        if last_name:
            user.last_name = last_name

        db.commit()

        return jsonify({
            "message": "Profile updated successfully",
            "user": {
                "id": user.user_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "email": user.email,
                "username": user.username,
            }
        })
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@app.route("/staff-dashboard", methods=["GET"])
@role_required(["staff"])
@update_last_active
def staff_dashboard():
    return jsonify({"message": "Welcome, Staff!"})

@app.route("/admin-dashboard", methods=["GET"])
@role_required(["super_admin", "admin"])
@update_last_active
def admin_dashboard():
    return jsonify({"message": "Welcome, Admin!"})

@app.route("/user-status/<int:user_id>", methods=["GET"])
def user_status(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        now = datetime.utcnow()
        online_threshold = timedelta(minutes=5)

        if user.last_active and now - user.last_active <= online_threshold:
            status = "Online 🟢"
        else:
            minutes_ago = int((now - user.last_active).total_seconds() // 60) if user.last_active else None
            status = f"Last seen {minutes_ago} mins ago" if minutes_ago is not None else "Never logged in"

        return jsonify({
            "user_id": user.user_id,
            "full_name": f"{user.first_name} {user.last_name}",
            "status": status
        })
    finally:
        db.close()

@app.route("/users-status", methods=["GET"])
def all_users_status():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        now = datetime.utcnow()
        online_threshold = timedelta(minutes=5)

        results = []
        for u in users:
            if u.last_active and now - u.last_active <= online_threshold:
                status = "Online 🟢"
            else:
                minutes_ago = int((now - u.last_active).total_seconds() // 60) if u.last_active else None
                status = f"Last seen {minutes_ago} mins ago" if minutes_ago is not None else "Never logged in"

            results.append({
                "user_id": u.user_id,
                "full_name": f"{u.first_name} {u.last_name}",
                "status": status
            })

        return jsonify(results)
    finally:
        db.close()

@app.route("/upload-profile-pic", methods=["POST"])
@update_last_active
def upload_profile_pic():
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        return jsonify({"message": "Token missing"}), 401

    token = token.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        return jsonify({"message": "Invalid token"}), 401

    user_id = payload["user_id"]

    if "file" not in request.files:
        return jsonify({"message": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"message": "No selected file"}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        user.profile_pic = filepath
        db.commit()

        return jsonify({
            "message": "Profile picture uploaded",
            "profile_pic": filepath
        })
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@app.route("/my-profile", methods=["GET"])
def get_my_profile():
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        return jsonify({"message": "Token missing"}), 401

    token = token.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        return jsonify({"message": "Invalid token"}), 401

    user_id = payload["user_id"]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        return jsonify({
            "user_id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "profile_pic": user.profile_pic,
            "last_active": user.last_active.isoformat() if user.last_active else None,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "must_change_password": bool(getattr(user, "must_change_password", False)),
        })
    finally:
        db.close()

@app.route("/uploads/profile_pics/<filename>")
def get_profile_pic(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == "__main__":
    app.run(debug=Config.DEBUG, host="0.0.0.0", port=5000)