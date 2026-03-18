"""
Transliteration service using OpenAI API.

Provides aligneration and translation capabilities using OpenAI's models,
replacing the previous ICU/Epitran-based system while keeping the HuggingFace
models as fallback for translation.
"""

import hashlib
import os
import re
from typing import Any, Optional

import httpx
import structlog

from app.services.openai_service import get_openai_service
from app.utils.config import get_settings
from app.utils.lang_code_mapper import get_lang_codes
from app.utils.lang_utils import resolve_lang_code
from app.utils.align_utils import alignerate_text

# Keep HuggingFace models for translation fallback
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

from app.db.redis import get_redis_client, redis_get_json, redis_set_json

logger = structlog.get_logger(__name__)

_TRANSLATOR_SINGLETON: Optional["HFSeq2SeqTranslator"] = None
_SENTENCE_SPLIT_REGEX = re.compile(r'(?<=[.!?؟।。])\s+')
_SEGMENT_TARGET_CHARS = 700
_SEGMENT_HARD_LIMIT_CHARS = 900
_REMOTE_SPLIT_TIMEOUT_SEC = 6.0
_CACHE_SCHEMA_VERSION = "v4"


class HFSeq2SeqTranslator:
    """HuggingFace sequence-to-sequence translator (fallback)."""
    backend_name = "hf-seq2seq"

    def __init__(self, model_name: str, max_new_tokens: int = 64) -> None:
        self.model_name = model_name
        self.max_new_tokens = max_new_tokens
        self.tok: Optional[AutoTokenizer] = None
        self.model: Optional[AutoModelForSeq2SeqLM] = None

    def ensure_loaded(self) -> None:
        if self.tok is None or self.model is None:
            logger.info("translator_loading", backend=self.backend_name, model=self.model_name)
            self.tok = AutoTokenizer.from_pretrained(self.model_name)
            self.model = AutoModelForSeq2SeqLM.from_pretrained(self.model_name)
            logger.info("translator_loaded", backend=self.backend_name, model=self.model_name)

    def translate(self, text: str, nllb_src: str, nllb_tgt: str) -> str:
        raise NotImplementedError


class NLLBTranslator(HFSeq2SeqTranslator):
    """NLLB translator (fallback)."""
    backend_name = "nllb"

    def __init__(self, max_new_tokens: int = 64) -> None:
        super().__init__("facebook/nllb-200-distilled-600M", max_new_tokens=max_new_tokens)

    def translate(self, text: str, nllb_src: str, nllb_tgt: str) -> str:
        self.ensure_loaded()
        assert self.tok is not None and self.model is not None

        try:
            self.tok.src_lang = nllb_src
            inputs = self.tok(text, return_tensors="pt", truncation=True)
            bos_id = self.tok.lang_code_to_id.get(nllb_tgt)
            if bos_id is None:
                bos_id = self.tok.convert_tokens_to_ids(nllb_tgt)
            outputs = self.model.generate(
                **inputs,
                forced_bos_token_id=bos_id,
                max_new_tokens=self.max_new_tokens,
            )
            return self.tok.decode(outputs[0], skip_special_tokens=True)
        except Exception as exc:
            return f"[translation-error: {exc}]"


class OpusTranslator(HFSeq2SeqTranslator):
    """Opus translator (fallback)."""
    backend_name = "opus-mt"

    def __init__(self, max_new_tokens: int = 64) -> None:
        super().__init__("Helsinki-NLP/opus-mt-xx-en", max_new_tokens=max_new_tokens)

    def translate(self, text: str, nllb_src: str, nllb_tgt: str) -> str:
        self.ensure_loaded()
        assert self.tok is not None and self.model is not None

        try:
            inputs = self.tok(text, return_tensors="pt", truncation=True)
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=self.max_new_tokens,
            )
            return self.tok.decode(outputs[0], skip_special_tokens=True)
        except Exception as exc:
            return f"[translation-error: {exc}]"


def get_hf_translator() -> HFSeq2SeqTranslator:
    """Get HuggingFace translator for fallback."""
    global _TRANSLATOR_SINGLETON
    if _TRANSLATOR_SINGLETON is None:
        settings = get_settings()
        max_tokens = settings.translator_max_new_tokens
        if settings.use_light_translator:
            _TRANSLATOR_SINGLETON = OpusTranslator(max_new_tokens=max_tokens)
        else:
            _TRANSLATOR_SINGLETON = NLLBTranslator(max_new_tokens=max_tokens)
        logger.info(
            "translator_backend_selected",
            backend=_TRANSLATOR_SINGLETON.backend_name,
            model=_TRANSLATOR_SINGLETON.model_name,
            max_new_tokens=max_tokens,
        )
    return _TRANSLATOR_SINGLETON


