# auth.py
from functools import wraps
from flask import request, jsonify
from datetime import datetime

from database import SessionLocal
from model import User
from utility import verify_jwt

# Routes that are allowed even when the user must change password
ALLOW_WHEN_MUST_CHANGE = {
    "/login",
    "/change-password",
    "/my-profile",
}

def get_current_user_from_token(token: str):
    """Helper to decode token and return the user object, or None."""
    payload = verify_jwt(token)
    if not payload:
        return None

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == payload["user_id"]).first()
        return user
    finally:
        db.close()

def role_required(allowed_roles):
    """Decorator to allow only specific roles."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = request.headers.get("Authorization")
            if not token or not token.startswith("Bearer "):
                return jsonify({"message": "Unauthorized"}), 403

            token = token.split(" ")[1]
            user = get_current_user_from_token(token)
            if not user:
                return jsonify({"message": "Unauthorized"}), 403

            if user.role not in allowed_roles:
                return jsonify({
                    "message": "Unauthorized",
                    "current_role": user.role,
                    "allowed_roles": allowed_roles
                }), 403

            if getattr(user, "must_change_password", False):
                if request.path not in ALLOW_WHEN_MUST_CHANGE:
                    return jsonify({"message": "Password change required"}), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator

def permission_required(permission: str):
    """Decorator to allow only users with specific permissions."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = request.headers.get("Authorization")
            if not token or not token.startswith("Bearer "):
                return jsonify({"message": "Unauthorized"}), 403

            token = token.split(" ")[1]
            user = get_current_user_from_token(token)
            if not user:
                return jsonify({"message": "Unauthorized"}), 403

            # Super admin bypasses permission check
            if user.role == "super_admin":
                return f(*args, **kwargs)

            perms = user.permissions or []
            if permission not in perms:
                return jsonify({
                    "message": "Forbidden",
                    "missing_permission": permission
                }), 403

            return f(*args, **kwargs)
        return wrapper
    return decorator

def update_last_active(f):
    """Decorator to update the user's last_active timestamp."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization")
        if token and token.startswith("Bearer "):
            token = token.split(" ")[1]
            user = get_current_user_from_token(token)
            if user:
                db = SessionLocal()
                try:
                    db_user = db.query(User).filter(User.user_id == user.user_id).first()
                    if db_user:
                        db_user.last_active = datetime.utcnow()
                        db.commit()
                finally:
                    db.close()
        return f(*args, **kwargs)
    return wrapper

def get_current_user():
    """Return current user object from request token."""
    token = request.headers.get("Authorization")
    if not token or not token.startswith("Bearer "):
        return None

    token = token.split(" ")[1]
    return get_current_user_from_token(token)