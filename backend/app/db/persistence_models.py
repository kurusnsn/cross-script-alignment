from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    supabase_id = Column(String, unique=True, index=True, nullable=True) # UUID as string or use UUID type
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Stripe subscription fields
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    is_pro = Column(Boolean, default=False)

    folders = relationship("Folder", back_populates="user")
    history_items = relationship("HistoryItem", back_populates="user")
    vocabulary_items = relationship("VocabularyItem", back_populates="user")


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="folders")
    history_items = relationship("HistoryItem", back_populates="folder")

class HistoryItem(Base):
    __tablename__ = "history_items"

    id = Column(Integer, primary_key=True, index=True)
    original = Column(Text, nullable=False)
    aligneration = Column(Text, nullable=False)
    translation = Column(Text, nullable=False)
    ipa = Column(Text, nullable=True)
    alignment_data = Column(JSON, nullable=True)
    result_json = Column(JSON, nullable=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="history_items")
    folder = relationship("Folder", back_populates="history_items")

class VocabularyItem(Base):
    __tablename__ = "vocabulary_items"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String, nullable=False)
    aligneration = Column(String, nullable=False)
    translation = Column(String, nullable=False)
    language_code = Column(String, nullable=False, default="en")
    ipa = Column(String, nullable=True)
    pos = Column(String, nullable=True)
    context = Column(Text, nullable=True)
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="vocabulary_items")


class QuizResult(Base):
    __tablename__ = "quiz_results"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    word_id = Column(Integer, ForeignKey("vocabulary_items.id"), nullable=False)
    correct = Column(Boolean, nullable=False)
    answered_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    word = relationship("VocabularyItem")
