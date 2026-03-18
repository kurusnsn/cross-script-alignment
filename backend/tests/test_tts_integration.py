import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.db.base import Base
from app.db.tts_cache import TTSCache
from app.services.tts_service import (
    get_or_generate_tts,
    check_tts_exists,
    is_english,
    make_cache_key
)


# Test database setup
@pytest.fixture(scope="function")
def test_db():
    """Create a test database for each test"""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    TestSessionLocal = sessionmaker(bind=engine)
    db = TestSessionLocal()
    yield db
    db.close()


class TestTTSCacheModel:
    """Test TTS cache SQLAlchemy model"""

    def test_create_tts_cache_entry(self, test_db: Session):
        """Test creating a TTS cache entry"""
        cache_entry = TTSCache(
            hash="abc123def456",
            text="کتاب",
            lang="fa",
            audio_url="data:audio/mp3;base64,SGVsbG8="
        )
        test_db.add(cache_entry)
        test_db.commit()

        # Verify entry was created
        retrieved = test_db.query(TTSCache).filter(TTSCache.hash == "abc123def456").first()
        assert retrieved is not None
        assert retrieved.text == "کتاب"
        assert retrieved.lang == "fa"
        assert retrieved.audio_url == "data:audio/mp3;base64,SGVsbG8="

    def test_tts_cache_unique_hash(self, test_db: Session):
        """Test that hash is unique (primary key)"""
        cache_entry1 = TTSCache(
            hash="same_hash",
            text="text1",
            lang="fa",
            audio_url="url1"
        )
        test_db.add(cache_entry1)
        test_db.commit()

        # Merge should update, not create duplicate
        cache_entry2 = TTSCache(
            hash="same_hash",
            text="text2",
            lang="fa",
            audio_url="url2"
        )
        test_db.merge(cache_entry2)
        test_db.commit()

        # Should have only one entry
        count = test_db.query(TTSCache).filter(TTSCache.hash == "same_hash").count()
        assert count == 1

        # Should have the updated values
        retrieved = test_db.query(TTSCache).filter(TTSCache.hash == "same_hash").first()
        assert retrieved.text == "text2"


class TestTTSHelperFunctions:
    """Test TTS service helper functions"""

    def test_is_english_true(self):
        """Test is_english function with English codes"""
        assert is_english("en") is True
        assert is_english("en-US") is True
        assert is_english("EN") is True
        assert is_english("En-GB") is True

    def test_is_english_false(self):
        """Test is_english function with non-English codes"""
        assert is_english("fa") is False
        assert is_english("ja") is False
        assert is_english("ar") is False
        assert is_english("ru") is False

    def test_make_cache_key(self):
        """Test cache key generation"""
        key1 = make_cache_key("hello", "en")
        key2 = make_cache_key("hello", "en")
        key3 = make_cache_key("hello", "fa")
        key4 = make_cache_key("world", "en")

        # Same text+lang should produce same key
        assert key1 == key2

        # Different lang should produce different key
        assert key1 != key3

        # Different text should produce different key
        assert key1 != key4

        # Keys should be SHA256 hashes (64 hex chars)
        assert len(key1) == 64
        assert all(c in "0123456789abcdef" for c in key1)


