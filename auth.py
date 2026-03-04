from functools import wraps
from flask import request, jsonify
from utility import verify_jwt

def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            token = request.headers.get("Authorization")  # Bearer <token>
            if token and token.startswith("Bearer "):
                token = token.split(" ")[1]
                payload = verify_jwt(token)
                if payload and payload["role"] in allowed_roles:
                    return f(*args, **kwargs)
            return jsonify({"message": "Unauthorized"}), 403
        return wrapper
    return decorator