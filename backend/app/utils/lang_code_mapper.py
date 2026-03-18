# Maps ISO-639-1 codes to NLLB codes for HuggingFace translator fallback
# OpenAI uses the simplified language codes directly

LANG_CODE_MAP = {
    # --- Major languages ---
    "en": {"nllb": "eng_Latn"},   # English
    "es": {"nllb": "spa_Latn"},   # Spanish
    "fr": {"nllb": "fra_Latn"},   # French
    "de": {"nllb": "deu_Latn"},   # German
    "it": {"nllb": "ita_Latn"},   # Italian
    "pt": {"nllb": "por_Latn"},   # Portuguese
    "ru": {"nllb": "rus_Cyrl"},   # Russian
    "zh": {"nllb": "zho_Hans"},   # Chinese (Simplified)
    "ja": {"nllb": "jpn_Jpan"},   # Japanese
    "ko": {"nllb": "kor_Hang"},   # Korean
    "ar": {"nllb": "arb_Arab"},   # Arabic
    "fa": {"nllb": "pes_Arab"},   # Persian (Farsi)
    "hi": {"nllb": "hin_Deva"},   # Hindi
    "bn": {"nllb": "ben_Beng"},   # Bengali
    "ur": {"nllb": "urd_Arab"},   # Urdu
    "tr": {"nllb": "tur_Latn"},   # Turkish
    "el": {"nllb": "ell_Grek"},   # Greek
    "sv": {"nllb": "swe_Latn"},   # Swedish
    "no": {"nllb": "nob_Latn"},   # Norwegian Bokmål
    "da": {"nllb": "dan_Latn"},   # Danish
    "fi": {"nllb": "fin_Latn"},   # Finnish
    "pl": {"nllb": "pol_Latn"},   # Polish
    "nl": {"nllb": "nld_Latn"},   # Dutch
    "cs": {"nllb": "ces_Latn"},   # Czech
    "hu": {"nllb": "hun_Latn"},   # Hungarian
    "ro": {"nllb": "ron_Latn"},   # Romanian
    "uk": {"nllb": "ukr_Cyrl"},   # Ukrainian
    "sr": {"nllb": "srp_Cyrl"},   # Serbian (Cyrillic)
    "hr": {"nllb": "hrv_Latn"},   # Croatian
    "bg": {"nllb": "bul_Cyrl"},   # Bulgarian
    "he": {"nllb": "heb_Hebr"},   # Hebrew
    "th": {"nllb": "tha_Thai"},   # Thai
    "vi": {"nllb": "vie_Latn"},   # Vietnamese
    "id": {"nllb": "ind_Latn"},   # Indonesian
    "ms": {"nllb": "zsm_Latn"},   # Malay

    # --- Additional Indian languages ---
    "ta": {"nllb": "tam_Taml"},   # Tamil
    "te": {"nllb": "tel_Telu"},   # Telugu
    "ml": {"nllb": "mal_Mlym"},   # Malayalam
    "mr": {"nllb": "mar_Deva"},   # Marathi
    "pa": {"nllb": "pan_Guru"},   # Punjabi
    "gu": {"nllb": "guj_Gujr"},   # Gujarati
    "kn": {"nllb": "kan_Knda"},   # Kannada
    "or": {"nllb": "ory_Orya"},   # Odia
}


def get_lang_codes(iso_code: str) -> dict:
    """
    Given ISO code ('en', 'ja', 'ar'), return dict with NLLB codes.
    Falls back to using the ISO code if unknown.
    """
    return LANG_CODE_MAP.get(iso_code, {"nllb": iso_code})


def get_nllb_code(iso_code: str) -> str:
    """
    Get NLLB language code for a given ISO code.
    """
    codes = get_lang_codes(iso_code)
    return codes["nllb"]