def warm_up_translator() -> None:
    """Warm up the HuggingFace translator."""
    translator = get_hf_translator()
    translator.ensure_loaded()


class TranslitService:
    """Main aligneration service using OpenAI API."""

    def __init__(self):
        self.openai_service = get_openai_service()
        # Skip heavy NLLB model - only use OpenAI for translation

    def _is_identity_fallback_response(self, response: dict, original_text: str) -> bool:
        """
        Detect degraded LLM fallback payloads (identity align/translation with no structure).
        These should not be cached.
        """
        normalized_original = (response.get("original") or original_text or "").strip()
        if not normalized_original:
            return False

        aligneration = (response.get("aligneration") or "").strip()
        translation = (response.get("translation") or "").strip()
        sentences = response.get("sentences") or []
        tokens = (response.get("result_json") or {}).get("tokens", [])

        return (
            aligneration == normalized_original
            and translation == normalized_original
            and not sentences
            and not tokens
        )

    def _drop_cache_key(self, cache_key: str) -> None:
        client = get_redis_client()
        if not client:
            return
        try:
            client.delete(cache_key)
        except Exception as exc:
            logger.warning("align_cache_delete_failed", key=cache_key, error=str(exc))

    @staticmethod
    def _coerce_str(value: Any, default: str = "") -> str:
        if value is None:
            return default
        return str(value)

    def _normalize_tokens(self, tokens: Any) -> list[dict]:
        if not isinstance(tokens, list):
            return []

        normalized_tokens: list[dict] = []
        for idx, token in enumerate(tokens):
            if not isinstance(token, dict):
                continue

            normalized = dict(token)
            normalized["id"] = self._coerce_str(token.get("id"), f"t{idx + 1}")
            normalized["text"] = self._coerce_str(token.get("text"), "")

            start = token.get("start", 0)
            end = token.get("end", 0)
            try:
                normalized["start"] = int(start)
            except Exception:
                normalized["start"] = 0
            try:
                normalized["end"] = int(end)
            except Exception:
                normalized["end"] = max(normalized["start"], normalized["start"] + len(normalized["text"]))

            gloss = token.get("gloss")
            if gloss is None:
                normalized["gloss"] = None
            elif isinstance(gloss, list):
                normalized["gloss"] = [
                    str(item).strip()
                    for item in gloss
                    if str(item).strip()
                ] or None
            else:
                gloss_text = str(gloss).strip()
                normalized["gloss"] = [gloss_text] if gloss_text else None

            for key in ("align", "reading", "ipa", "pos", "lemma", "morph"):
                value = token.get(key)
                normalized[key] = str(value).strip() if value is not None else None

            normalized_tokens.append(normalized)

        return normalized_tokens

    def _normalize_phrases(self, phrases: Any) -> list[dict]:
        if not isinstance(phrases, list):
            return []

        normalized_phrases: list[dict] = []
        for phrase in phrases:
            if not isinstance(phrase, dict):
                continue

            gloss_value = phrase.get("gloss")
            if isinstance(gloss_value, list):
                gloss = " ".join(str(item).strip() for item in gloss_value if str(item).strip())
            elif gloss_value is None:
                gloss = ""
            else:
                gloss = str(gloss_value).strip()

            normalized_phrases.append(
                {
                    "startTokenId": self._coerce_str(phrase.get("startTokenId"), ""),
                    "endTokenId": self._coerce_str(phrase.get("endTokenId"), ""),
                    "text": self._coerce_str(phrase.get("text"), ""),
                    "gloss": gloss,
                    "notes": self._coerce_str(phrase.get("notes"), ""),
                }
            )

        return normalized_phrases

    def _normalize_sentences(self, sentences: Any) -> list[dict]:
        if not isinstance(sentences, list):
            return []

        normalized_sentences: list[dict] = []
        for sentence in sentences:
            if not isinstance(sentence, dict):
                continue
            normalized_sentences.append(
                {
                    "original": self._coerce_str(sentence.get("original"), ""),
                    "aligneration": self._coerce_str(sentence.get("aligneration"), ""),
                    "translation": self._coerce_str(sentence.get("translation"), ""),
                    "ipa": self._coerce_str(sentence.get("ipa"), ""),
                }
            )
        return normalized_sentences

    def _normalize_combined_result(
        self,
        raw_result: Any,
        *,
        original_text: str,
        source_lang: str,
        target_lang: str,
    ) -> dict:
        result = raw_result if isinstance(raw_result, dict) else {}

        normalized_tokens = self._normalize_tokens(result.get("tokens"))
        normalized_phrases = self._normalize_phrases(result.get("phrases"))
        normalized_sentences = self._normalize_sentences(result.get("sentences"))

        normalized_meta = result.get("meta") if isinstance(result.get("meta"), dict) else {}
        normalized_meta = {
            **normalized_meta,
            "sourceLangGuess": self._coerce_str(
                normalized_meta.get("sourceLangGuess") if isinstance(normalized_meta, dict) else source_lang,
                source_lang,
            ),
            "targetLang": self._coerce_str(
                normalized_meta.get("targetLang") if isinstance(normalized_meta, dict) else target_lang,
                target_lang,
            ),
        }

        aligneration = self._coerce_str(result.get("aligneration"), "")
        translation = self._coerce_str(result.get("translation"), "")
        ipa = self._coerce_str(result.get("ipa"), "")

        if normalized_sentences:
            if len(normalized_sentences) == 1:
                normalized_sentences[0]["original"] = original_text
            if not aligneration.strip():
                aligneration = "\n".join(s["aligneration"] for s in normalized_sentences if s["aligneration"])
            if not translation.strip():
                translation = "\n".join(s["translation"] for s in normalized_sentences if s["translation"])
            if not ipa.strip():
                ipa = "\n".join(s["ipa"] for s in normalized_sentences if s["ipa"])
        elif original_text.strip():
            normalized_sentences = [
                {
                    "original": original_text,
                    "aligneration": aligneration or original_text,
                    "translation": translation or original_text,
                    "ipa": ipa,
                }
            ]

        return {
            "original": original_text,
            "aligneration": aligneration or original_text,
            "translation": translation or original_text,
            "ipa": ipa,
            "tokens": normalized_tokens,
            "phrases": normalized_phrases,
            "sentences": normalized_sentences,
            "meta": normalized_meta,
        }

    def _split_sentences_regex(self, text: str) -> list[str]:
        stripped = text.strip()
        if not stripped:
            return []
        sentences = [s.strip() for s in _SENTENCE_SPLIT_REGEX.split(stripped) if s.strip()]
        return sentences if sentences else [stripped]

    def _looks_oversplit(self, sentences: list[str]) -> bool:
        """Detect regex oversplitting (often caused by abbreviations/acronyms)."""
        if len(sentences) < 3:
            return False
        very_short = sum(1 for s in sentences if len(s) <= 4)
        return very_short / len(sentences) >= 0.35

    def _split_by_length(self, text: str, max_chars: int = _SEGMENT_HARD_LIMIT_CHARS) -> list[str]:
        """Hard fallback for unpunctuated long text."""
        stripped = text.strip()
        if not stripped:
            return []
        if len(stripped) <= max_chars:
            return [stripped]

        words = stripped.split()
        if len(words) <= 1:
            return [stripped[i:i + max_chars].strip() for i in range(0, len(stripped), max_chars) if stripped[i:i + max_chars].strip()]

        chunks: list[str] = []
        current: list[str] = []
        current_len = 0
        for word in words:
            add_len = len(word) if not current else len(word) + 1
            if current and current_len + add_len > max_chars:
                chunks.append(" ".join(current))
                current = [word]
                current_len = len(word)
            else:
                current.append(word)
                current_len += add_len
        if current:
            chunks.append(" ".join(current))
        return chunks if chunks else [stripped]

    def _split_sentences_with_remote_stanza(self, text: str, lang: str) -> list[str]:
        """Use align-worker Stanza sentence splitter. Returns [] on failure."""
        stripped = text.strip()
        if not stripped:
            return []

        remote_url = os.getenv("REMOTE_ENGINE_URL", "http://localhost:8000").rstrip("/")
        try:
            response = httpx.post(
                f"{remote_url}/split-sentences",
                json={"text": stripped, "lang": lang},
                timeout=_REMOTE_SPLIT_TIMEOUT_SEC,
            )
            response.raise_for_status()
            data = response.json()
            sentences = data.get("sentences", [])
            if not isinstance(sentences, list):
                return []
            return [s.strip() for s in sentences if isinstance(s, str) and s.strip()]
        except Exception as exc:
            logger.warning(
                "stanza_sentence_split_failed",
                error=str(exc),
                lang=lang,
                text_len=len(stripped),
            )
            return []

    def _group_sentence_units(self, sentence_units: list[str]) -> list[str]:
        """Group short sentence units into LLM-friendly segments."""
        if not sentence_units:
            return []

        segments: list[str] = []
        current: list[str] = []
        current_len = 0

        for sentence in sentence_units:
            # Keep hard upper bound even when sentence segmentation fails.
            chunks = self._split_by_length(sentence, _SEGMENT_HARD_LIMIT_CHARS) if len(sentence) > _SEGMENT_HARD_LIMIT_CHARS else [sentence]
            for chunk in chunks:
                projected = current_len + (1 if current else 0) + len(chunk)
                if current and projected > _SEGMENT_TARGET_CHARS:
                    segments.append(" ".join(current))
                    current = [chunk]
                    current_len = len(chunk)
                else:
                    current.append(chunk)
                    current_len = projected
        if current:
            segments.append(" ".join(current))

        return segments

    def _split_paragraph_hybrid(self, paragraph: str, lang: str) -> list[str]:
        """Hybrid sentence segmentation: regex + Stanza + hard length fallback."""
        regex_sentences = self._split_sentences_regex(paragraph)
        should_try_stanza = (
            len(regex_sentences) <= 1
            or len(paragraph) > 400
            or self._looks_oversplit(regex_sentences)
        )

        sentence_units = regex_sentences
        if should_try_stanza:
            stanza_sentences = self._split_sentences_with_remote_stanza(paragraph, lang)
            if len(stanza_sentences) > 1:
                sentence_units = stanza_sentences
            elif len(regex_sentences) <= 1 and stanza_sentences:
                sentence_units = stanza_sentences

        if len(sentence_units) <= 1 and len(paragraph) > _SEGMENT_HARD_LIMIT_CHARS:
            sentence_units = self._split_by_length(paragraph, _SEGMENT_HARD_LIMIT_CHARS)

        return self._group_sentence_units(sentence_units)

    def _split_text_into_segments(self, text: str, lang: str) -> list[str]:
        """Split long text into robust segments, preserving paragraph boundaries."""
        paragraphs = [p.strip() for p in re.split(r"\n+", text) if p.strip()]
        if not paragraphs:
            stripped = text.strip()
            return [stripped] if stripped else [text]

        paragraph_segments: list[str] = []
        for paragraph in paragraphs:
            para_segments = self._split_paragraph_hybrid(paragraph, lang)
            if para_segments:
                paragraph_segments.extend(para_segments)

        if not paragraph_segments:
            return [text]

        # Second pass: combine adjacent paragraph segments into larger LLM chunks.
        # This reduces provider calls and rate-limit pressure for multi-paragraph text.
        segments = self._group_sentence_units(paragraph_segments)

        return segments if segments else [text]

    def _process_single(self, text: str, resolved_src: str, tgt_lang: str) -> dict:
        """Process a single text segment through the OpenAI combined call."""
        raw_result = self.openai_service.alignerate_and_translate_combined(text, resolved_src, tgt_lang)
        result = self._normalize_combined_result(
            raw_result,
            original_text=text,
            source_lang=resolved_src,
            target_lang=tgt_lang,
        )

        tokens = result.get("tokens", [])
        valid_tokens = self._validate_and_repair_tokens(text, tokens)
        result["tokens"] = valid_tokens

        # Extract sentences from LLM response
        sentences = result.get("sentences", [])

        return {
            "original": text,
            "aligneration": result.get("aligneration", text),
            "translation": result.get("translation", text),
            "ipa": result.get("ipa", text),
            "sentences": sentences,
            "result_json": result
        }

    def _merge_results(self, results: list[dict]) -> dict:
        """Merge multiple segment results into one."""
        originals = []
        alignerations = []
        translations = []
        ipas = []
        all_tokens = []
        all_phrases = []
        all_sentences = []
        merged_meta = {}
        char_offset = 0

        for r in results:
            originals.append(r["original"])
            alignerations.append(r["aligneration"])
            translations.append(r["translation"])
            ipas.append(r["ipa"])
            all_sentences.extend(r.get("sentences", []))
            if not merged_meta:
                candidate_meta = r.get("result_json", {}).get("meta")
                if isinstance(candidate_meta, dict):
                    merged_meta = candidate_meta

            # Offset token start/end indices
            for token in r.get("result_json", {}).get("tokens", []):
                token["start"] = token.get("start", 0) + char_offset
                token["end"] = token.get("end", 0) + char_offset
                all_tokens.append(token)
            all_phrases.extend(r.get("result_json", {}).get("phrases", []))

            char_offset += len(r["original"]) + 1  # +1 for the newline/space separator

        separator = "\n"
        merged_original = separator.join(originals)
        merged_align = separator.join(alignerations)
        merged_translation = separator.join(translations)
        merged_ipa = separator.join(ipas)

        return {
            "original": merged_original,
            "aligneration": merged_align,
            "translation": merged_translation,
            "ipa": merged_ipa,
            "sentences": all_sentences,
            "result_json": {
                "original": merged_original,
                "translation": merged_translation,
                "aligneration": merged_align,
                "tokens": all_tokens,
                "phrases": all_phrases,
                "sentences": all_sentences,
                "meta": merged_meta,
            }
        }

    def process(self, text: str, src_lang: str | None, tgt_lang: str) -> dict:
        """
        Process text for aligneration, translation, and structured linguistic analysis.
        Splits long text into segments to avoid exceeding LLM output token limits.
        """
        resolved_src = resolve_lang_code(src_lang, text)

        # Redis Caching
        cache_key = None
        settings = get_settings()
        if settings.redis_enabled:
            # Create a stable hash for the request params
            hash_input = f"{_CACHE_SCHEMA_VERSION}:{text}:{resolved_src}:{tgt_lang}"
            param_hash = hashlib.sha256(hash_input.encode()).hexdigest()
            cache_key = f"align:{param_hash}"

            cached_result = redis_get_json(cache_key)
            if cached_result:
                if self._is_identity_fallback_response(cached_result, text):
                    logger.warning("align_cache_stale_fallback_ignored", key=cache_key)
                    self._drop_cache_key(cache_key)
                else:
                    logger.info("align_cache_hit", key=cache_key)
                    return cached_result

        try:
            # Split long text into segments to avoid exceeding max tokens
            segments = self._split_text_into_segments(text, resolved_src)
            has_degraded_segment = False

            if len(segments) == 1:
                # Single segment — process normally
                response = self._process_single(text, resolved_src, tgt_lang)
                has_degraded_segment = self._is_identity_fallback_response(response, text)
            else:
                logger.info("processing_segments", count=len(segments),
                           lengths=[len(s) for s in segments])
                results = []
                for i, segment in enumerate(segments):
                    try:
                        result = self._process_single(segment, resolved_src, tgt_lang)
                        if self._is_identity_fallback_response(result, segment):
                            has_degraded_segment = True
                            logger.warning(
                                "segment_identity_fallback_detected",
                                segment_idx=i,
                                segment_len=len(segment),
                            )
                            # Avoid repeatedly hitting providers after a clear fallback failure.
                            # Fill remaining segments with lightweight identity placeholders.
                            results.append(result)
                            if i < len(segments) - 1:
                                for remaining_idx, remaining_segment in enumerate(segments[i + 1 :], start=i + 1):
                                    logger.warning(
                                        "segment_skipped_after_fallback",
                                        segment_idx=remaining_idx,
                                        segment_len=len(remaining_segment),
                                    )
                                    results.append({
                                        "original": remaining_segment,
                                        "aligneration": remaining_segment,
                                        "translation": remaining_segment,
                                        "ipa": "",
                                        "sentences": [],
                                        "result_json": {
                                            "tokens": [],
                                            "phrases": [],
                                            "sentences": [],
                                            "meta": {
                                                "sourceLangGuess": resolved_src,
                                                "targetLang": tgt_lang,
                                            },
                                        },
                                    })
                            break
                        results.append(result)
                    except Exception as seg_err:
                        has_degraded_segment = True
                        logger.warning("segment_failed", segment_idx=i, error=str(seg_err))
                        # Fallback: return original text for this segment
                        results.append({
                            "original": segment,
                            "aligneration": segment,
                            "translation": f"[Translation failed for segment {i+1}]",
                            "ipa": "",
                            "sentences": [],
                            "result_json": {
                                "tokens": [],
                                "phrases": [],
                                "sentences": [],
                                "meta": {
                                    "sourceLangGuess": resolved_src,
                                    "targetLang": tgt_lang,
                                },
                            }
                        })
                response = self._merge_results(results)

            # Cache only non-degraded responses
            if cache_key:
                is_degraded_response = has_degraded_segment or self._is_identity_fallback_response(response, text)
                if is_degraded_response:
                    logger.warning("align_cache_skip_degraded_response", key=cache_key)
                    self._drop_cache_key(cache_key)
                else:
                    redis_set_json(cache_key, response, ex=86400) # 24 hours
                    logger.info("align_cache_saved", key=cache_key)

            return response

        except Exception as e:
            logger.warning("combined_openai_failed_fallback", error=str(e))

            settings = get_settings()
            if settings.deployment_env == "development":
                logger.info("using_mock_align_fallback")
                from app.services.mock_align_service import MockTranslitService
                
                aligneration = MockTranslitService.alignerate(text, resolved_src)
                translation = MockTranslitService.translate(text)
                ipa_text = MockTranslitService.get_ipa(text, resolved_src)
                tokens = MockTranslitService.get_tokens(text, resolved_src)
            else:
                # Fallback to separate calls (will likely fail too if OpenAI key is invalid)
                aligneration, ipa_text = alignerate_text(text, resolved_src)
                translation = self._get_translation(text, resolved_src, tgt_lang)
                tokens = []

            return {
                "original": text,
                "aligneration": aligneration,
                "translation": translation,
                "ipa": ipa_text,
                "result_json": {
                    "original": text,
                    "translation": translation,
                    "aligneration": aligneration,
                    "tokens": tokens,
                    "phrases": [],
                    "sentences": [],
                    "meta": {
                        "sourceLangGuess": resolved_src,
                        "targetLang": tgt_lang,
                    },
                }
            }

    def _validate_and_repair_tokens(self, original_text: str, tokens: list) -> list:
        """
        Verify that original_text[start:end] === token.text.
        Repair if possible, or drop if invalid.
        """
        valid_tokens = []
        for token in tokens:
            try:
                start = token.get("start")
                end = token.get("end")
                token_text = token.get("text")

                # Basic validation of existence
                if start is None or end is None or token_text is None:
                    continue

                # Ensure within bounds
                if start < 0 or end > len(original_text) or start >= end:
                    continue

                # Check if slice matches exactly
                actual_text = original_text[start:end]
                if actual_text != token_text:
                    # Best-effort attempt: if the text exists nearby, adjust indices?
                    # For MVP, we'll just trust the text content but keep the indices
                    # if they are within bounds and the text is reasonably similar.
                    # Or just overwrite the text to match the indices to ensure tooltip alignment.
                    token["text"] = actual_text

                valid_tokens.append(token)
            except Exception as e:
                logger.error("token_validation_error", error=str(e), token=token)
                continue
        
        # Sort by start index
        valid_tokens.sort(key=lambda x: x["start"])
        return valid_tokens

    def _get_translation(self, text: str, src_lang: str, tgt_lang: str) -> str:
        """Get translation using OpenAI only."""
        try:
            # Use OpenAI for translation
            translation = self.openai_service.translate(text, src_lang, tgt_lang)

            # Check if translation looks valid
            if (translation != text and
                not translation.startswith("[translation-error") and
                len(translation.strip()) > 0):
                return translation
            else:
                return f"[Unable to translate from {src_lang} to {tgt_lang}]"

        except Exception as e:
            logger.error("openai_translation_failed", error=str(e))
            return f"[Translation error: {str(e)}]"

    def _get_hf_translation(self, text: str, src_lang: str, tgt_lang: str) -> str:
        """Get translation using HuggingFace models."""
        try:
            src_codes = get_lang_codes(src_lang)
            tgt_codes = get_lang_codes(tgt_lang)

            logger.debug(
                "translation_request",
                backend=self.hf_translator.backend_name,
                src_lang=src_lang,
                tgt_lang=tgt_lang,
            )

            translation = self.hf_translator.translate(text, src_codes["nllb"], tgt_codes["nllb"])
            logger.debug("translation_success", backend="huggingface")
            return translation

        except Exception as e:
            logger.error("hf_translation_failed", error=str(e))
            return f"[translation-error: {e}]"
