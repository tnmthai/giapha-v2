from sqlalchemy import create_engine, Column, Integer, String, Text, Date, Boolean, DateTime, ForeignKey, Enum as SQLEnum, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from sqlalchemy.sql import func
import enum
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./giapha.db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class RelationshipType(str, enum.Enum):
    spouse = "spouse"
    ex_spouse = "ex_spouse"
    parent = "parent"
    step_parent = "step_parent"
    adoptive_parent = "adoptive_parent"
    guardian = "guardian"
    foster_parent = "foster_parent"
    child = "child"
    stepchild = "stepchild"
    adopted_child = "adopted_child"
    sibling = "sibling"
    half_sibling = "half_sibling"
    step_sibling = "step_sibling"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    display_name = Column(String(200))
    created_at = Column(DateTime, server_default=func.now())

    families = relationship("Family", back_populates="creator")


class Family(Base):
    __tablename__ = "families"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, server_default=func.now())
    shared_with = Column(JSON, default=list)  # List of {user_id, permission: "view"|"edit"}

    creator = relationship("User", back_populates="families")
    members = relationship("Member", back_populates="family", cascade="all, delete-orphan")


class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    family_id = Column(Integer, ForeignKey("families.id", ondelete="CASCADE"), nullable=False)
    full_name = Column(String(300), nullable=False)
    gender = Column(String(1), nullable=False)  # M/F
    birth_date = Column(String(20))  # Flexible: "1920", "1920-01-15", etc.
    death_date = Column(String(20))
    birth_place = Column(String(300))
    occupation = Column(String(200))
    bio = Column(Text)
    photo = Column(String(500))
    is_alive = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    family = relationship("Family", back_populates="members")
    relationships_from = relationship("MemberRelationship", foreign_keys="MemberRelationship.from_member_id", back_populates="from_member", cascade="all, delete-orphan")
    relationships_to = relationship("MemberRelationship", foreign_keys="MemberRelationship.to_member_id", back_populates="to_member", cascade="all, delete-orphan")


class MemberRelationship(Base):
    __tablename__ = "member_relationships"

    id = Column(Integer, primary_key=True, index=True)
    from_member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    to_member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False)
    relationship_type = Column(String(30), nullable=False)
    start_date = Column(String(20))
    end_date = Column(String(20))
    is_current = Column(Boolean, default=True)
    notes = Column(Text)

    from_member = relationship("Member", foreign_keys=[from_member_id], back_populates="relationships_from")
    to_member = relationship("Member", foreign_keys=[to_member_id], back_populates="relationships_to")


def create_tables():
    Base.metadata.create_all(bind=engine)
