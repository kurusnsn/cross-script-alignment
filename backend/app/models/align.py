from typing import List, Optional
import re
from pydantic import BaseModel, Field, validator


# Supported language codes for remote engine
SUPPORTED_LANGUAGES = {
    "fa", "ar", "ja", "zh-hans", "zh", "he", "ko", "en",
    "es", "it", "ru", "tr", "hi", "az", "hy", "ga",
    "ur", "th", "bn"
}



class TranslitRequest(BaseModel):
    text: str
    source_lang: str
    target_lang: str
    persist: bool = False


class TokenAnnotation(BaseModel):
    id: str
    text: str
    start: int
    end: int
    align: Optional[str] = None
    reading: Optional[str] = None
    ipa: Optional[str] = None
    pos: Optional[str] = None
    lemma: Optional[str] = None
    gloss: Optional[List[str]] = None
    morph: Optional[str] = None

    @validator("gloss", pre=True)
    def coerce_gloss(cls, value):
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return [stripped] if stripped else None
        if isinstance(value, list):
            normalized = [str(item).strip() for item in value if str(item).strip()]
            return normalized or None
        return [str(value)]

class PhraseAnnotation(BaseModel):
    startTokenId: str
    endTokenId: str
    text: str
    gloss: Optional[str] = None
    notes: Optional[str] = None

    @validator("gloss", pre=True)
    def coerce_phrase_gloss(cls, value):
        if value is None:
            return ""
        if isinstance(value, list):
            joined = " ".join(str(item).strip() for item in value if str(item).strip())
            return joined
        return str(value).strip()

    @validator("notes", pre=True)
    def coerce_notes(cls, value):
        if value is None:
            return ""
        return str(value).strip()

class TranslateResult(BaseModel):
    original: str
    translation: str
    aligneration: Optional[str] = None
    tokens: List[TokenAnnotation]
    phrases: Optional[List[PhraseAnnotation]] = None
    meta: Optional[dict] = None

class SentenceResult(BaseModel):
    original: str
    aligneration: str
    translation: str
    ipa: str = ""

    @validator("original", "aligneration", "translation", "ipa", pre=True)
    def coerce_sentence_fields(cls, value):
        if value is None:
            return ""
        return str(value)

class TranslitResponse(BaseModel):
    original: str
    aligneration: str
    translation: str
    ipa: str
    original_tokens: List[str] = []
    align_tokens: List[str] = []
    translation_tokens: List[str] = []
    sentences: List[SentenceResult] = []
    alignment: List[List[int]] = []  # List of [src_idx, tgt_idx]
    result_json: Optional[TranslateResult] = None


class AlignRequest(BaseModel):
    original_tokens: List[str]
    align_tokens: List[str]
    translation_tokens: List[str]
    original_text: str = ""      # Raw text with newlines for paragraph splitting
    translation_text: str = ""   # Raw text with newlines for paragraph splitting
    k: int = 2


class AlignResponse(BaseModel):
    alignments: List[dict]


class SentenceAlignRequest(BaseModel):
    """Align sentences individually — each sentence has its own original/align/translation."""
    sentences: List[SentenceResult]
    k: int = 2


class SentenceAlignmentResult(BaseModel):
    mappings: List[dict]  # per-sentence WordMapping list


class SentenceAlignResponse(BaseModel):
    sentence_alignments: List[SentenceAlignmentResult]


class PhraseAlignRequest(BaseModel):
    source_text: str
    target_text: str


class PhraseAlignResponse(BaseModel):
    alignments: List[dict]  # List of {"source_phrase": str, "target_phrase": str, "score": float}


class SimAlignRequest(BaseModel):
    source_text: str
    target_text: str
    include_confidence: bool = False


class WordAlignment(BaseModel):
    source_index: int
    target_index: int
    source_word: str
    target_word: str
    confidence: Optional[float] = None


class SimAlignResponse(BaseModel):
    source_tokens: List[str]
    target_tokens: List[str]
    alignments: List[WordAlignment]
    method: str


class AlignmentMapping(BaseModel):
    source: str
    target: str
    confidence: float = 1.0
    refined: bool = False


class TokensInfo(BaseModel):
    source: List[str]
    target: List[str]


class EnhancedPhraseAlignRequest(BaseModel):
    source_text: str
    target_text: str


class TimingInfo(BaseModel):
    simalign: float
    span_embeddings: float
    llm_refinement: float
    total: float

class LLMTimingInfo(BaseModel):
    llm_processing: float
    total: float

class EnhancedPhraseAlignResponse(BaseModel):
    original: str
    translation: str
    tokens: TokensInfo
    alignments: List[AlignmentMapping]
    timing: TimingInfo

class LLMPhraseAlignRequest(BaseModel):
    source_text: str
    target_text: str

class LLMPhraseAlignResponse(BaseModel):
    original: str
    translation: str
    alignments: List[AlignmentMapping]
    timing: LLMTimingInfo
    raw_response: Optional[str] = None


class RemoteAlignRequest(BaseModel):
    """Strict validation schema for remote engine alignment requests."""
    source_text: str = Field(..., min_length=1, max_length=500, description="Source language text")
    target_text: str = Field(..., min_length=1, max_length=500, description="Target language text")
    lang: str = Field(..., description="Source language code")
    
    @validator('lang')
    def validate_language(cls, v):
        """Validate language code against supported languages."""
        if v not in SUPPORTED_LANGUAGES:
            raise ValueError(
                f"Unsupported language: '{v}'. "
                f"Supported languages: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
            )
        return v
    
    @validator('source_text', 'target_text')
    def sanitize_text(cls, v):
        """Remove control characters and validate text."""
        # Strip control characters (0x00-0x1f, 0x7f-0x9f)
        v = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', v)
        # Normalize whitespace
        v = ' '.join(v.split())
        if not v.strip():
            raise ValueError("Text cannot be empty after sanitization")
        return v.strip()