class TestTTSGeneration:
    """Test TTS generation and caching"""

    @pytest.mark.asyncio
    async def test_get_tts_for_english_returns_none(self, test_db: Session):
        """Test that English text returns None (no TTS generated)"""
        result = await get_or_generate_tts(test_db, "hello", "en")
        assert result is None

        result = await get_or_generate_tts(test_db, "world", "en-US")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_tts_cache_hit(self, test_db: Session):
        """Test TTS cache hit returns cached URL"""
        # Pre-populate cache
        cache_key = make_cache_key("کتاب", "fa")
        cached_url = "data:audio/mp3;base64,CACHED"
        cache_entry = TTSCache(
            hash=cache_key,
            text="کتاب",
            lang="fa",
            audio_url=cached_url
        )
        test_db.add(cache_entry)
        test_db.commit()

        # Should return cached URL without calling API
        result = await get_or_generate_tts(test_db, "کتاب", "fa")
        assert result == cached_url

    @pytest.mark.asyncio
    @patch('app.services.tts_service.httpx.AsyncClient')
    async def test_get_tts_generates_and_caches(self, mock_client, test_db: Session):
        """Test TTS generation and caching on cache miss"""
        # Mock the TTS service response
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.json.return_value = {
            "audio_b64": "SGVsbG8gV29ybGQ=",
            "hash": "somehash",
            "cached": False
        }

        mock_client_instance = MagicMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # Generate TTS
        result = await get_or_generate_tts(test_db, "犬", "ja")

        # Should return data URI
        assert result is not None
        assert result.startswith("data:audio/mp3;base64,")
        assert "SGVsbG8gV29ybGQ=" in result

        # Should be cached in database
        cache_key = make_cache_key("犬", "ja")
        cached = test_db.query(TTSCache).filter(TTSCache.hash == cache_key).first()
        assert cached is not None
        assert cached.text == "犬"
        assert cached.lang == "ja"
        assert cached.audio_url == result

    @pytest.mark.asyncio
    @patch('app.services.tts_service.httpx.AsyncClient')
    async def test_get_tts_handles_api_failure(self, mock_client, test_db: Session):
        """Test TTS generation handles API failures gracefully"""
        # Mock failed response
        mock_response = MagicMock()
        mock_response.is_success = False
        mock_response.status_code = 500
        mock_response.text = "Internal server error"

        mock_client_instance = MagicMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # Should return None on failure
        result = await get_or_generate_tts(test_db, "犬", "ja")
        assert result is None

        # Should not cache failed result
        cache_key = make_cache_key("犬", "ja")
        cached = test_db.query(TTSCache).filter(TTSCache.hash == cache_key).first()
        assert cached is None

    @pytest.mark.asyncio
    async def test_check_tts_exists_found(self, test_db: Session):
        """Test check_tts_exists returns URL when cached"""
        # Pre-populate cache
        cache_key = make_cache_key("猫", "ja")
        cached_url = "data:audio/mp3;base64,CAT"
        cache_entry = TTSCache(
            hash=cache_key,
            text="猫",
            lang="ja",
            audio_url=cached_url
        )
        test_db.add(cache_entry)
        test_db.commit()

        result = await check_tts_exists(test_db, "猫", "ja")
        assert result == cached_url

    @pytest.mark.asyncio
    async def test_check_tts_exists_not_found(self, test_db: Session):
        """Test check_tts_exists returns None when not cached"""
        result = await check_tts_exists(test_db, "uncached text", "ja")
        assert result is None

    @pytest.mark.asyncio
    async def test_check_tts_exists_english_returns_none(self, test_db: Session):
        """Test check_tts_exists returns None for English"""
        result = await check_tts_exists(test_db, "hello", "en")
        assert result is None


class TestTTSQuizIntegration:
    """Test TTS integration with quiz system"""

    @pytest.mark.asyncio
    @patch('app.services.tts_service.httpx.AsyncClient')
    async def test_quiz_question_includes_tts_for_non_english(self, mock_client, test_db: Session):
        """Test that quiz questions include TTS URL for non-English text"""
        # Mock TTS service
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.json.return_value = {
            "audio_b64": "PERSIAN_AUDIO",
            "hash": "hash",
            "cached": False
        }

        mock_client_instance = MagicMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # Generate TTS for a Persian word
        tts_url = await get_or_generate_tts(test_db, "کتاب", "fa")

        # Quiz question should have audio_url
        assert tts_url is not None
        assert "audio/mp3" in tts_url
        assert "PERSIAN_AUDIO" in tts_url

    @pytest.mark.asyncio
    async def test_quiz_question_no_tts_for_english(self, test_db: Session):
        """Test that quiz questions exclude TTS URL for English text"""
        # English translation should not have TTS
        tts_url = await get_or_generate_tts(test_db, "book", "en")
        assert tts_url is None

    @pytest.mark.asyncio
    @patch('app.services.tts_service.httpx.AsyncClient')
    async def test_quiz_uses_cached_tts(self, mock_client, test_db: Session):
        """Test that repeated quiz questions use cached TTS"""
        # Mock TTS service
        mock_response = MagicMock()
        mock_response.is_success = True
        mock_response.json.return_value = {
            "audio_b64": "JAPANESE_AUDIO",
            "hash": "hash",
            "cached": False
        }

        mock_client_instance = MagicMock()
        mock_client_instance.post = AsyncMock(return_value=mock_response)
        mock_client.return_value.__aenter__.return_value = mock_client_instance

        # First request - generates and caches
        tts_url_1 = await get_or_generate_tts(test_db, "犬", "ja")
        assert tts_url_1 is not None

        # Second request - should use cache (API not called again)
        mock_client_instance.post.reset_mock()
        tts_url_2 = await get_or_generate_tts(test_db, "犬", "ja")

        # Should return same URL
        assert tts_url_2 == tts_url_1

        # API should not have been called
        mock_client_instance.post.assert_not_called()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
