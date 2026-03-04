from flask import Flask, request, jsonify
from model import Base, User
from database import engine, SessionLocal
from utility import hash_password, verify_password  # your utility functions
from auth import role_required 


app = Flask(__name__)


# ===== LOGIN ROUTE =====
@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    session = SessionLocal()
    user = session.query(User).filter_by(email=email).first()
    session.close()

    if user and verify_password(password, user.password):
        token = create_jwt(user.id, user.role)
        return jsonify({
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "token": token
        })
    else:
        return jsonify({"message": "Invalid credentials"}), 401

# ===== PROTECTED ROUTES WITH RBAC =====
@app.route("/admin-dashboard", methods=["GET"])
@role_required(["admin"])
def admin_dashboard():
    return jsonify({"message": "Welcome, Admin!"})

@app.route("/staff-dashboard", methods=["GET"])
@role_required(["staff"])
def staff_dashboard():
    return jsonify({"message": "Welcome, Staff!"})

# ===== RUN SERVER =====
if __name__ == "__main__":
    app.run(debug=True)