from app.db.base import Base

# Import SQLAlchemy models here to ensure they are registered with the metadata.
from app.db.tts_cache import TTSCache  # noqa: F401
from app.db.persistence_models import User, Folder, HistoryItem  # noqa: F401
