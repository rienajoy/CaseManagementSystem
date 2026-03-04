from flask import Flask, request, jsonify
from database import engine, SessionLocal
from model import Base
from crud_user import authenticate_user

# Create tables (only runs once if tables already exist)
Base.metadata.create_all(bind=engine)

app = Flask(__name__)


@app.route("/")
def home():
    return {"message": "Case Management System API Running"}


@app.route("/login", methods=["POST"])
def login():
    data = request.json

    email = data.get("email")
    password = data.get("password")

    db = SessionLocal()
    user = authenticate_user(db, email, password)

    if not user:
        return jsonify({"message": "Invalid credentials"}), 401

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "role": user.role
        }
    })


if __name__ == "__main__":
    app.run(debug=True)