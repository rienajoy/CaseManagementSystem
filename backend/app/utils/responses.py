#backend/app/utils/responses.py


from flask import jsonify
# -----------------------------
# Generic response helpers
# -----------------------------
def success_response(message, data=None, status_code=200, **extra):
    payload = {
        "success": True,
        "message": message,
        "data": data,
    }
    payload.update(extra)
    return jsonify(payload), status_code


def error_response(message, errors=None, status_code=400, **extra):
    payload = {
        "success": False,
        "message": message,
        "errors": errors or [],
    }
    payload.update(extra)
    return jsonify(payload), status_code