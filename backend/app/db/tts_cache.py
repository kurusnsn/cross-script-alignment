from sqlalchemy import Column, String, DateTime, Index
from datetime import datetime

from app.db.base import Base


class TTSCache(Base):
    """
    TTS audio cache table.
    Stores pre-generated TTS audio for non-English text.
    """
    __tablename__ = "tts_cache"

    hash = Column(String, primary_key=True, index=True)  # SHA256 hash of text+lang
    text = Column(String, nullable=False)
    lang = Column(String, nullable=False)  # Language code (e.g., "fa", "ja", "ar")
    audio_url = Column(String, nullable=False)  # URL or base64 data URI
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Index for quick lookups by text+lang
    __table_args__ = (
        Index('idx_tts_text_lang', 'text', 'lang'),
    )

    def __repr__(self):
        return f"<TTSCache(hash={self.hash[:8]}, lang={self.lang}, text={self.text[:20]})>"
