from fastapi import APIRouter, Depends, Response, Request
import time
import structlog

logger = structlog.get_logger(__name__)

from app.models.align import (
    AlignRequest, AlignResponse, TranslitRequest, TranslitResponse,
    PhraseAlignRequest, PhraseAlignResponse, SimAlignRequest, SimAlignResponse,
    EnhancedPhraseAlignRequest, EnhancedPhraseAlignResponse, TokensInfo, TimingInfo,
    LLMPhraseAlignRequest, LLMPhraseAlignResponse, LLMTimingInfo,
    SentenceAlignRequest, SentenceAlignResponse, SentenceAlignmentResult,
)
from app.services.alignment_service import align_tokens, align_sentences
from app.services.phrase_alignment_service import align_sentence_pair
from app.services.simalign_service import align_word_pairs, align_with_confidence_scores, merge_alignments_with_confidence
from app.services.align_service import TranslitService
from app.services.auth_service import get_optional_current_user
from app.db.session import get_db
from app.utils.lang_utils import resolve_lang_code
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.utils.rate_limit import limiter, RateLimits
from app.utils.tracing import trace_span, SpanNames

router = APIRouter(prefix="/align", tags=["aligneration"])


def get_align_service() -> TranslitService:
    return TranslitService()


@router.options("", summary="Handle CORS preflight for aligneration endpoint")
def alignerate_options():
    return Response(status_code=200)


