# admin_routes.py

from flask import Blueprint, request, jsonify
from database import SessionLocal
from model import User
from utility import hash_password
from auth import role_required
from datetime import datetime
from auth import role_required, permission_required

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/admin")

ALLOWED_ROLES = ["prosecutor", "staff"]

@admin_bp.route("/users", methods=["POST"])
@role_required(["admin"])
@permission_required("USER_CREATE")
def create_user():
    data = request.get_json() or {}
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")
    role = data.get("role")

    if role not in ALLOWED_ROLES:
        return jsonify({"message": f"Role must be one of {ALLOWED_ROLES}"}), 400

    if not all([first_name, last_name, email, username, password, role]):
        return jsonify({"message": "Missing required fields"}), 400

    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            return jsonify({"message": "Email already exists"}), 400
        if db.query(User).filter(User.username == username).first():
            return jsonify({"message": "Username already exists"}), 400

        user = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
            username=username,
            password=hash_password(password),
            role=role
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return jsonify({"message": "User created", "user_id": user.user_id})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users", methods=["GET"])
@role_required(["admin"])
def get_users():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        return jsonify([
            {
                "user_id": u.user_id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "username": u.username,
                "role": u.role,
                "status": u.status,
                "must_change_password": bool(getattr(u, "must_change_password", False))
            }
            for u in users
        ])
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>", methods=["GET"])
@role_required(["admin"])
def get_user(user_id):
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
            "status": user.status,
            "must_change_password": bool(getattr(user, "must_change_password", False))
        })
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@role_required(["admin"])
@permission_required("USER_UPDATE")
def update_user(user_id):
    data = request.get_json() or {}

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        email = data.get("email")
        username = data.get("username")

        if email and email != user.email and db.query(User).filter(User.email == email).first():
            return jsonify({"message": "Email already exists"}), 400
        if username and username != user.username and db.query(User).filter(User.username == username).first():
            return jsonify({"message": "Username already exists"}), 400

        user.first_name = data.get("first_name", user.first_name)
        user.last_name = data.get("last_name", user.last_name)
        user.email = email or user.email
        user.username = username or user.username

        role = data.get("role")
        if role in ALLOWED_ROLES:
            user.role = role

        password = data.get("password")
        if password:
            user.password = hash_password(password)
            user.last_password_change = datetime.utcnow()
            user.must_change_password = True  # optional choice: force change next login

        db.commit()
        return jsonify({"message": "User updated"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@role_required(["admin"])
@permission_required("USER_DELETE")
def delete_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        db.delete(user)
        db.commit()
        return jsonify({"message": "User deleted"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>/lock", methods=["PUT"])
@role_required(["admin"])
@permission_required("USER_LOCK")
def lock_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        user.status = "locked"
        db.commit()
        return jsonify({"message": f"User {user_id} locked"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
        
@admin_bp.route("/users/<int:user_id>/unlock", methods=["PUT"])
@role_required(["admin"])
@permission_required("USER_UNLOCK")
def unlock_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        user.status = "active"
        user.failed_login_attempts = 0
        db.commit()
        return jsonify({"message": f"User {user_id} unlocked"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>/reset-password", methods=["PUT"])
@role_required(["admin"])
@permission_required("USER_RESET_PASSWORD")
def reset_password(user_id):
    data = request.get_json() or {}
    new_password = data.get("password")
    if not new_password:
        return jsonify({"message": "New password is required"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        user.password = hash_password(new_password)
        user.last_password_change = datetime.utcnow()
        user.must_change_password = True  # ✅ force change next login

        db.commit()
        return jsonify({"message": f"Password for user {user_id} has been reset"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>/permissions", methods=["PUT"])
@role_required(["admin"])
def set_user_permissions(user_id):
    data = request.get_json() or {}
    permissions = data.get("permissions")

    if not isinstance(permissions, list):
        return jsonify({"message": "permissions must be a list of strings"}), 400

    # Optional: ensure all items are strings
    if not all(isinstance(p, str) for p in permissions):
        return jsonify({"message": "permissions must contain only strings"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        user.permissions = permissions
        db.commit()
        return jsonify({"message": "Permissions updated", "user_id": user_id, "permissions": user.permissions})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()