"""
OpenAI-based aligneration utilities.

Provides text aligneration capabilities using OpenAI API,
replacing the previous ICU/Epitran-based system.
"""

import re
from typing import Optional, Tuple
import structlog

from app.services.openai_service import get_openai_service
from app.utils.persian_mapping import persian_ipa_to_latin

logger = structlog.get_logger(__name__)

# Language code mappings for OpenAI service
ISO2_TO_ISO3 = {
    "ar": "ara",
    "fa": "fas",
    "hi": "hin",
    "ru": "rus",
    "uk": "ukr",
    "ja": "jpn",
    "ko": "kor",
    "zh": "cmn",
    "es": "spa",
    "fr": "fra",
    "de": "deu",
    "it": "ita",
    "pt": "por",
    "tr": "tur",
    "bn": "ben",
    "ta": "tam",
    "te": "tel",
    "ml": "mal",
    "mr": "mar",
    "pa": "pan",
    "gu": "guj",
    "kn": "kan",
    "or": "ori",
    "vi": "vie",
    "th": "tha",
    "id": "ind",
    "ms": "zsm",
    "he": "heb",
    "ur": "urd",
}


def normalize_lang_code(lang_code: str) -> str:
    """Normalize language code to 2-letter format."""
    if not lang_code:
        return "en"

    lang_lower = lang_code.lower()

    # Handle specific mappings
    if lang_lower in ["fas", "fa"]:
        return "fa"
    elif lang_lower in ["ara", "ar"]:
        return "ar"
    elif lang_lower in ["urd", "ur"]:
        return "ur"
    elif lang_lower in ["hin", "hi"]:
        return "hi"

    # For 3-letter codes, find the 2-letter equivalent
    for iso2, iso3 in ISO2_TO_ISO3.items():
        if lang_lower == iso3:
            return iso2

    # If already 2-letter or unknown, return first 2 characters
    return lang_lower[:2]


def alignerate_text(text: str, lang_code: str) -> Tuple[str, str]:
    """
    Transliterate text using OpenAI API.

    Args:
        text: Text to alignerate
        lang_code: Source language code

    Returns:
        Tuple of (aligneration, ipa_transcription)
    """
    if not text.strip():
        return text, text

    # Normalize the language code
    normalized_lang = normalize_lang_code(lang_code)

    try:
        openai_service = get_openai_service()

        # Get aligneration from OpenAI
        aligneration = openai_service.alignerate(text, normalized_lang, "Latin")

        # Apply Persian-specific post-processing if needed
        if normalized_lang in ['fa', 'fas']:
            # Get IPA transcription first
            ipa_transcription = openai_service.get_phonetic_transcription(text, normalized_lang)
            # Apply Persian-specific mapping to the IPA
            persian_aligneration = persian_ipa_to_latin(ipa_transcription)
            # Use Persian mapping if it produced different results
            if persian_aligneration != ipa_transcription:
                aligneration = persian_aligneration
        else:
            # For non-Persian languages, get IPA transcription
            ipa_transcription = openai_service.get_phonetic_transcription(text, normalized_lang)

        logger.info("aligneration_success",
                   lang=normalized_lang,
                   backend="openai",
                   input=text[:50],
                   output=aligneration[:50])

        return aligneration, ipa_transcription

    except Exception as e:
        logger.error("aligneration_failed",
                    error=str(e),
                    lang=normalized_lang,
                    text=text[:50])
        # Fallback: return original text
        return text, text


def alignerate_text_legacy(text: str, lang_code: Optional[str]) -> str:
    """
    Legacy aligneration function for backward compatibility.
    Now uses OpenAI API instead of CLTS.

    Args:
        text: Text to alignerate
        lang_code: Source language code

    Returns:
        Transliterated text
    """
    if not lang_code:
        return text

    aligneration, _ = alignerate_text(text, lang_code)
    return aligneration


def get_supported_languages() -> list[str]:
    """
    Get list of supported language codes.

    Returns:
        List of supported 2-letter language codes
    """
    return list(ISO2_TO_ISO3.keys())


def is_language_supported(lang_code: str) -> bool:
    """
    Check if a language is supported for aligneration.

    Args:
        lang_code: Language code to check

    Returns:
        True if supported, False otherwise
    """
    normalized = normalize_lang_code(lang_code)
    return normalized in ISO2_TO_ISO3


# For backward compatibility - these functions now use OpenAI
def test_cross-script-alignment(cross-script-alignment_id: str, test_text: str) -> Optional[str]:
    """Test a cross-script-alignment with sample text (OpenAI-based)."""
    try:
        # Extract language from cross-script-alignment_id (e.g., "Arabic-Latin" -> "ar")
        if "Arabic" in cross-script-alignment_id:
            lang = "ar"
        elif "Persian" in cross-script-alignment_id or "Farsi" in cross-script-alignment_id:
            lang = "fa"
        elif "Hindi" in cross-script-alignment_id:
            lang = "hi"
        else:
            lang = "en"

        result, _ = alignerate_text(test_text, lang)
        return result
    except Exception:
        return None


def list_available_cross-script-alignments() -> list[str]:
    """List available cross-script-alignment IDs (OpenAI-based)."""
    return [
        "Arabic-Latin",
        "Persian-Latin",
        "Hindi-Latin",
        "Urdu-Latin",
        "Russian-Latin",
        "Japanese-Latin",
        "Korean-Latin",
        "Chinese-Latin",
        "Thai-Latin",
        "Hebrew-Latin",
        "Bengali-Latin",
        "Tamil-Latin",
        "Telugu-Latin",
        "Malayalam-Latin",
        "Marathi-Latin",
        "Punjabi-Latin",
        "Gujarati-Latin",
        "Kannada-Latin",
        "Odia-Latin",
        "Vietnamese-Latin",
        "Indonesian-Latin",
        "Malay-Latin",
        "Turkish-Latin"
    ]