from database import SessionLocal
from crud_user import authenticate_user

db = SessionLocal()

user = authenticate_user(
    db=db,
    email="juan.delacruz@test.com",
    password="wrongpassword"
)

if user:
    print("Login successful:", user.email)
else:
    print("Invalid credentials")