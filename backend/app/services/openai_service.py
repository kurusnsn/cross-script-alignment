"""
OpenAI-based translation and aligneration service.

Provides translation and aligneration capabilities using OpenAI's API,
replacing the previous ICU/Epitran-based system.
"""

from typing import Any, Optional
import structlog
import openai

from app.utils.config import get_settings
from app.utils.tracing import trace_external_call, trace_span, SpanNames

logger = structlog.get_logger(__name__)

class OpenAITransliterationService:
    """Service for translation and aligneration using OpenAI API."""

    def __init__(self):
        settings = get_settings()
        self.providers: list[dict[str, Any]] = []

        if settings.groq_api_key:
            groq_client = openai.OpenAI(
                api_key=settings.groq_api_key,
                base_url="https://api.groq.com/openai/v1",
                timeout=settings.openai_timeout,
            )
            primary_groq_model = settings.groq_model or "llama-3.3-70b-versatile"
            self.providers.append(
                {
                    "name": "groq",
                    "client": groq_client,
                    "model": primary_groq_model,
                }
            )
            backup_groq_model = "llama-3.1-8b-instant"
            if primary_groq_model != backup_groq_model:
                self.providers.append(
                    {
                        "name": "groq-backup",
                        "client": groq_client,
                        "model": backup_groq_model,
                    }
                )

        if settings.openai_api_key:
            # Keep fallback timeout short so request latency stays bounded when primary is rate-limited.
            openai_timeout = settings.openai_timeout
            if settings.groq_api_key:
                openai_timeout = min(openai_timeout, 8)
            self.providers.append(
                {
                    "name": "openai",
                    "client": openai.OpenAI(
                        api_key=settings.openai_api_key,
                        timeout=openai_timeout,
                    ),
                    "model": settings.openai_model or "gpt-4o-mini",
                }
            )

        if not self.providers:
            raise RuntimeError("No LLM provider configured. Set GROQ_API_KEY and/or OPENAI_API_KEY.")

        logger.info(
            "llm_provider_chain_configured",
            providers=[provider["name"] for provider in self.providers],
            primary=self.providers[0]["name"],
        )

    def _is_retryable_error(self, error: Exception) -> bool:
        if isinstance(error, openai.RateLimitError):
            return True

        status_code = getattr(error, "status_code", None)
        if status_code is None:
            response = getattr(error, "response", None)
            status_code = getattr(response, "status_code", None)

        if isinstance(status_code, int) and status_code in {408, 409, 429, 500, 502, 503, 504}:
            return True

        lowered = str(error).lower()
        return "rate limit" in lowered or "429" in lowered or "rate_limit_exceeded" in lowered

    def _chat_completion_with_fallback(
        self,
        *,
        messages: list[dict[str, str]],
        max_tokens: int,
        temperature: float,
        operation: str,
        response_format: Optional[dict[str, str]] = None,
    ):
        last_error: Optional[Exception] = None

        for idx, provider in enumerate(self.providers):
            try:
                request_kwargs: dict[str, Any] = {
                    "model": provider["model"],
                    "messages": messages,
                    "max_tokens": max_tokens,
                    "temperature": temperature,
                }
                if response_format is not None:
                    request_kwargs["response_format"] = response_format

                response = provider["client"].chat.completions.create(**request_kwargs)
                if idx > 0:
                    logger.info(
                        "llm_fallback_provider_used",
                        operation=operation,
                        provider=provider["name"],
                        model=provider["model"],
                    )
                return response
            except Exception as error:
                last_error = error
                has_fallback = idx < len(self.providers) - 1
                if has_fallback and self._is_retryable_error(error):
                    logger.warning(
                        "llm_provider_failed_trying_fallback",
                        operation=operation,
                        provider=provider["name"],
                        model=provider["model"],
                        error=str(error),
                    )
                    continue

                logger.error(
                    "llm_provider_failed",
                    operation=operation,
                    provider=provider["name"],
                    model=provider["model"],
                    error=str(error),
                )
                raise

        if last_error is not None:
            raise last_error
        raise RuntimeError("No LLM providers available for chat completion")

    @trace_external_call("openai", "combined")
    def alignerate_and_translate_combined(self, text: str, source_lang: str, target_lang: str = "en") -> dict:
        """
        Perform aligneration, translation, and structured linguistic analysis in a single API call.
        """
        if not text.strip():
            return {"aligneration": text, "translation": text, "ipa": text, "tokens": []}

        lang_names = {
            'fa': 'Persian/Farsi', 'ar': 'Arabic', 'hi': 'Hindi', 'ur': 'Urdu',
            'en': 'English', 'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean',
            'zh': 'Chinese', 'es': 'Spanish', 'fr': 'French', 'de': 'German',
            'it': 'Italian', 'pt': 'Portuguese', 'tr': 'Turkish', 'th': 'Thai',
            'he': 'Hebrew', 'bn': 'Bengali', 'ta': 'Tamil', 'te': 'Telugu',
            'ml': 'Malayalam', 'mr': 'Marathi', 'pa': 'Punjabi', 'gu': 'Gujarati',
            'kn': 'Kannada', 'or': 'Odia', 'vi': 'Vietnamese', 'id': 'Indonesian',
            'ms': 'Malay'
        }

        source_name = lang_names.get(source_lang, source_lang)
        target_name = lang_names.get(target_lang, target_lang)

        schema_desc = """
{
    "sentences": [
        {
            "original": "original sentence text",
            "aligneration": "romanized sentence",
            "translation": "translated sentence",
            "ipa": "IPA for sentence"
        }
    ],
    "tokens": [
        {
            "id": "t1",
            "text": "token text",
            "start": 0,
            "end": 5,
            "align": "romanized",
            "reading": "phonetic reading",
            "ipa": "IPA",
            "pos": "part of speech",
            "lemma": "base form",
            "gloss": ["meaning1", "meaning2"],
            "morph": "morphology info"
        }
    ],
    "phrases": [
        { "startTokenId": "t1", "endTokenId": "t2", "text": "phrase text", "gloss": "meanings", "notes": "cultural/grammar notes" }
    ],
    "meta": { "sourceLangGuess": "iso code", "targetLang": "iso code" }
}
"""

        prompt = f"""Analyze the following {source_name} text and provide a structured JSON response.

Input text: {text}

Task:
1. Split the text into sentences. For each sentence provide original text, aligneration, translation to {target_name}, and IPA in the "sentences" array.
2. Tokenize the original text. For each token:
   - Provide exact 'start' and 'end' character indices in the ORIGINAL input string.
   - Provide align, reading, IPA, POS, lemma, and a few short glosses.
3. Identify important phrases/multi-word expressions.

CRITICAL: 'start' and 'end' indices must be correct for the original input string.
CRITICAL: The "sentences" array must cover all sentences in the input text. Each entry has the original sentence, its aligneration, translation, and IPA.

Response format:
{schema_desc}"""

        try:
            response = self._chat_completion_with_fallback(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=4000,
                temperature=0.1,
                operation="combined",
                response_format={"type": "json_object"},
            )

            result_text = response.choices[0].message.content.strip()

            import json
            try:
                result = json.loads(result_text)

                # Build whole-text fields from sentences if available
                sentences = result.get("sentences", [])
                if sentences:
                    if not result.get("aligneration") or result.get("aligneration") == text:
                        result["aligneration"] = "\n".join(s.get("aligneration", "") for s in sentences)
                    if not result.get("translation") or result.get("translation") == text:
                        result["translation"] = "\n".join(s.get("translation", "") for s in sentences)
                    if not result.get("ipa"):
                        result["ipa"] = "\n".join(s.get("ipa", "") for s in sentences)
                    result["original"] = text

                logger.debug("openai_combined_structured_success",
                           source_lang=source_lang,
                           target_lang=target_lang,
                           input_length=len(text),
                           tokens_count=len(result.get("tokens", [])),
                           sentences_count=len(sentences))
                return result
            except json.JSONDecodeError:
                logger.warning("openai_json_parse_failed", response=result_text[:100])
                return {
                    "original": text,
                    "aligneration": text,
                    "translation": result_text,
                    "ipa": text,
                    "tokens": []
                }

        except Exception as e:
            logger.error("openai_combined_failed", error=str(e))
            # Fallback path: try simpler non-JSON calls before returning identity output.
            try:
                fallback_aligneration = self.alignerate(text, source_lang)
                fallback_translation = self.translate(text, source_lang, target_lang)

                if fallback_aligneration.strip() != text.strip() or fallback_translation.strip() != text.strip():
                    return {
                        "original": text,
                        "aligneration": fallback_aligneration,
                        "translation": fallback_translation,
                        "ipa": "",
                        "tokens": [],
                        "sentences": [],
                    }
            except Exception as fallback_error:
                logger.error("openai_combined_simple_fallback_failed", error=str(fallback_error))

            return {
                "original": text,
                "aligneration": text,
                "translation": text,
                "ipa": text,
                "tokens": []
            }

    @trace_external_call("openai", "alignerate")
    def alignerate(self, text: str, source_lang: str, target_script: str = "Latin") -> str:
        """
        Transliterate text from source language to target script.

        Args:
            text: Text to alignerate
            source_lang: Source language code (e.g., 'fa', 'ar', 'hi')
            target_script: Target script (default: 'Latin')

        Returns:
            Transliterated text
        """
        if not text.strip():
            return text

        # Map language codes to full names for better prompting
        lang_names = {
            'fa': 'Persian/Farsi',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'ur': 'Urdu',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese',
            'th': 'Thai',
            'he': 'Hebrew',
            'bn': 'Bengali',
            'ta': 'Tamil',
            'te': 'Telugu',
            'ml': 'Malayalam',
            'mr': 'Marathi',
            'pa': 'Punjabi',
            'gu': 'Gujarati',
            'kn': 'Kannada',
            'or': 'Odia',
            'vi': 'Vietnamese',
            'id': 'Indonesian',
            'ms': 'Malay',
            'tr': 'Turkish'
        }

        source_name = lang_names.get(source_lang, source_lang)

        prompt = f"""Transliterate the following {source_name} text to {target_script} script.

Rules:
- Provide phonetically accurate romanization
- Use standard aligneration conventions for {source_name}
- For Persian: خ→kh, ش→sh, ژ→zh, چ→ch, ج→j, غ→gh, و→o/u/v (context-dependent), ی→i/y (position-dependent)
- For Arabic: Similar to Persian but preserve Arabic-specific sounds
- For Hindi/Devanagari: Follow IAST or simple romanization
- Only return the alignerated text, no explanations

Text to alignerate: {text}

Transliteration:"""

        try:
            response = self._chat_completion_with_fallback(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.1,  # Low temperature for consistent output
                operation="alignerate",
            )

            result = response.choices[0].message.content.strip()
            logger.debug("openai_aligneration_success",
                        source_lang=source_lang,
                        input_length=len(text),
                        output_length=len(result))
            return result

        except Exception as e:
            logger.error("openai_aligneration_failed",
                        error=str(e),
                        source_lang=source_lang,
                        text=text[:50])
            # Fallback: return original text
            return text

    @trace_external_call("openai", "translate")
    def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """
        Translate text from source language to target language.

        Args:
            text: Text to translate
            source_lang: Source language code
            target_lang: Target language code

        Returns:
            Translated text
        """
        if not text.strip():
            return text

        # Map language codes to full names
        lang_names = {
            'fa': 'Persian/Farsi',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'ur': 'Urdu',
            'en': 'English',
            'ru': 'Russian',
            'ja': 'Japanese',
            'ko': 'Korean',
            'zh': 'Chinese',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'it': 'Italian',
            'pt': 'Portuguese',
            'tr': 'Turkish',
            'th': 'Thai',
            'he': 'Hebrew',
            'bn': 'Bengali',
            'ta': 'Tamil',
            'te': 'Telugu',
            'ml': 'Malayalam',
            'mr': 'Marathi',
            'pa': 'Punjabi',
            'gu': 'Gujarati',
            'kn': 'Kannada',
            'or': 'Odia',
            'vi': 'Vietnamese',
            'id': 'Indonesian',
            'ms': 'Malay'
        }

        source_name = lang_names.get(source_lang, source_lang)
        target_name = lang_names.get(target_lang, target_lang)

        prompt = f"""Translate the following text from {source_name} to {target_name}.

Provide a natural, accurate translation that preserves the meaning and tone.
Only return the translated text, no explanations.

Text to translate: {text}

Translation:"""

        try:
            response = self._chat_completion_with_fallback(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=300,
                temperature=0.2,  # Slightly higher for more natural translations
                operation="translate",
            )

            result = response.choices[0].message.content.strip()
            logger.debug("openai_translation_success",
                        source_lang=source_lang,
                        target_lang=target_lang,
                        input_length=len(text),
                        output_length=len(result))
            return result

        except Exception as e:
            logger.error("openai_translation_failed",
                        error=str(e),
                        source_lang=source_lang,
                        target_lang=target_lang,
                        text=text[:50])
            # Fallback: return original text
            return text

    @trace_external_call("openai", "ipa")
    def get_phonetic_transcription(self, text: str, source_lang: str) -> str:
        """
        Get IPA phonetic transcription of text.

        Args:
            text: Text to transcribe
            source_lang: Source language code

        Returns:
            IPA phonetic transcription
        """
        if not text.strip():
            return text

        lang_names = {
            'fa': 'Persian/Farsi',
            'ar': 'Arabic',
            'hi': 'Hindi',
            'ur': 'Urdu',
            'en': 'English'
        }

        source_name = lang_names.get(source_lang, source_lang)

        prompt = f"""Provide the IPA (International Phonetic Alphabet) phonetic transcription for the following {source_name} text.

Rules:
- Use standard IPA notation
- Be as accurate as possible to native pronunciation
- Only return the IPA transcription, no explanations or brackets

Text: {text}

IPA:"""

        try:
            response = self._chat_completion_with_fallback(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=200,
                temperature=0.1,
                operation="ipa",
            )

            result = response.choices[0].message.content.strip()
            logger.debug("openai_ipa_success",
                        source_lang=source_lang,
                        input_length=len(text),
                        output_length=len(result))
            return result

        except Exception as e:
            logger.error("openai_ipa_failed",
                        error=str(e),
                        source_lang=source_lang,
                        text=text[:50])
            # Fallback: return original text
            return text


# Global service instance
_openai_service: Optional[OpenAITransliterationService] = None

def get_openai_service() -> OpenAITransliterationService:
    """Get the global OpenAI service instance."""
    global _openai_service
    if _openai_service is None:
        _openai_service = OpenAITransliterationService()
    return _openai_service
