# database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "postgresql://postgres.upekluexmtnqvnymjuge:himo%26inghugthesis@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres"

engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    expire_on_commit=False,  # prevents DetachedInstanceError after commit
)

Base = declarative_base()