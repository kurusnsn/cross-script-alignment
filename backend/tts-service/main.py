import os
import hashlib
import base64
import io
import time
import numpy as np
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import texttospeech
import redis
from typing import Optional
from scipy.io import wavfile
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST

# Environment configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_USERNAME = os.getenv("REDIS_USERNAME") or None
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None
REDIS_CACHE_TTL_SECONDS = int(os.getenv("REDIS_CACHE_TTL_SECONDS", "604800"))

# Initialize clients
try:
    redis_client = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        username=REDIS_USERNAME,
        password=REDIS_PASSWORD,
        decode_responses=False,
        socket_timeout=2.0,
        retry_on_timeout=True,
    )
    redis_client.ping()
    redis_available = True
    print(f"✓ Connected to Redis at {REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}")
except Exception as e:
    redis_available = False
    print(f"⚠ Redis not available: {e}. Redis caching disabled.")

# Google TTS client (uses GOOGLE_APPLICATION_CREDENTIALS env var)
try:
    tts_client = texttospeech.TextToSpeechClient()
    print("✓ Google Cloud TTS client initialized")
except Exception as e:
    print(f"⚠ Google TTS initialization warning: {e}")
    tts_client = None

# HuggingFace Persian TTS model (lazy load)
hf_persian_model = None
hf_persian_tokenizer = None

def load_persian_model():
    """Lazy load HuggingFace Persian TTS model"""
    global hf_persian_model, hf_persian_tokenizer

    if hf_persian_model is not None:
        return hf_persian_model, hf_persian_tokenizer

    try:
        print("📥 Loading HuggingFace Persian TTS model (facebook/mms-tts-fas)...")
        from transformers import VitsModel, AutoTokenizer
        import torch

        hf_persian_model = VitsModel.from_pretrained("facebook/mms-tts-fas")
        hf_persian_tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-fas")

        print("✓ HuggingFace Persian TTS model loaded")
        return hf_persian_model, hf_persian_tokenizer
    except Exception as e:
        print(f"❌ Failed to load HuggingFace Persian model: {e}")
        return None, None

app = FastAPI(title="TTS Service", version="1.0.0")

