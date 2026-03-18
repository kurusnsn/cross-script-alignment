from app.utils.lang_utils import detect_language


def detect_lang(text: str) -> str:
    """Compatibility wrapper around the shared language detection helper."""
    return detect_language(text)
