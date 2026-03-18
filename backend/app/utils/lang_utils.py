from langdetect import detect


_LANG_ALIASES = {
    "zh-cn": "zh-hans",
    "zh-sg": "zh-hans",
    "zh-hans": "zh-hans",
    "zh": "zh-hans",
    "zh-tw": "zh-hans",
    "zh-hk": "zh-hans",
    "zh-hant": "zh-hans",
    "cmn": "zh-hans",
    "cmn-hans": "zh-hans",
    "cmn-hant": "zh-hans",
    "fa-ir": "fa",
    "fas": "fa",
    "pes": "fa",
    "iw": "he",
}


def normalize_lang_code(code: str | None) -> str | None:
    if code is None:
        return None
    normalized = code.strip().lower()
    if not normalized:
        return None
    return _LANG_ALIASES.get(normalized, normalized)


def detect_language(text: str, fallback: str = "en") -> str:
    try:
        return detect(text)
    except Exception:
        return fallback


def resolve_lang_code(code: str | None, text: str, fallback: str = "en") -> str:
    normalized = normalize_lang_code(code)
    if normalized:
        return normalized
    detected = detect_language(text, fallback=fallback)
    return detected or fallback
