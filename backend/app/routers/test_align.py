"""
Test router for remote aligneration engine.

This router provides endpoints to test the new Stanza+BERT alignment
without affecting the existing production endpoints.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional
import structlog

from app.services.remote_engine import align_with_remote_engine, RemoteEngineError
from app.models.align import RemoteAlignRequest

router = APIRouter(prefix="/align", tags=["test-align"])


class TestAlignResponse(BaseModel):
    """Response model for test alignment."""
    success: bool
    source_tokens: List[str]
    target_tokens: List[str]
    alignments: List[List[int]]
    confidences: Optional[List[float]] = None
    processing_time_ms: float
    engine: str = "remote-stanza-bert"
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "source_tokens": ["من", "تصمیم_گرفتم", "به", "مدرسه", "بروم"],
                "target_tokens": ["I", "decided", "to", "go", "to", "school"],
                "alignments": [[0, 0], [1, 1], [2, 2], [3, 5], [4, 3]],
                "confidences": [0.95, 0.89, 0.92, 0.87, 0.91],
                "processing_time_ms": 1250.5,
                "engine": "remote-stanza-bert"
            }
        }


@router.post("/test-align", response_model=TestAlignResponse)
async def test_align(request: RemoteAlignRequest):
    """
    Test alignment using remote Stanza+BERT engine.
    
    This endpoint bypasses the legacy alignment system and directly
    calls the remote worker for testing the new grouping logic.
    
    **Validation:**
    - Language codes must be in supported list
    - Text length: 1-500 characters
    - Control characters are automatically stripped
    
    **Differences from production /align/align:**
    - Uses Stanza dependency parsing for token grouping
    - Uses language-specific BERT models for alignment
    - Detects light verb constructions (LVCs) and compounds
    - Returns confidence scores for each alignment
    
    **Example use cases:**
    - Testing Farsi light verb constructions: "تصمیم گرفتم" → "decided"
    - Testing Japanese compounds: "食べてみる" → "try eating"
    - Testing Arabic fixed expressions: "في الواقع" → "in fact"
    """
    try:
        logger.info("Test alignment request received",
                   lang=request.lang,
                   source_len=len(request.source_text),
                   target_len=len(request.target_text))
        
        # Call remote engine (validation already done by Pydantic)
        result = await align_with_remote_engine(
            source_text=request.source_text,
            target_text=request.target_text,
            lang=request.lang
        )
        
        # Extract results
        return TestAlignResponse(
            success=True,
            source_tokens=result["source_tokens"],
            target_tokens=result["target_tokens"],
            alignments=result["matrix"],
            confidences=result.get("confidences"),
            processing_time_ms=result["processing_time_ms"],
            engine="remote-stanza-bert"
        )
        
    except RemoteEngineError as e:
        logger.error("Remote engine error", error=str(e))
        raise HTTPException(
            status_code=503,
            detail=f"Remote engine unavailable: {str(e)}"
        )
    
    except Exception as e:
        logger.error("Test alignment failed", error=str(e), exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Alignment failed: {str(e)}"
        )


@router.get("/test-health")
async def test_health():
    """
    Check health of remote engine.
    
    Returns the status of the remote aligneration worker.
    """
    from app.services.remote_engine import get_remote_engine
    
    try:
        engine = get_remote_engine()
        is_healthy = await engine.health_check()
        
        return {
            "remote_engine_healthy": is_healthy,
            "remote_engine_url": engine.base_url,
            "status": "ok" if is_healthy else "degraded"
        }
    
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return {
            "remote_engine_healthy": False,
            "remote_engine_url": "unknown",
            "status": "error",
            "error": str(e)
        }