HTTP_REQUESTS_TOTAL = Counter(
    "tts_http_requests_total",
    "Total HTTP requests handled by TTS service",
    ["method", "path", "status"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "tts_http_request_duration_seconds",
    "HTTP request latency for TTS service",
    ["method", "path"],
)
TTS_SYNTHESIS_TOTAL = Counter(
    "tts_synthesis_total",
    "TTS synthesis outcomes",
    ["cache", "source"],
)
REDIS_AVAILABLE_GAUGE = Gauge(
    "tts_redis_available",
    "Redis connectivity state for TTS service (1=connected, 0=unavailable)",
)
REDIS_AVAILABLE_GAUGE.set(1 if redis_available else 0)


@app.middleware("http")
async def collect_http_metrics(request: Request, call_next):
    start = time.perf_counter()
    path = request.url.path
    method = request.method
    status = "500"
    try:
        response = await call_next(request)
        status = str(response.status_code)
        return response
    finally:
        duration = time.perf_counter() - start
        HTTP_REQUESTS_TOTAL.labels(method=method, path=path, status=status).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(method=method, path=path).observe(duration)

# CORS middleware for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TTSRequest(BaseModel):
    text: str
    lang: str = "en-US"  # Language code (e.g., "en-US", "fa-IR")
    voice: str = None  # Optional: specific voice name. If None, auto-select based on lang


# Voice mappings for different languages
# Using Standard voices for broader availability, Wavenet for premium quality where available
VOICE_MAP = {
    # Persian/Farsi - Using Standard (more available than Wavenet)
    "fa": {"lang": "fa-IR", "voice": "fa-IR-Standard-A"},
    "fa-IR": {"lang": "fa-IR", "voice": "fa-IR-Standard-A"},

    # Arabic
    "ar": {"lang": "ar-XA", "voice": "ar-XA-Standard-A"},
    "ar-XA": {"lang": "ar-XA", "voice": "ar-XA-Standard-A"},

    # Urdu
    "ur": {"lang": "ur-IN", "voice": "ur-IN-Standard-A"},
    "ur-IN": {"lang": "ur-IN", "voice": "ur-IN-Standard-A"},

    # Hindi
    "hi": {"lang": "hi-IN", "voice": "hi-IN-Standard-A"},
    "hi-IN": {"lang": "hi-IN", "voice": "hi-IN-Standard-A"},

    # Russian
    "ru": {"lang": "ru-RU", "voice": "ru-RU-Standard-A"},
    "ru-RU": {"lang": "ru-RU", "voice": "ru-RU-Standard-A"},

    # Japanese
    "ja": {"lang": "ja-JP", "voice": "ja-JP-Standard-A"},
    "ja-JP": {"lang": "ja-JP", "voice": "ja-JP-Standard-A"},

    # Korean
    "ko": {"lang": "ko-KR", "voice": "ko-KR-Standard-A"},
    "ko-KR": {"lang": "ko-KR", "voice": "ko-KR-Standard-A"},

    # Chinese (Mandarin)
    "zh": {"lang": "cmn-CN", "voice": "cmn-CN-Standard-A"},
    "zh-CN": {"lang": "cmn-CN", "voice": "cmn-CN-Standard-A"},
    "cmn-CN": {"lang": "cmn-CN", "voice": "cmn-CN-Standard-A"},

    # Thai
    "th": {"lang": "th-TH", "voice": "th-TH-Standard-A"},
    "th-TH": {"lang": "th-TH", "voice": "th-TH-Standard-A"},

    # Hebrew
    "he": {"lang": "he-IL", "voice": "he-IL-Standard-A"},
    "he-IL": {"lang": "he-IL", "voice": "he-IL-Standard-A"},

    # Bengali
    "bn": {"lang": "bn-IN", "voice": "bn-IN-Standard-A"},
    "bn-IN": {"lang": "bn-IN", "voice": "bn-IN-Standard-A"},

    # English - Using Wavenet (widely available)
    "en": {"lang": "en-US", "voice": "en-US-Wavenet-D"},
    "en-US": {"lang": "en-US", "voice": "en-US-Wavenet-D"},

    # Spanish
    "es": {"lang": "es-ES", "voice": "es-ES-Standard-A"},
    "es-ES": {"lang": "es-ES", "voice": "es-ES-Standard-A"},

    # French
    "fr": {"lang": "fr-FR", "voice": "fr-FR-Standard-A"},
    "fr-FR": {"lang": "fr-FR", "voice": "fr-FR-Standard-A"},

    # German
    "de": {"lang": "de-DE", "voice": "de-DE-Standard-A"},
    "de-DE": {"lang": "de-DE", "voice": "de-DE-Standard-A"},

    # Italian
    "it": {"lang": "it-IT", "voice": "it-IT-Standard-A"},
    "it-IT": {"lang": "it-IT", "voice": "it-IT-Standard-A"},

    # Portuguese
    "pt": {"lang": "pt-BR", "voice": "pt-BR-Standard-A"},
    "pt-BR": {"lang": "pt-BR", "voice": "pt-BR-Standard-A"},
}


def get_voice_config(lang_code: str, custom_voice: str = None):
    """Get language and voice configuration, with fallback to English"""
    if custom_voice:
        # If custom voice is provided, use it
        return {"lang": lang_code, "voice": custom_voice}

    # Try to find exact match first
    if lang_code in VOICE_MAP:
        return VOICE_MAP[lang_code]

    # Try to match base language (e.g., "en" from "en-GB")
    base_lang = lang_code.split("-")[0]
    if base_lang in VOICE_MAP:
        return VOICE_MAP[base_lang]

    # Fallback to English
    print(f"⚠ Language '{lang_code}' not found, falling back to English")
    return VOICE_MAP["en-US"]


def make_hash(text: str, lang: str, voice: str) -> str:
    """Generate cache key from text, language, and voice"""
    return hashlib.sha256(f"{text}-{lang}-{voice}".encode()).hexdigest()


def get_from_redis(cache_key: str) -> Optional[bytes]:
    """Try to get audio from Redis cache"""
    if not redis_available:
        return None
    try:
        data = redis_client.get(f"tts:{cache_key}")
        if data:
            print(f"✓ Redis cache HIT for {cache_key[:8]}...")
            return data
    except Exception as e:
        print(f"⚠ Redis get error: {e}")
    return None


def save_to_redis(cache_key: str, audio_data: bytes) -> None:
    """Save audio to Redis cache"""
    if not redis_available:
        return
    try:
        if REDIS_CACHE_TTL_SECONDS > 0:
            redis_client.set(f"tts:{cache_key}", audio_data, ex=REDIS_CACHE_TTL_SECONDS)
        else:
            redis_client.set(f"tts:{cache_key}", audio_data)
        print(f"✓ Saved to Redis: {cache_key[:8]}...")
    except Exception as e:
        print(f"⚠ Redis set error: {e}")


def generate_from_huggingface_persian(text: str) -> Optional[bytes]:
    """Generate audio using HuggingFace Persian TTS model"""
    try:
        import torch

        model, tokenizer = load_persian_model()
        if model is None or tokenizer is None:
            return None

        print(f"🎙️ Generating Persian audio with HuggingFace for: '{text[:30]}...'")

        # Tokenize text
        inputs = tokenizer(text, return_tensors="pt")

        # Convert input_ids to long (required for embedding layer)
        if "input_ids" in inputs:
            inputs["input_ids"] = inputs["input_ids"].long()

        # Generate audio
        with torch.no_grad():
            output = model(**inputs).waveform

        # Convert to numpy array
        waveform = output.squeeze().cpu().numpy()

        # Convert to 16-bit PCM WAV format
        sample_rate = model.config.sampling_rate
        waveform_int16 = np.int16(waveform * 32767)

        # Create WAV file in memory
        wav_buffer = io.BytesIO()
        wavfile.write(wav_buffer, sample_rate, waveform_int16)
        wav_buffer.seek(0)

        # Read WAV bytes
        audio_data = wav_buffer.read()

        print(f"✓ HuggingFace Persian TTS succeeded, {len(audio_data)} bytes")
        return audio_data

    except Exception as e:
        print(f"❌ HuggingFace Persian TTS error: {e}")
        return None


def generate_from_google(text: str, lang: str, voice: str, is_persian: bool = False) -> bytes:
    """Generate audio using Google Cloud TTS with automatic fallback"""
    if not tts_client:
        raise HTTPException(status_code=500, detail="Google TTS client not initialized")

    try:
        print(f"⚡ Calling Google TTS API for text: '{text[:30]}...' with voice {voice}")
        response = tts_client.synthesize_speech(
            input=texttospeech.SynthesisInput(text=text),
            voice=texttospeech.VoiceSelectionParams(
                language_code=lang,
                name=voice
            ),
            audio_config=texttospeech.AudioConfig(
                audio_encoding=texttospeech.AudioEncoding.MP3
            )
        )
        print(f"✓ Google TTS succeeded with {voice}")
        return response.audio_content
    except Exception as e:
        error_msg = str(e)
        # If voice doesn't exist and it's Persian, try HuggingFace first
        if ("does not exist" in error_msg or "Voice" in error_msg) and is_persian:
            print(f"⚠ Voice {voice} not available, trying HuggingFace Persian model...")
            hf_audio = generate_from_huggingface_persian(text)
            if hf_audio:
                return hf_audio
            print(f"⚠ HuggingFace Persian failed, falling back to English")

        # Fallback to English
        if "does not exist" in error_msg or "Voice" in error_msg:
            print(f"⚠ Voice {voice} not available, falling back to English")
            try:
                fallback_voice = "en-US-Wavenet-D"
                response = tts_client.synthesize_speech(
                    input=texttospeech.SynthesisInput(text=text),
                    voice=texttospeech.VoiceSelectionParams(
                        language_code="en-US",
                        name=fallback_voice
                    ),
                    audio_config=texttospeech.AudioConfig(
                        audio_encoding=texttospeech.AudioEncoding.MP3
                    )
                )
                print(f"✓ Fallback to English succeeded")
                return response.audio_content
            except Exception as fallback_error:
                raise HTTPException(status_code=500, detail=f"Google TTS error (original: {error_msg}, fallback: {str(fallback_error)})")
        raise HTTPException(status_code=500, detail=f"Google TTS error: {error_msg}")


@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "service": "TTS Service",
        "status": "running",
        "redis": "connected" if redis_available else "unavailable",
        "redis_db": REDIS_DB,
        "redis_cache_ttl_seconds": REDIS_CACHE_TTL_SECONDS,
        "google_tts": "initialized" if tts_client else "unavailable"
    }


