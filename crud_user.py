from sqlalchemy.orm import Session
from model import User
from utility import hash_password
from utility import verify_password


def create_user(
    db: Session,
    first_name: str,
    last_name: str,
    email: str,
    password: str,
    role: str
):
    hashed_pw = hash_password(password)

    user = User(
        first_name=first_name,
        last_name=last_name,
        email=email,
        password=hashed_pw,
        role=role
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return user





def authenticate_user(db: Session, email: str, password: str):
    user = db.query(User).filter(User.email == email).first()

    if not user:
        return None

    if not verify_password(password, user.password):
        return None

    return user    