from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "postgresql://postgres.ofxxjzwmprzyizuwswkp:himo&inghugthesis@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"


engine = create_engine(DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()