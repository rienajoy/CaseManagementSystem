# model.py
from sqlalchemy import Column, Integer, String, DateTime, Boolean, JSON
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)

    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)

    password = Column(String, nullable=False)
    role = Column(String, nullable=False)  # admin/staff/prosecutor

    status = Column(String, default="offline")
    failed_login_attempts = Column(Integer, default=0)

    must_change_password = Column(Boolean, default=False, nullable=False)
    last_password_change = Column(DateTime, default=datetime.utcnow, nullable=False)

    # ✅ NEW: permissions as a list of strings in JSON (Postgres jsonb)
    permissions = Column(JSON, default=list, nullable=False)

    last_active = Column(DateTime, default=datetime.utcnow)
    profile_pic = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)