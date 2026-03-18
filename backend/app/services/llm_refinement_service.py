"""
LLM-based alignment refinement service for improving low-confidence alignments.

Uses OpenAI GPT-4o-mini to refine alignments that SimAlign has low confidence in.
Includes caching to avoid repeated API calls for the same sentence pairs.
"""

import json
import hashlib
from typing import List, Dict, Optional
import structlog

import openai
from app.db.redis import redis_get_json, redis_set_json
from app.utils.config import get_settings

logger = structlog.get_logger(__name__)
_REFINEMENT_CACHE_PREFIX = "alignment_refinement:v1"
_REFINEMENT_CACHE_TTL_SECONDS = 86400


class LLMRefinementService:
    """Service for refining low-confidence alignments using LLM."""

    def __init__(self):
        settings = get_settings()
        self.openai_client = openai.OpenAI(api_key=settings.openai_api_key)

    def _generate_cache_key(self, source_text: str, target_text: str,
                          low_conf_spans: List[Dict]) -> str:
        """Generate cache key for alignment refinement."""
        cache_data = {
            "source": source_text,
            "target": target_text,
            "low_conf": sorted(low_conf_spans, key=lambda x: x["source"])
        }
        cache_string = json.dumps(cache_data, sort_keys=True)
        cache_hash = hashlib.sha256(cache_string.encode()).hexdigest()
        return f"{_REFINEMENT_CACHE_PREFIX}:{cache_hash}"

    def refine_alignments(self, source_text: str, target_text: str,
                         low_conf_spans: List[Dict]) -> List[Dict]:
        """
        Refine low-confidence alignment spans using LLM.

        Args:
            source_text: Original source sentence
            target_text: Original target sentence
            low_conf_spans: List of {"source": str, "target": str} with low confidence

        Returns:
            List of refined alignments: [{"source": str, "target": str}]
        """
        if not low_conf_spans:
            return []

        # Check distributed cache first (no per-instance cache).
        cache_key = self._generate_cache_key(source_text, target_text, low_conf_spans)
        cached_result = redis_get_json(cache_key)
        if isinstance(cached_result, list):
            logger.info("Using cached refinement", cache_key=cache_key[:24])
            return cached_result

        try:
            # Prepare prompt for LLM
            prompt = self._build_refinement_prompt(source_text, target_text, low_conf_spans)

            # Call OpenAI
            response = self.openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,  # Low temperature for consistent results
                max_tokens=1000
            )

            # Parse response
            refined_alignments = self._parse_llm_response(response.choices[0].message.content)

            # Cache result in Redis for cross-instance reuse.
            redis_set_json(cache_key, refined_alignments, ex=_REFINEMENT_CACHE_TTL_SECONDS)

            logger.info("LLM refinement completed",
                       original_count=len(low_conf_spans),
                       refined_count=len(refined_alignments))

            return refined_alignments

        except Exception as e:
            logger.error("LLM refinement failed", error=str(e))
            # Return original low-confidence spans as fallback
            return low_conf_spans

    def _build_refinement_prompt(self, source_text: str, target_text: str,
                                low_conf_spans: List[Dict]) -> str:
        """Build prompt for LLM alignment refinement."""

        low_conf_list = "\n".join([f"- \"{span['source']}\" → \"{span['target']}\""
                                  for span in low_conf_spans])

        prompt = f"""You are an expert in multilingual text alignment. I need you to improve word/phrase alignments between two sentences.

Source sentence: "{source_text}"
Target sentence: "{target_text}"

The following alignments have low confidence and need refinement:
{low_conf_list}

Your task:
1. For each low-confidence source phrase, identify the correct target phrase(s) it should align to
2. Consider context, grammar, and semantic meaning
3. Ensure each source phrase maps to appropriate target phrase(s)
4. Preserve the meaning relationship between source and target

Return your refined alignments in JSON format:
[
  {{"source": "source_phrase", "target": "correct_target_phrase"}},
  {{"source": "another_phrase", "target": "its_correct_target"}}
]

Rules:
- Only return alignments for the source phrases I provided
- Target phrases should be exact substrings or combinations from the target sentence
- If a source phrase maps to multiple target words, join them with spaces
- Respond only with valid JSON, no additional text"""

        return prompt

    def _parse_llm_response(self, response_text: str) -> List[Dict]:
        """Parse LLM response to extract refined alignments."""
        try:
            # Clean response text
            response_text = response_text.strip()

            # Find JSON in response (handle cases where LLM adds extra text)
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']')

            if start_idx == -1 or end_idx == -1:
                logger.warning("No JSON array found in LLM response")
                return []

            json_text = response_text[start_idx:end_idx + 1]
            refined_alignments = json.loads(json_text)

            # Validate structure
            if not isinstance(refined_alignments, list):
                logger.warning("LLM response is not a list")
                return []

            validated_alignments = []
            for alignment in refined_alignments:
                if (isinstance(alignment, dict) and
                    "source" in alignment and
                    "target" in alignment and
                    isinstance(alignment["source"], str) and
                    isinstance(alignment["target"], str)):
                    validated_alignments.append({
                        "source": alignment["source"].strip(),
                        "target": alignment["target"].strip()
                    })

            logger.info("Successfully parsed LLM response",
                       count=len(validated_alignments))
            return validated_alignments

        except json.JSONDecodeError as e:
            logger.error("Failed to parse LLM JSON response", error=str(e),
                        response=response_text[:200])
            return []
        except Exception as e:
            logger.error("Error parsing LLM response", error=str(e))
            return []


# Global service instance
_refinement_service: Optional[LLMRefinementService] = None


def get_refinement_service() -> LLMRefinementService:
    """Get the global LLM refinement service instance."""
    global _refinement_service
    if _refinement_service is None:
        _refinement_service = LLMRefinementService()
    return _refinement_service


def refine_low_confidence_alignments(source_text: str, target_text: str,
                                   low_conf_spans: List[Dict]) -> List[Dict]:
    """
    Convenience function to refine low-confidence alignments.

    Args:
        source_text: Original source sentence
        target_text: Original target sentence
        low_conf_spans: List of low-confidence alignment spans

    Returns:
        List of refined alignments
    """
    service = get_refinement_service()
    return service.refine_alignments(source_text, target_text, low_conf_spans)
