import hashlib
import httpx
import structlog
from typing import Optional
from sqlalchemy.orm import Session

from app.db.tts_cache import TTSCache
from app.utils.config import get_settings

logger = structlog.get_logger(__name__)
settings = get_settings()

TTS_SERVICE_URL = settings.tts_service_url


def is_english(lang_code: str) -> bool:
    """Check if language code is English"""
    return lang_code.lower().startswith("en")


def make_cache_key(text: str, lang: str) -> str:
    """Generate cache key hash from text and language"""
    return hashlib.sha256(f"{text}-{lang}".encode()).hexdigest()


async def get_or_generate_tts(
    db: Session,
    text: str,
    lang: str,
    force_generate: bool = False
) -> Optional[str]:
    """
    Get TTS audio URL from cache or generate new one.

    Args:
        db: Database session
        text: Text to convert to speech
        lang: Language code (e.g., "fa", "ja", "ar")
        force_generate: Skip cache and force generation

    Returns:
        Audio URL (data URI with base64) or None if generation fails
    """
    # Don't generate TTS for English text
    if is_english(lang):
        logger.info("Skipping TTS for English text", text=text[:30])
        return None

    cache_key = make_cache_key(text, lang)

    # Check cache first (unless force_generate is True)
    if not force_generate:
        cached = db.query(TTSCache).filter(TTSCache.hash == cache_key).first()
        if cached:
            logger.info("TTS cache hit", hash=cache_key[:8], lang=lang)
            return cached.audio_url

    # Generate new TTS audio
    try:
        logger.info("Generating new TTS", text=text[:30], lang=lang)

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{TTS_SERVICE_URL}/tts",
                json={
                    "text": text,
                    "lang": lang,
                }
            )

            if not response.is_success:
                logger.error(
                    "TTS generation failed",
                    status_code=response.status_code,
                    error=response.text
                )
                return None

            data = response.json()

            # Create data URI from base64 audio
            audio_b64 = data.get("audio_b64")
            if not audio_b64:
                logger.error("No audio data in TTS response")
                return None

            audio_url = f"data:audio/mp3;base64,{audio_b64}"

            # Cache the result
            cache_entry = TTSCache(
                hash=cache_key,
                text=text,
                lang=lang,
                audio_url=audio_url
            )
            db.merge(cache_entry)  # Use merge to handle duplicates
            db.commit()

            logger.info("TTS generated and cached", hash=cache_key[:8], lang=lang)
            return audio_url

    except Exception as e:
        logger.error("TTS generation error", error=str(e), text=text[:30], lang=lang)
        return None


async def check_tts_exists(db: Session, text: str, lang: str) -> Optional[str]:
    """
    Check if TTS audio exists in cache without generating.

    Args:
        db: Database session
        text: Text to check
        lang: Language code

    Returns:
        Audio URL if cached, None otherwise
    """
    if is_english(lang):
        return None

    cache_key = make_cache_key(text, lang)
    cached = db.query(TTSCache).filter(TTSCache.hash == cache_key).first()

    if cached:
        logger.info("TTS cache check - found", hash=cache_key[:8])
        return cached.audio_url

    logger.info("TTS cache check - not found", hash=cache_key[:8])
    return None
