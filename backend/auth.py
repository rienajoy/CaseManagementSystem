# auth.py
from functools import wraps
from flask import request, jsonify
from utility import verify_jwt
from datetime import datetime
from database import SessionLocal
from model import User

# Routes user can access even when must_change_password=True
ALLOW_WHEN_MUST_CHANGE = {
    "/login",
    "/change-password",
    "/my-profile",
}

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = request.headers.get("Authorization")  # Bearer <token>
            if not token or not token.startswith("Bearer "):
                return jsonify({"message": "Unauthorized"}), 403

            token = token.split(" ")[1]
            payload = verify_jwt(token)
            if not payload:
                return jsonify({"message": "Unauthorized"}), 403

            if payload.get("role") not in allowed_roles:
                return jsonify({"message": "Unauthorized"}), 403

            # Enforce forced password change
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.user_id == payload["user_id"]).first()
                if not user:
                    return jsonify({"message": "Unauthorized"}), 403

                if getattr(user, "must_change_password", False):
                    if request.path not in ALLOW_WHEN_MUST_CHANGE:
                        return jsonify({"message": "Password change required"}), 403
            finally:
                db.close()

            return f(*args, **kwargs)
        return wrapper
    return decorator

def permission_required(permission: str):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = request.headers.get("Authorization")
            if not token or not token.startswith("Bearer "):
                return jsonify({"message": "Unauthorized"}), 403

            token = token.split(" ")[1]
            payload = verify_jwt(token)
            if not payload:
                return jsonify({"message": "Unauthorized"}), 403

            db = SessionLocal()
            try:
                user = db.query(User).filter(User.user_id == payload["user_id"]).first()
                if not user:
                    return jsonify({"message": "Unauthorized"}), 403

                perms = user.permissions or []
                if permission not in perms:
                    return jsonify({"message": "Forbidden", "missing_permission": permission}), 403
            finally:
                db.close()

            return f(*args, **kwargs)
        return wrapper
    return decorator

def update_last_active(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("Authorization")
        if token and token.startswith("Bearer "):
            token = token.split(" ")[1]
            payload = verify_jwt(token)
            if payload:
                db = SessionLocal()
                try:
                    user = db.query(User).filter(User.user_id == payload["user_id"]).first()
                    if user:
                        user.last_active = datetime.utcnow()
                        db.commit()
                finally:
                    db.close()
        return f(*args, **kwargs)
    return wrapper