@app.post("/tts")
def synthesize(req: TTSRequest):
    """
    Generate or retrieve cached TTS audio

    Flow: Redis → Google API
    """
    # Get the correct voice configuration based on language
    voice_config = get_voice_config(req.lang, req.voice)
    actual_lang = voice_config["lang"]
    actual_voice = voice_config["voice"]

    print(f"🎤 TTS Request: lang={req.lang} → using {actual_lang}/{actual_voice}")

    cache_key = make_hash(req.text, actual_lang, actual_voice)

    # Tier 1: Check Redis cache
    audio_data = get_from_redis(cache_key)
    if audio_data:
        TTS_SYNTHESIS_TOTAL.labels(cache="hit", source="redis").inc()
        audio_b64 = base64.b64encode(audio_data).decode("utf-8")
        return {
            "hash": cache_key,
            "cached": True,
            "source": "redis",
            "lang": actual_lang,
            "voice": actual_voice,
            "audio_b64": audio_b64
        }

    # Tier 2: Generate via Google API (with HuggingFace fallback for Persian)
    is_persian = req.lang.lower().startswith("fa")
    audio_data = generate_from_google(req.text, actual_lang, actual_voice, is_persian=is_persian)

    # Save to Redis cache
    save_to_redis(cache_key, audio_data)

    audio_b64 = base64.b64encode(audio_data).decode("utf-8")
    TTS_SYNTHESIS_TOTAL.labels(cache="miss", source="google_api_or_huggingface").inc()
    return {
        "hash": cache_key,
        "cached": False,
        "source": "google_api_or_huggingface",
        "lang": actual_lang,
        "voice": actual_voice,
        "audio_b64": audio_b64
        }


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/stats")
def cache_stats():
    """Get cache statistics"""
    stats = {
        "redis_available": redis_available,
        "cache_backend": "redis_only",
        "redis_db": REDIS_DB,
        "redis_cache_ttl_seconds": REDIS_CACHE_TTL_SECONDS,
    }

    if redis_available:
        try:
            stats["redis_keys"] = len(redis_client.keys("tts:*"))
        except:
            stats["redis_keys"] = 0

    return stats
