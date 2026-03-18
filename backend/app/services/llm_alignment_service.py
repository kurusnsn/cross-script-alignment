"""
LLM-only phrase alignment service using OpenAI for direct semantic alignment.

This service bypasses the complex SimAlign + LaBSE pipeline and uses pure LLM
for bilingual phrase alignment, focusing on semantic understanding over
statistical alignment algorithms.
"""

import json
import time
from typing import List, Dict, Any, Optional
import structlog

from app.services.openai_service import get_openai_service

logger = structlog.get_logger(__name__)


class LLMAlignmentService:
    """Service for LLM-only phrase alignment using OpenAI."""

    def __init__(self):
        self.openai_service = get_openai_service()

    def align_phrases(self, source_text: str, target_text: str) -> Dict[str, Any]:
        """
        Perform phrase alignment using pure LLM approach.

        Args:
            source_text: Source text in any language
            target_text: English target text

        Returns:
            Dict with alignments and timing data
        """
        start_time = time.time()

        logger.info(" [LLM_ALIGN] Starting LLM-only phrase alignment",
                   source_text=source_text[:50],
                   target_text=target_text[:50])

        # Language-agnostic alignment prompt with both phrase and word-level alignments
        prompt = f"""You are a multilingual alignment engine.

Task:
Align source text (any language) with target English text into both:
1. Natural phrase alignments (semantic, idiomatic).
2. Word-level alignments (smaller glosses).

Rules:
- Phrase Alignments:
  - Align by meaning, not by single word if a phrase is more natural.
  - Compound verbs, phrasal verbs, and idioms must align as single units.
  - If the subject is encoded in the verb, include it in English (e.g. "hablamos" → "we speak").
  - Merge adjective + verb (e.g. "آفتابی بود" → "was sunny").
  - Merge verb + object when they form one action (e.g. "بستنی خریدیم" → "we bought ice cream").
- Word Alignments:
  - Provide smaller units where possible (verbs, nouns, particles).
  - Keep closer to dictionary-style mapping.
- Be language-agnostic: apply the same logic to Persian, Japanese, Hindi, German, etc.
- Return only JSON with two keys: phrase_alignments and word_alignments.

Example:
Source: "بستنی خریدیم"
Target: "We bought ice cream"

Output:
{{
  "phrase_alignments": [
    {{"source": "بستنی خریدیم", "target": "we bought ice cream"}}
  ],
  "word_alignments": [
    {{"source": "بستنی", "target": "ice cream"}},
    {{"source": "خریدیم", "target": "we bought"}}
  ]
}}

---

Now align this:

Source: "{source_text}"
Target: "{target_text}"

Return JSON with phrase_alignments and word_alignments arrays."""

        try:
            # Call OpenAI with the alignment prompt
            response = self.openai_service.client.chat.completions.create(
                model=self.openai_service.model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.1  # Low temperature for consistent output
            )

            response_text = response.choices[0].message.content.strip()

            # Parse the LLM response
            parsed_result = self._parse_llm_response(response_text)

            total_time = time.time() - start_time

            # Extract phrase alignments for backward compatibility
            phrase_alignments = parsed_result.get("phrase_alignments", [])
            word_alignments = parsed_result.get("word_alignments", [])

            logger.info(" [LLM_ALIGN] LLM alignment completed",
                       total_time_s=f"{total_time:.2f}",
                       phrase_alignments_count=len(phrase_alignments),
                       word_alignments_count=len(word_alignments))

            return {
                "alignments": phrase_alignments,  # Keep backward compatibility
                "phrase_alignments": phrase_alignments,
                "word_alignments": word_alignments,
                "timing": {
                    "llm_processing": total_time,
                    "total": total_time
                },
                "raw_response": response_text[:200]  # For debugging
            }

        except Exception as e:
            error_time = time.time() - start_time
            logger.error(" [LLM_ALIGN] LLM alignment failed",
                        error=str(e),
                        error_time_s=f"{error_time:.2f}")

            # Return empty alignments on failure
            return {
                "alignments": [],
                "phrase_alignments": [],
                "word_alignments": [],
                "timing": {
                    "llm_processing": error_time,
                    "total": error_time
                },
                "error": str(e)
            }

    def _parse_llm_response(self, response_text: str) -> Dict[str, List[Dict[str, str]]]:
        """
        Parse LLM JSON response with robust error handling.

        Args:
            response_text: Raw LLM response text

        Returns:
            Dict with 'phrase_alignments' and 'word_alignments' keys containing lists of alignments
        """
        logger.debug(" [LLM_PARSE] Parsing LLM response",
                    response_length=len(response_text))

        try:
            # Try to parse as JSON directly
            parsed = json.loads(response_text)

            result = {"phrase_alignments": [], "word_alignments": []}

            if isinstance(parsed, dict):
                # New format with phrase_alignments and word_alignments
                if "phrase_alignments" in parsed and "word_alignments" in parsed:
                    phrase_alignments = parsed.get("phrase_alignments", [])
                    word_alignments = parsed.get("word_alignments", [])
                # Backward compatibility with old format
                elif "alignments" in parsed:
                    phrase_alignments = parsed["alignments"]
                    word_alignments = []
                else:
                    logger.warning(" [LLM_PARSE] Unexpected JSON structure",
                                 structure=type(parsed).__name__)
                    return result
            elif isinstance(parsed, list):
                # Legacy format - treat as phrase alignments
                phrase_alignments = parsed
                word_alignments = []
            else:
                logger.warning(" [LLM_PARSE] Unexpected JSON structure",
                             structure=type(parsed).__name__)
                return result

            # Validate and process phrase alignments
            validated_phrase_alignments = []
            for alignment in phrase_alignments:
                if (isinstance(alignment, dict) and
                    "source" in alignment and
                    "target" in alignment):
                    validated_phrase_alignments.append({
                        "source": str(alignment["source"]).strip(),
                        "target": str(alignment["target"]).strip(),
                        "confidence": 0.9,  # LLM alignments get high confidence
                        "refined": True     # Mark as LLM-generated
                    })
                else:
                    logger.warning(" [LLM_PARSE] Invalid phrase alignment structure",
                                 alignment=alignment)

            # Validate and process word alignments
            validated_word_alignments = []
            for alignment in word_alignments:
                if (isinstance(alignment, dict) and
                    "source" in alignment and
                    "target" in alignment):
                    validated_word_alignments.append({
                        "source": str(alignment["source"]).strip(),
                        "target": str(alignment["target"]).strip(),
                        "confidence": 0.8,  # Word alignments get slightly lower confidence
                        "refined": True     # Mark as LLM-generated
                    })
                else:
                    logger.warning(" [LLM_PARSE] Invalid word alignment structure",
                                 alignment=alignment)

            result["phrase_alignments"] = validated_phrase_alignments
            result["word_alignments"] = validated_word_alignments

            logger.info(" [LLM_PARSE] JSON parsing successful",
                       phrase_alignments=len(validated_phrase_alignments),
                       word_alignments=len(validated_word_alignments))

            return result

        except json.JSONDecodeError as e:
            logger.warning(" [LLM_PARSE] JSON decode failed, attempting fallback parsing",
                         error=str(e),
                         response_preview=response_text[:100])

            # Fallback parsing for malformed JSON
            return self._fallback_parse(response_text)

    def _fallback_parse(self, response_text: str) -> Dict[str, List[Dict[str, str]]]:
        """
        Fallback parser for malformed LLM responses.

        Attempts to extract alignment patterns even if JSON is malformed.
        """
        logger.info(" [LLM_FALLBACK] Attempting fallback parsing")

        result = {"phrase_alignments": [], "word_alignments": []}

        # Look for patterns like: "source": "text", "target": "text"
        import re

        # Pattern to match source/target pairs
        pattern = r'"source":\s*"([^"]+)"[^}]*"target":\s*"([^"]+)"'
        matches = re.findall(pattern, response_text, re.IGNORECASE)

        # Since we can't distinguish phrase vs word alignments in fallback,
        # treat all as phrase alignments
        for source, target in matches:
            result["phrase_alignments"].append({
                "source": source.strip(),
                "target": target.strip(),
                "confidence": 0.8,  # Lower confidence for fallback parsing
                "refined": True
            })

        if result["phrase_alignments"]:
            logger.info(" [LLM_FALLBACK] Fallback parsing successful",
                       alignments_found=len(result["phrase_alignments"]))
        else:
            logger.warning(" [LLM_FALLBACK] Fallback parsing failed")

        return result


# Global service instance
_llm_alignment_service: Optional[LLMAlignmentService] = None

def get_llm_alignment_service() -> LLMAlignmentService:
    """Get the global LLM alignment service instance."""
    global _llm_alignment_service
    if _llm_alignment_service is None:
        _llm_alignment_service = LLMAlignmentService()
    return _llm_alignment_service