from flask import Flask, request, jsonify
from database import engine, SessionLocal
from model import Base, User
from crud_user import authenticate_user, create_user
from utility import create_jwt, verify_password, hash_password
from auth import role_required, update_last_active
from datetime import datetime, timedelta

# Create tables (only runs once if tables already exist)
Base.metadata.create_all(bind=engine)

app = Flask(__name__)

# ===== LOGIN ROUTE WITH FAILED LOGIN TRACKING =====
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    db = SessionLocal()
    user = db.query(User).filter(User.email == email).first()

    if not user:
        db.close()
        return jsonify({"message": "Invalid credentials"}), 401

    # Check if user is locked out
    if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
        # Optional: check last failed attempt time if you track it
        db.close()
        return jsonify({"message": f"Account locked. Try again after {LOCKOUT_DURATION_MINUTES} minutes"}), 403

    if not verify_password(password, user.password):
        user.failed_login_attempts += 1
        db.commit()
        db.close()
        return jsonify({"message": "Invalid credentials"}), 401

    # Reset failed attempts on successful login
    user.failed_login_attempts = 0
    user.last_active = datetime.utcnow()
    db.commit()
    db.refresh(user)
    db.close()

    token = create_jwt(user.user_id, user.role)
    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user.user_id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role,
            "last_active": user.last_active.isoformat()
        },
        "token": token
    })

# ===== PASSWORD CHANGE =====
@app.route("/change-password", methods=["POST"])
@update_last_active
def change_password():
    data = request.json
    user_id = data.get("user_id")
    old_password = data.get("old_password")
    new_password = data.get("new_password")

    db = SessionLocal()
    user = db.query(User).filter(User.user_id == user_id).first()

    if not user:
        db.close()
        return jsonify({"message": "User not found"}), 404

    if not verify_password(old_password, user.password):
        db.close()
        return jsonify({"message": "Old password is incorrect"}), 401

    user.password = hash_password(new_password)
    user.last_password_change = datetime.utcnow()
    db.commit()
    db.refresh(user)
    db.close()

    return jsonify({"message": "Password updated successfully"})

# ===== PROFILE UPDATE =====
@app.route("/update-profile", methods=["POST"])
@update_last_active
def update_profile():
    data = request.json
    user_id = data.get("user_id")
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    profile_pic = data.get("profile_pic")  # URL or base64 string

    db = SessionLocal()
    user = db.query(User).filter(User.user_id == user_id).first()

    if not user:
        db.close()
        return jsonify({"message": "User not found"}), 404

    if first_name:
        user.first_name = first_name
    if last_name:
        user.last_name = last_name
    if profile_pic:
        user.profile_pic = profile_pic

    db.commit()
    db.refresh(user)
    db.close()

    return jsonify({"message": "Profile updated successfully"})

# ===== PROTECTED DASHBOARDS =====
@app.route("/staff-dashboard", methods=["GET"])
@role_required(["staff"])
@update_last_active
def staff_dashboard():
    return jsonify({"message": "Welcome, Staff!"})

@app.route("/admin-dashboard", methods=["GET"])
@role_required(["admin"])
@update_last_active
def admin_dashboard():
    return jsonify({"message": "Welcome, Admin!"})

# ===== USER STATUS ENDPOINTS =====
@app.route("/user-status/<int:user_id>", methods=["GET"])
def user_status(user_id):
    db = SessionLocal()
    user = db.query(User).filter(User.user_id == user_id).first()
    db.close()

    if not user:
        return jsonify({"message": "User not found"}), 404

    now = datetime.utcnow()
    online_threshold = timedelta(minutes=5)

    if now - user.last_active <= online_threshold:
        status = "Online 🟢"
    else:
        minutes_ago = int((now - user.last_active).total_seconds() // 60)
        status = f"Last seen {minutes_ago} mins ago"

    return jsonify({
        "user_id": user.user_id,
        "full_name": f"{user.first_name} {user.last_name}",
        "status": status
    })

@app.route("/users-status", methods=["GET"])
def all_users_status():
    db = SessionLocal()
    users = db.query(User).all()
    db.close()

    now = datetime.utcnow()
    online_threshold = timedelta(minutes=5)

    results = []
    for u in users:
        if now - u.last_active <= online_threshold:
            status = "Online 🟢"
        else:
            minutes_ago = int((now - u.last_active).total_seconds() // 60)
            status = f"Last seen {minutes_ago} mins ago"
        results.append({
            "user_id": u.user_id,
            "full_name": f"{u.first_name} {u.last_name}",
            "status": status
        })

    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)