from datetime import datetime
from flask import Blueprint, request, jsonify

from database import SessionLocal
from model import User, AdminActionLog
from utility import hash_password, verify_jwt
from app.middleware.auth import role_required, permission_required

admin_bp = Blueprint("admin_bp", __name__, url_prefix="/admin")

ALLOWED_ROLES = ["admin", "prosecutor", "staff"]
AVAILABLE_PERMISSIONS = [
    "USER_CREATE",
    "USER_UPDATE",
    "USER_DELETE",
    "USER_LOCK",
    "USER_UNLOCK",
    "USER_RESET_PASSWORD",
]

def log_admin_action(
    db,
    admin_user,
    action,
    target_user=None,
    details=None
):
    log = AdminActionLog(
        admin_user_id=admin_user.user_id,
        admin_name=f"{admin_user.first_name} {admin_user.last_name}",
        action=action,
        target_user_id=target_user.user_id if target_user else None,
        target_name=f"{target_user.first_name} {target_user.last_name}" if target_user else None,
        details=details
    )
    db.add(log)

def can_manage_target(actor, target):
    if actor.role == "super_admin":
        return True

    if actor.role == "admin":
        if target.role in ["super_admin", "admin"]:
            return False
        return True

    return False

def get_current_admin_user(db):
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        return None

    token = token.split(" ")[1]
    payload = verify_jwt(token)
    if not payload:
        return None

    return db.query(User).filter(User.user_id == payload["user_id"]).first()

@admin_bp.route("/permissions", methods=["GET"])
@role_required(["super_admin", "admin"])
def get_available_permissions():
    return jsonify(AVAILABLE_PERMISSIONS)

