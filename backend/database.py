from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Using SQLite for a frictionless local file DB without requiring PostgreSQL server installation
SQLALCHEMY_DATABASE_URL = "sqlite:///./musicapp.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
