from database import SessionLocal
from crud_user import create_user

db = SessionLocal()

user = create_user(
    db=db,
    first_name="Juan",
    last_name="Dela Cruz",
    email="juan.delacruz@test.com",
    password="password123",
    role="Admin"
)

print("User created:", user.email)