@admin_bp.route("/users", methods=["POST"])
@role_required(["super_admin", "admin"])
@permission_required("USER_CREATE")
def create_user():
    data = request.get_json() or {}
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    email = data.get("email")
    username = data.get("username")
    password = data.get("password")
    role = data.get("role")
    permissions = data.get("permissions", [])

    if not all([first_name, last_name, email, username, password, role]):
        return jsonify({"message": "Missing required fields"}), 400

    if role not in ALLOWED_ROLES:
        return jsonify({"message": f"Role must be one of {ALLOWED_ROLES}"}), 400

    db = SessionLocal()
    try:
        admin_user = get_current_admin_user(db)
        if not admin_user:
            return jsonify({"message": "Unauthorized"}), 401

        if role == "admin" and admin_user.role != "super_admin":
            return jsonify({"message": "Only super admin can create admin accounts"}), 403

        if db.query(User).filter(User.email == email).first():
            return jsonify({"message": "Email already exists"}), 400

        if db.query(User).filter(User.username == username).first():
            return jsonify({"message": "Username already exists"}), 400

        if role != "admin":
            permissions = []

        user = User(
            first_name=first_name,
            last_name=last_name,
            email=email,
            username=username,
            password=hash_password(password),
            role=role,
            permissions=permissions,
            must_change_password=True
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        log_admin_action(
            db=db,
            admin_user=admin_user,
            action="CREATE_USER",
            target_user=user,
            details=f"Created {role} account with username '{username}'"
        )
        db.commit()

        return jsonify({
            "message": "User created",
            "user_id": user.user_id
        }), 201

    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users", methods=["GET"])
@role_required(["super_admin", "admin"])
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
                "profile_pic": u.profile_pic,
                "must_change_password": bool(getattr(u, "must_change_password", False)),
                "permissions": u.permissions if isinstance(u.permissions, list) else []
            }
            for u in users
        ])
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>", methods=["GET"])
@role_required(["super_admin", "admin"])
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
@role_required(["super_admin", "admin"])
@permission_required("USER_UPDATE")
def update_user(user_id):
    data = request.get_json() or {}

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        admin_user = get_current_admin_user(db)
        if not admin_user:
            return jsonify({"message": "Unauthorized"}), 401

        if not can_manage_target(admin_user, user):
            return jsonify({"message": "You are not allowed to manage this account"}), 403

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
        if role:
            if role == "admin" and admin_user.role != "super_admin":
                return jsonify({"message": "Only super admin can assign admin role"}), 403

            if role == "super_admin":
                return jsonify({"message": "super_admin role cannot be assigned here"}), 403

            if role in ALLOWED_ROLES:
                user.role = role

        password = data.get("password")
        if password:
            user.password = hash_password(password)
            user.last_password_change = datetime.utcnow()
            user.must_change_password = True

        log_admin_action(
            db=db,
            admin_user=admin_user,
            action="UPDATE_USER",
            target_user=user,
            details=f"Updated account for username '{user.username}'"
        )

        db.commit()
        return jsonify({"message": "User updated"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@role_required(["super_admin", "admin"])
@permission_required("USER_DELETE")
def delete_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        admin_user = get_current_admin_user(db)
        if not admin_user:
            return jsonify({"message": "Unauthorized"}), 401

        if admin_user.user_id == user.user_id:
            return jsonify({"message": "You cannot delete your own account"}), 400

        if not can_manage_target(admin_user, user):
            return jsonify({"message": "You are not allowed to manage this account"}), 403

        log_admin_action(
            db=db,
            admin_user=admin_user,
            action="DELETE_USER",
            target_user=user,
            details="User account deleted by admin"
        )

        db.delete(user)
        db.commit()

        return jsonify({"message": "User deleted"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>/lock", methods=["PUT"])
@role_required(["super_admin", "admin"])
@permission_required("USER_LOCK")
def lock_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        admin_user = get_current_admin_user(db)
        if not admin_user:
            return jsonify({"message": "Unauthorized"}), 401

        if admin_user.user_id == user.user_id:
            return jsonify({"message": "You cannot lock your own account"}), 400

        if not can_manage_target(admin_user, user):
            return jsonify({"message": "You are not allowed to manage this account"}), 403

        user.status = "locked"

        log_admin_action(
            db=db,
            admin_user=admin_user,
            action="LOCK_USER",
            target_user=user,
            details="Account locked by admin"
        )

        db.commit()
        return jsonify({"message": f"User {user_id} locked"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>/unlock", methods=["PUT"])
@role_required(["super_admin", "admin"])
@permission_required("USER_UNLOCK")
def unlock_user(user_id):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        admin_user = get_current_admin_user(db)
        if not admin_user:
            return jsonify({"message": "Unauthorized"}), 401

        if not can_manage_target(admin_user, user):
            return jsonify({"message": "You are not allowed to manage this account"}), 403

        user.status = "active"
        user.failed_login_attempts = 0

        log_admin_action(
            db=db,
            admin_user=admin_user,
            action="UNLOCK_USER",
            target_user=user,
            details="Account unlocked by admin"
        )

        db.commit()
        return jsonify({"message": f"User {user_id} unlocked"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>/reset-password", methods=["PUT"])
@role_required(["super_admin", "admin"])
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

        admin_user = get_current_admin_user(db)
        if not admin_user:
            return jsonify({"message": "Unauthorized"}), 401

        if not can_manage_target(admin_user, user):
            return jsonify({"message": "You are not allowed to manage this account"}), 403

        user.password = hash_password(new_password)
        user.last_password_change = datetime.utcnow()
        user.must_change_password = True

        log_admin_action(
            db=db,
            admin_user=admin_user,
            action="RESET_PASSWORD",
            target_user=user,
            details="Password reset and must_change_password set to True"
        )

        db.commit()
        return jsonify({"message": f"Password for user {user_id} has been reset"})
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/users/<int:user_id>/permissions", methods=["PUT"])
@role_required(["super_admin"])
def set_user_permissions(user_id):
    data = request.get_json() or {}
    permissions = data.get("permissions")

    if not isinstance(permissions, list):
        return jsonify({"message": "permissions must be a list of strings"}), 400

    if not all(isinstance(p, str) for p in permissions):
        return jsonify({"message": "permissions must contain only strings"}), 400

    invalid_permissions = [p for p in permissions if p not in AVAILABLE_PERMISSIONS]
    if invalid_permissions:
        return jsonify({"message": f"Invalid permissions: {invalid_permissions}"}), 400

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            return jsonify({"message": "User not found"}), 404

        admin_user = get_current_admin_user(db)
        if not admin_user:
            return jsonify({"message": "Unauthorized"}), 401

        if admin_user.user_id == user.user_id:
            return jsonify({"message": "You cannot modify your own permissions"}), 400

        if user.role != "admin":
            return jsonify({
                "message": "Permissions can only be assigned to regular admin accounts"
            }), 403

        user.permissions = permissions

        log_admin_action(
            db=db,
            admin_user=admin_user,
            action="SET_PERMISSIONS",
            target_user=user,
            details=f"Updated permissions: {permissions}"
        )

        db.commit()
        db.refresh(user)

        return jsonify({
            "message": "Permissions updated",
            "user_id": user.user_id,
            "permissions": user.permissions if isinstance(user.permissions, list) else []
        })
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

@admin_bp.route("/action-logs", methods=["GET"])
@role_required(["super_admin", "admin"])
def get_admin_action_logs():
    db = SessionLocal()
    try:
        logs = (
            db.query(AdminActionLog)
            .order_by(AdminActionLog.created_at.desc())
            .limit(20)
            .all()
        )

        return jsonify([
            {
                "log_id": log.log_id,
                "admin_user_id": log.admin_user_id,
                "admin_name": log.admin_name,
                "action": log.action,
                "target_user_id": log.target_user_id,
                "target_name": log.target_name,
                "details": log.details,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ])
    finally:
        db.close()