@router.post("", response_model=TranslitResponse, summary="Generate aligneration, translation, and IPA")
@limiter.limit(RateLimits.TRANSLIT)
async def alignerate(
    request: Request,
    payload: TranslitRequest,
    service: TranslitService = Depends(get_align_service),
    current_user=Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> TranslitResponse:
    start_time = time.time()
    logger.info(" [TRANSLIT_API] Starting aligneration", text=payload.text[:50], source_lang=payload.source_lang, target_lang=payload.target_lang)

    result = service.process(payload.text, payload.source_lang, payload.target_lang)

    # Try to get grouped tokens from remote engine (Stanza-based grouping)
    # This provides better token grouping for compound verbs and multi-word expressions
    original_tokens = result.get('original', '').split()
    align_tokens = result.get('aligneration', '').split()
    translation_tokens = result.get('translation', '').split()
    
    try:
        from app.services.remote_engine import align_with_remote_engine
        
        # Detect language code for remote engine
        detected_lang = resolve_lang_code(payload.source_lang or "", payload.text)
        
        # Validate for remote engine using RemoteAlignRequest model
        from app.models.align import RemoteAlignRequest
        validated_request = RemoteAlignRequest(
            source_text=result.get('original', ''),
            target_text=result.get('translation', ''),
            lang=detected_lang
        )
        
        logger.info(" [TRANSLIT_API] Calling remote engine for grouped tokens", lang=validated_request.lang)
        
        # Call remote engine to get grouped tokens
        with trace_span(SpanNames.EXTERNAL_REMOTE_ENGINE):
            remote_result = await align_with_remote_engine(
                source_text=validated_request.source_text,
                target_text=validated_request.target_text,
                lang=validated_request.lang
            )
        
        # Use remote engine's grouped tokens and matrix
        original_tokens = remote_result.get('source_tokens', original_tokens)
        translation_tokens = remote_result.get('target_tokens', translation_tokens)
        result['alignment'] = remote_result.get('matrix', [])
        
        logger.info(" [TRANSLIT_API] Remote engine tokens and matrix received",
                   source_tokens=len(original_tokens),
                   target_tokens=len(translation_tokens),
                   alignments=len(result['alignment']))
        
    except Exception as e:
        logger.warning(" [TRANSLIT_API] Remote engine unavailable, using simple tokenization", error=str(e))
        # Fallback to simple space-based tokenization
        pass

    # Add tokens to result
    result['original_tokens'] = original_tokens
    result['align_tokens'] = align_tokens
    result['translation_tokens'] = translation_tokens

    total_time = (time.time() - start_time) * 1000  # Convert to milliseconds
    logger.info(" [TRANSLIT_API] Transliteration completed",
                time_ms=f"{total_time:.2f}",
                original=result.get('original', '')[:30],
                aligneration=result.get('aligneration', '')[:30],
                translation=result.get('translation', '')[:30],
                token_counts=f"{len(original_tokens)}/{len(align_tokens)}/{len(translation_tokens)}")

    # Save to translations table only when explicitly requested by the client
    if current_user is not None and payload.persist:
        try:
            source_lang = payload.source_lang or "auto"
            target_lang = payload.target_lang or "en"
            db.execute(
                text("""
                    INSERT INTO translations
                    (user_id, source_language, target_language, original_text, aligneration, translated_text)
                    VALUES (:user_id, :source_lang, :target_lang, :original, :align, :translation)
                """),
                {
                    "user_id": current_user.id,
                    "source_lang": source_lang,
                    "target_lang": target_lang,
                    "original": result.get('original', ''),
                    "align": result.get('aligneration', ''),
                    "translation": result.get('translation', ''),
                }
            )
            db.commit()
            logger.info(" [TRANSLIT_API] History saved to translations table", user_id=current_user.id)
        except Exception as e:
            logger.warning(" [TRANSLIT_API] Failed to save history", error=str(e))
            db.rollback()

    return TranslitResponse(**result)


@router.post("/align", response_model=AlignResponse, summary="Align tokens between original, aligneration, and translation")
@limiter.limit(RateLimits.DEFAULT)
def align(request: Request, payload: AlignRequest) -> AlignResponse:
    start_time = time.time()
    logger.info(" [ALIGN_API] Starting token alignment",
                original_tokens=len(payload.original_tokens),
                align_tokens=len(payload.align_tokens),
                translation_tokens=len(payload.translation_tokens),
                k=payload.k)

    try:
        alignments = align_tokens(
            payload.original_tokens,
            payload.align_tokens,
            payload.translation_tokens,
            k=payload.k,
            original_text=payload.original_text,
            translation_text=payload.translation_text,
        )

        total_time = (time.time() - start_time) * 1000
        logger.info(" [ALIGN_API] Token alignment completed",
                    time_ms=f"{total_time:.2f}",
                    alignments_count=len(alignments))

        return AlignResponse(alignments=alignments)

    except Exception as e:
        error_time = (time.time() - start_time) * 1000
        logger.error(" [ALIGN_API] Token alignment failed",
                     time_ms=f"{error_time:.2f}",
                     error=str(e))
        raise


@router.post("/align-sentences", response_model=SentenceAlignResponse, summary="Align sentences individually")
@limiter.limit(RateLimits.DEFAULT)
def align_sentences_endpoint(request: Request, payload: SentenceAlignRequest) -> SentenceAlignResponse:
    start_time = time.time()
    logger.info(" [ALIGN_SENTENCES_API] Starting per-sentence alignment",
                num_sentences=len(payload.sentences))

    try:
        sentence_dicts = [s.model_dump() for s in payload.sentences]
        results = align_sentences(sentence_dicts)

        total_time = (time.time() - start_time) * 1000
        logger.info(" [ALIGN_SENTENCES_API] Completed",
                    time_ms=f"{total_time:.2f}",
                    num_sentences=len(results))

        return SentenceAlignResponse(
            sentence_alignments=[
                SentenceAlignmentResult(mappings=mappings)
                for mappings in results
            ]
        )

    except Exception as e:
        error_time = (time.time() - start_time) * 1000
        logger.error(" [ALIGN_SENTENCES_API] Failed",
                     time_ms=f"{error_time:.2f}",
                     error=str(e))
        raise


@router.post("/phrase-align", response_model=EnhancedPhraseAlignResponse, summary="Align phrases with confidence scoring and LLM refinement")
@limiter.limit(RateLimits.TRANSLIT)
def phrase_align(request: Request, payload: EnhancedPhraseAlignRequest) -> EnhancedPhraseAlignResponse:
    """
    Advanced phrase alignment using SimAlign + LaBSE with confidence scoring and LLM refinement.

    Pipeline:
    1. Get word alignments with confidence scores from SimAlign
    2. Merge consecutive alignments into phrases
    3. Identify low-confidence alignments (< 0.6 threshold)
    4. Refine low-confidence alignments using OpenAI GPT-4o-mini
    5. Return enhanced response with confidence scores and refinement flags

    Returns enhanced response optimized for React/Next.js UI with color-coded alignments:
    - Blue: High confidence (>= 0.6)
    - Red dashed: LLM-refined alignments
    """
    overall_start = time.time()
    logger.info(" [PHRASE_ALIGN_API] Starting phrase alignment",
                source_text=payload.source_text[:50],
                target_text=payload.target_text[:50])

    try:
        # Step 1: Get confidence-scored alignments
        step1_start = time.time()
        logger.info(" [PHRASE_ALIGN_API] Step 1: Getting SimAlign confidence scores")

        from app.services.simalign_service import get_simalign_service

        simalign_service = get_simalign_service()
        confidence_data = simalign_service.align_with_confidence_scores(
            payload.source_text, payload.target_text
        )

        step1_time = (time.time() - step1_start) * 1000
        logger.info(" [PHRASE_ALIGN_API] Step 1 completed", time_ms=f"{step1_time:.2f}")

        alignment_result = confidence_data["alignment_result"]
        confidence_scores = confidence_data["confidence_scores"]
        threshold = confidence_data["low_confidence_threshold"]

        # Step 2: Extract alignment pairs
        step2_start = time.time()
        alignment_pairs = [(a.source_index, a.target_index) for a in alignment_result.alignments]
        step2_time = (time.time() - step2_start) * 1000
        logger.info(" [PHRASE_ALIGN_API] Step 2: Extracted alignment pairs", time_ms=f"{step2_time:.2f}", pairs_count=len(alignment_pairs))

        # Step 3: Merge consecutive alignments with confidence
        step3_start = time.time()
        logger.info(" [PHRASE_ALIGN_API] Step 3: Merging consecutive alignments")

        merged_alignments = merge_alignments_with_confidence(
            alignment_result.source_tokens,
            alignment_result.target_tokens,
            alignment_pairs,
            confidence_scores
        )

        step3_time = (time.time() - step3_start) * 1000
        logger.info(" [PHRASE_ALIGN_API] Step 3 completed", time_ms=f"{step3_time:.2f}", merged_count=len(merged_alignments))

        # Step 4: Identify low-confidence alignments and partial collocation matches
        low_conf_spans = []
        for alignment in merged_alignments:
            # Include if confidence is low OR if it's flagged for LLM refinement
            if (alignment["confidence"] < threshold or
                alignment.get("_needs_llm_refinement", False)):
                low_conf_spans.append({
                    "source": alignment["source"],
                    "target": alignment["target"]
                })

        logger.info(" [PHRASE_ALIGN_API] Step 4: Low confidence + partial matches identified",
                   low_conf_count=len([a for a in merged_alignments if a["confidence"] < threshold]),
                   partial_match_count=len([a for a in merged_alignments if a.get("_needs_llm_refinement", False)]),
                   total_for_llm=len(low_conf_spans))

        # Step 4.5: If no alignments, trigger LLM for the whole sentence
        if not merged_alignments:
            logger.info("No SimAlign alignments found, falling back to LLM for entire sentence.")
            low_conf_spans = [{
                "source": payload.source_text,
                "target": payload.target_text
            }]

        # Step 5: Refine low-confidence alignments with LLM
        step5_start = time.time()
        refined_alignments = []
        refinement_map = {}

        if low_conf_spans:
            logger.info(" [PHRASE_ALIGN_API] Step 5: Starting LLM refinement", low_conf_count=len(low_conf_spans))
            try:
                from app.services.llm_refinement_service import refine_low_confidence_alignments

                refined_alignments = refine_low_confidence_alignments(
                    payload.source_text,
                    payload.target_text,
                    low_conf_spans
                )
                # Create lookup map for refined alignments
                refinement_map = {
                    refined["source"]: refined["target"]
                    for refined in refined_alignments
                }

                step5_time = (time.time() - step5_start) * 1000
                logger.info(" [PHRASE_ALIGN_API] Step 5: LLM refinement completed",
                           time_ms=f"{step5_time:.2f}",
                           refined_count=len(refined_alignments))

            except Exception as e:
                step5_error_time = (time.time() - step5_start) * 1000
                logger.error(" [PHRASE_ALIGN_API] Step 5: LLM refinement failed",
                            time_ms=f"{step5_error_time:.2f}",
                            error=str(e))
        else:
            logger.info("⏭️ [PHRASE_ALIGN_API] Step 5: Skipping LLM refinement (no low-confidence spans)")

        # Step 6: Build final alignments with refinement flags
        final_alignments = []
        if not merged_alignments and refined_alignments:
            # If we started with no alignments, the refined ones are our final list
            final_alignments = [
                {
                    "source": ref["source"],
                    "target": ref["target"],
                    "confidence": 0.0,  # Confidence is unknown, default to 0
                    "refined": True
                }
                for ref in refined_alignments
            ]
        else:
            for alignment in merged_alignments:
                source_phrase = alignment["source"]
                original_target = alignment["target"]
                confidence = alignment["confidence"]

                # Check if this alignment was refined
                refined_target = refinement_map.get(source_phrase, original_target)
                was_refined = refined_target != original_target

                final_alignments.append({
                    "source": source_phrase,
                    "target": refined_target,
                    "confidence": confidence,
                    "refined": was_refined
                })

        # Clean up internal flags from final alignments
        for alignment in final_alignments:
            alignment.pop("_needs_llm_refinement", None)

        # Step 7: Build enhanced response
        overall_time = (time.time() - overall_start) * 1000
        logger.info(" [PHRASE_ALIGN_API] Complete pipeline finished",
                    total_time_ms=f"{overall_time:.2f}",
                    final_alignments_count=len(final_alignments))

        return EnhancedPhraseAlignResponse(
            original=payload.source_text,
            translation=payload.target_text,
            tokens=TokensInfo(
                source=alignment_result.source_tokens,
                target=alignment_result.target_tokens
            ),
            alignments=final_alignments,
            timing=TimingInfo(
                simalign=step1_time / 1000,
                span_embeddings=step3_time / 1000,
                llm_refinement=step5_time / 1000 if 'step5_time' in locals() else 0.0,
                total=overall_time / 1000
            )
        )

    except Exception as e:
        error_time = (time.time() - overall_start) * 1000
        logger.error(" [PHRASE_ALIGN_API] Phrase alignment failed",
                     total_time_ms=f"{error_time:.2f}",
                     error=str(e))

        # Fallback to simple alignment
        simple_result = align_word_pairs(payload.source_text, payload.target_text)
        simple_pairs = [(a.source_index, a.target_index) for a in simple_result.alignments]

        # Use basic confidence scores for fallback
        default_confidence = {pair: 0.5 for pair in simple_pairs}
        simple_merged = merge_alignments_with_confidence(
            simple_result.source_tokens,
            simple_result.target_tokens,
            simple_pairs,
            default_confidence
        )

        # Convert to expected format
        fallback_alignments = [
            {
                "source": alignment["source"],
                "target": alignment["target"],
                "confidence": alignment["confidence"],
                "refined": False
            }
            for alignment in simple_merged
        ]

        return EnhancedPhraseAlignResponse(
            original=payload.source_text,
            translation=payload.target_text,
            tokens=TokensInfo(
                source=simple_result.source_tokens,
                target=simple_result.target_tokens
            ),
            alignments=fallback_alignments,
            timing=TimingInfo(
                simalign=error_time / 1000,
                span_embeddings=0.0,
                llm_refinement=0.0,
                total=error_time / 1000
            )
        )


@router.post("/llm-phrase-align", response_model=LLMPhraseAlignResponse, summary="LLM-only phrase alignment using OpenAI")
@limiter.limit(RateLimits.TRANSLIT)
def llm_phrase_align(request: Request, payload: LLMPhraseAlignRequest) -> LLMPhraseAlignResponse:
    """
    LLM-only phrase alignment using OpenAI for direct semantic understanding.

    This pipeline bypasses SimAlign/LaBSE complexity and uses pure LLM for bilingual
    phrase alignment, focusing on semantic understanding over statistical algorithms.

    Pipeline:
    1. Send source + target text to OpenAI with specialized alignment prompt
    2. Parse JSON response with robust error handling
    3. Return phrase-level alignments with high confidence scores

    Benefits:
    - Direct semantic understanding of idioms and compound verbs
    - Natural handling of implied subjects and context
    - Simpler architecture with single OpenAI call
    - Better handling of Persian compound verbs (گوش داد, قدم زد)
    """
    overall_start = time.time()
    logger.info(" [LLM_PHRASE_ALIGN] Starting LLM-only phrase alignment",
                source_text=payload.source_text[:50],
                target_text=payload.target_text[:50])

    try:
        from app.services.llm_alignment_service import get_llm_alignment_service

        llm_service = get_llm_alignment_service()
        result = llm_service.align_phrases(payload.source_text, payload.target_text)

        total_time = time.time() - overall_start

        logger.info(" [LLM_PHRASE_ALIGN] LLM alignment completed",
                   total_time_s=f"{total_time:.2f}",
                   alignments_count=len(result["alignments"]))

        return LLMPhraseAlignResponse(
            original=payload.source_text,
            translation=payload.target_text,
            alignments=result["alignments"],
            timing=LLMTimingInfo(
                llm_processing=result["timing"]["llm_processing"],
                total=total_time
            ),
            raw_response=result.get("raw_response")
        )

    except Exception as e:
        error_time = time.time() - overall_start
        logger.error(" [LLM_PHRASE_ALIGN] LLM alignment failed",
                    total_time_s=f"{error_time:.2f}",
                    error=str(e))

        # Return empty response on failure
        return LLMPhraseAlignResponse(
            original=payload.source_text,
            translation=payload.target_text,
            alignments=[],
            timing=LLMTimingInfo(
                llm_processing=error_time,
                total=error_time
            ),
            raw_response=f"Error: {str(e)}"
        )


@router.post("/word-align", response_model=SimAlignResponse, summary="Advanced word alignment using SimAlign + LaBSE")
@limiter.limit(RateLimits.DEFAULT)
def word_align(request: Request, payload: SimAlignRequest) -> SimAlignResponse:
    """
    Perform state-of-the-art word alignment using SimAlign with LaBSE embeddings.

    Uses the Itermax algorithm for optimal word-to-word alignment across any language pair.
    Supports confidence scoring when requested.

    Features:
    - Reuses your existing LaBSE model cache
    - Language-agnostic (works with 100+ languages)
    - Itermax algorithm for optimal alignment
    - Optional confidence scoring
    """
    if payload.include_confidence:
        result = align_with_confidence_scores(payload.source_text, payload.target_text)
    else:
        result = align_word_pairs(payload.source_text, payload.target_text)

    alignments = [
        {
            "source_index": a.source_index,
            "target_index": a.target_index,
            "source_word": a.source_word,
            "target_word": a.target_word,
            "confidence": a.confidence,
        }
        for a in result.alignments
    ]

    return SimAlignResponse(
        source_tokens=result.source_tokens,
        target_tokens=result.target_tokens,
        alignments=alignments,
        method=result.method
    )
