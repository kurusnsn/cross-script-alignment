"""
Transliteration Service - Remote NLP Worker

FastAPI service for heavy NLP processing:
- Stanza dependency parsing for token grouping
- BERT-based word alignment
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import structlog
import threading
import time

from app.engine.grouper import group_tokens_with_stanza, split_sentences_with_stanza, tokenize_with_stanza
from app.engine.aligner import align_with_confidence, get_model_for_language

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ]
)

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="Transliteration Service",
    description="Remote NLP worker for aligneration alignment",
    version="1.0.0"
)


PRIMARY_BERT_LANGS = ("fa", "ar", "ja", "en")
LABSE_MODEL_NAME = "sentence-transformers/LaBSE"

_labse_model = None
_warmup_lock = threading.Lock()
_warmup_status: Dict[str, object] = {
    "state": "pending",
    "ready": False,
    "labse_loaded": False,
    "primary_bert_loaded": [],
    "required_primary_bert": list(PRIMARY_BERT_LANGS),
    "started_at": None,
    "finished_at": None,
    "error": None,
}


def _update_warmup_status(**kwargs) -> None:
    with _warmup_lock:
        _warmup_status.update(kwargs)


def _get_warmup_status() -> Dict[str, object]:
    with _warmup_lock:
        return dict(_warmup_status)


def _warm_up_models() -> None:
    global _labse_model

    _update_warmup_status(
        state="warming",
        ready=False,
        started_at=time.time(),
        finished_at=None,
        error=None,
    )

    loaded_primary_bert: List[str] = []
    try:
        logger.info("Starting readiness model warm-up")

        from sentence_transformers import SentenceTransformer

        logger.info("Loading LaBSE model", model=LABSE_MODEL_NAME)
        _labse_model = SentenceTransformer(LABSE_MODEL_NAME)
        _labse_model.encode(["readiness warmup"], normalize_embeddings=True)
        _update_warmup_status(labse_loaded=True)

        for lang in PRIMARY_BERT_LANGS:
            logger.info("Loading primary BERT model", language=lang)
            get_model_for_language(lang)
            loaded_primary_bert.append(lang)
            _update_warmup_status(primary_bert_loaded=list(loaded_primary_bert))

        _update_warmup_status(
            state="ready",
            ready=True,
            finished_at=time.time(),
            error=None,
        )
        logger.info(
            "Readiness model warm-up completed",
            labse_loaded=True,
            primary_bert_loaded=loaded_primary_bert,
        )
    except Exception as exc:
        logger.error("Readiness model warm-up failed", error=str(exc), exc_info=True)
        _update_warmup_status(
            state="error",
            ready=False,
            finished_at=time.time(),
            error=str(exc),
            primary_bert_loaded=list(loaded_primary_bert),
        )


@app.on_event("startup")
async def startup_model_warmup() -> None:
    threading.Thread(target=_warm_up_models, daemon=True, name="model-warmup").start()


# Request/Response Models
class AlignmentRequest(BaseModel):
    """Request model for alignment endpoint."""
    source_text: str = Field(..., description="Source language text")
    target_text: str = Field(..., description="Target language text (e.g., English)")
    lang: str = Field(..., description="Source language code (fa, ja, ar, en)")
    
    class Config:
        json_schema_extra = {
            "example": {
                "source_text": "من تصمیم گرفتم",
                "target_text": "I decided",
                "lang": "fa"
            }
        }


class AlignmentResponse(BaseModel):
    """Response model for alignment endpoint."""
    matrix: List[List[int]] = Field(..., description="Alignment pairs [[src_idx, tgt_idx], ...]")
    source_tokens: List[str] = Field(..., description="Source tokens (possibly grouped)")
    target_tokens: List[str] = Field(..., description="Target tokens")
    confidences: Optional[List[float]] = Field(None, description="Confidence scores for each alignment")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")
    
    class Config:
        json_schema_extra = {
            "example": {
                "matrix": [[0, 0], [1, 1]],
                "source_tokens": ["من", "تصمیم_گرفتم"],
                "target_tokens": ["I", "decided"],
                "confidences": [0.95, 0.89],
                "processing_time_ms": 1250.5
            }
        }


class SentenceSplitRequest(BaseModel):
    """Request model for sentence splitting."""
    text: str = Field(..., description="Input text to split into sentences")
    lang: str = Field(..., description="Language code (fa, ja, ar, en)")


class SentenceSplitResponse(BaseModel):
    """Response model for sentence splitting."""
    sentences: List[str] = Field(..., description="Sentence list in source order")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


class TokenizeRequest(BaseModel):
    """Request model for tokenization."""
    text: str = Field(..., description="Input text to tokenize")
    lang: str = Field(..., description="Language code")


class TokenizeResponse(BaseModel):
    """Response model for tokenization."""
    tokens: List[str] = Field(..., description="Token list in source order")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


@app.get("/health")
async def health_check():
    """Readiness-aware health endpoint."""
    warmup_status = _get_warmup_status()

    response = {
        "status": "healthy",
        "service": "alignment-service",
        "version": "1.0.0",
        "warmup": {
            "state": warmup_status["state"],
            "labse_loaded": warmup_status["labse_loaded"],
            "primary_bert_loaded": warmup_status["primary_bert_loaded"],
            "required_primary_bert": warmup_status["required_primary_bert"],
            "started_at": warmup_status["started_at"],
            "finished_at": warmup_status["finished_at"],
            "error": warmup_status["error"],
        },
    }

    if not warmup_status["ready"]:
        response["status"] = "warming"
        if warmup_status["state"] == "error":
            response["status"] = "error"
        return JSONResponse(status_code=503, content=response)

    return response


@app.post("/align", response_model=AlignmentResponse)
async def align_text(request: AlignmentRequest):
    """
    Align source and target text using Stanza grouping and BERT alignment.
    
    Process:
    1. Group source tokens using Stanza dependency parsing
    2. Tokenize target text (simple whitespace split)
    3. Align using BERT embeddings and itermax algorithm
    4. Return alignment matrix with confidence scores
    
    Timeout: 10 seconds max to prevent hanging on complex inputs
    """
    import asyncio
    
    start_time = time.time()
    
    try:
        logger.info("Alignment request received",
                   lang=request.lang,
                   source_len=len(request.source_text),
                   target_len=len(request.target_text))
        
        # Wrap processing with timeout protection
        async def process_alignment():
            # Step 1: Group source tokens with Stanza
            source_tokens, index_mapping = group_tokens_with_stanza(
                request.source_text,
                request.lang
            )
            
            logger.info("Source tokens grouped",
                       original_tokens=len(request.source_text.split()),
                       grouped_tokens=len(source_tokens))
            
            # Step 2: Tokenize target (simple whitespace for now)
            target_tokens = request.target_text.split()
            
            # Step 3: Align using BERT
            alignments, confidences, similarity_matrix = align_with_confidence(
                source_tokens,
                target_tokens,
                request.lang
            )
            
            # Convert alignments to matrix format
            alignment_matrix = [[src_idx, tgt_idx] for src_idx, tgt_idx in alignments]
            
            return alignment_matrix, source_tokens, target_tokens, confidences
        
        # Execute with 10-second timeout
        result = await asyncio.wait_for(process_alignment(), timeout=10.0)
        alignment_matrix, source_tokens, target_tokens, confidences = result
        
        processing_time = (time.time() - start_time) * 1000  # Convert to ms
        
        logger.info("Alignment completed successfully",
                   alignments=len(alignment_matrix),
                   processing_time_ms=f"{processing_time:.2f}")
        
        return AlignmentResponse(
            matrix=alignment_matrix,
            source_tokens=source_tokens,
            target_tokens=target_tokens,
            confidences=confidences,
            processing_time_ms=processing_time
        )
    
    except asyncio.TimeoutError:
        logger.error("Alignment timeout", 
                    lang=request.lang,
                    source_len=len(request.source_text))
        raise HTTPException(
            status_code=504,
            detail="Processing timeout - text may be too complex or models not responding"
        )
        
    except Exception as e:
        logger.error("Alignment failed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Alignment processing failed: {str(e)}"
        )


@app.post("/split-sentences", response_model=SentenceSplitResponse)
async def split_sentences(request: SentenceSplitRequest):
    """
    Split text into sentences using Stanza sentence segmentation.
    """
    import asyncio

    start_time = time.time()

    try:
        logger.info(
            "Sentence splitting request received",
            lang=request.lang,
            text_len=len(request.text),
        )

        async def process_split():
            return split_sentences_with_stanza(request.text, request.lang)

        sentences = await asyncio.wait_for(process_split(), timeout=8.0)
        processing_time = (time.time() - start_time) * 1000

        logger.info(
            "Sentence splitting completed",
            lang=request.lang,
            sentence_count=len(sentences),
            processing_time_ms=f"{processing_time:.2f}",
        )

        return SentenceSplitResponse(
            sentences=sentences,
            processing_time_ms=processing_time,
        )
    except asyncio.TimeoutError:
        logger.error("Sentence splitting timeout", lang=request.lang, text_len=len(request.text))
        raise HTTPException(
            status_code=504,
            detail="Sentence splitting timeout"
        )
    except Exception as e:
        logger.error("Sentence splitting failed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Sentence splitting failed: {str(e)}"
        )


@app.post("/tokenize", response_model=TokenizeResponse)
async def tokenize_text(request: TokenizeRequest):
    """Tokenize text using Stanza tokenization for the requested language."""
    import asyncio

    start_time = time.time()
    try:
        logger.info(
            "Tokenization request received",
            lang=request.lang,
            text_len=len(request.text),
        )

        async def process_tokenize():
            return tokenize_with_stanza(request.text, request.lang)

        tokens = await asyncio.wait_for(process_tokenize(), timeout=8.0)
        processing_time = (time.time() - start_time) * 1000

        logger.info(
            "Tokenization completed",
            lang=request.lang,
            token_count=len(tokens),
            processing_time_ms=f"{processing_time:.2f}",
        )

        return TokenizeResponse(tokens=tokens, processing_time_ms=processing_time)
    except asyncio.TimeoutError:
        logger.error("Tokenization timeout", lang=request.lang, text_len=len(request.text))
        raise HTTPException(status_code=504, detail="Tokenization timeout")
    except Exception as e:
        logger.error("Tokenization failed", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail=f"Tokenization failed: {str(e)}")


@app.get("/")
async def root():
    """Root endpoint with service information."""
    return {
        "service": "Transliteration Service",
        "version": "1.0.0",
        "description": "Remote NLP worker for aligneration alignment",
        "endpoints": {
            "health": "/health",
            "align": "/align (POST)",
            "split_sentences": "/split-sentences (POST)",
            "tokenize": "/tokenize (POST)",
            "docs": "/docs"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
