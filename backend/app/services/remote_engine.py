"""
Remote Engine RPC Client

HTTP client for communicating with the remote alignment-service worker.
Handles alignment requests with proper error handling and retry logic.
"""

import os
import logging
from typing import List, Dict, Tuple, Optional
import httpx
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

logger = structlog.get_logger(__name__)

# Configuration
REMOTE_ENGINE_URL = os.getenv("REMOTE_ENGINE_URL", "http://localhost:8000")
REQUEST_TIMEOUT = 20.0  # 20 seconds for CPU inference
MAX_RETRIES = 3


class RemoteEngineError(Exception):
    """Exception raised when remote engine communication fails."""
    pass


class RemoteEngine:
    """Client for remote aligneration engine."""
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize remote engine client.
        
        Args:
            base_url: Base URL of remote service (defaults to REMOTE_ENGINE_URL env var)
        """
        self.base_url = base_url or REMOTE_ENGINE_URL
        self.client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=REQUEST_TIMEOUT,
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=5)
        )
        logger.info("Remote engine client initialized", base_url=self.base_url)
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
    
    @retry(
        stop=stop_after_attempt(MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True
    )
    async def align(
        self,
        source_text: str,
        target_text: str,
        lang: str
    ) -> Dict:
        """
        Align source and target text using remote engine.
        
        Args:
            source_text: Source language text
            target_text: Target language text (e.g., English)
            lang: Source language code (fa, ja, ar, en)
            
        Returns:
            Dictionary with alignment results:
            {
                "matrix": [[src_idx, tgt_idx], ...],
                "source_tokens": [str, ...],
                "target_tokens": [str, ...],
                "confidences": [float, ...],
                "processing_time_ms": float
            }
            
        Raises:
            RemoteEngineError: If remote call fails after retries
        """
        try:
            logger.info("Sending alignment request to remote engine",
                       lang=lang,
                       source_len=len(source_text),
                       target_len=len(target_text))
            
            response = await self.client.post(
                "/align",
                json={
                    "source_text": source_text,
                    "target_text": target_text,
                    "lang": lang
                }
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info("Remote alignment completed successfully",
                       alignments=len(result.get("matrix", [])),
                       processing_time_ms=result.get("processing_time_ms"))
            
            return result
            
        except httpx.TimeoutException as e:
            logger.error("Remote engine timeout", error=str(e))
            raise RemoteEngineError(f"Remote engine timeout after {REQUEST_TIMEOUT}s") from e
        
        except httpx.HTTPStatusError as e:
            logger.error("Remote engine HTTP error",
                        status_code=e.response.status_code,
                        error=str(e))
            raise RemoteEngineError(f"Remote engine HTTP error: {e.response.status_code}") from e
        
        except httpx.NetworkError as e:
            logger.error("Remote engine network error", error=str(e))
            raise RemoteEngineError(f"Cannot connect to remote engine at {self.base_url}") from e
        
        except Exception as e:
            logger.error("Unexpected error in remote engine call", error=str(e))
            raise RemoteEngineError(f"Unexpected error: {str(e)}") from e
    
    async def health_check(self) -> bool:
        """
        Check if remote engine is healthy.
        
        Returns:
            True if healthy, False otherwise
        """
        try:
            response = await self.client.get("/health", timeout=5.0)
            response.raise_for_status()
            data = response.json()
            is_healthy = data.get("status") == "healthy"
            
            logger.info("Remote engine health check",
                       healthy=is_healthy,
                       response=data)
            
            return is_healthy
            
        except Exception as e:
            logger.warning("Remote engine health check failed", error=str(e))
            return False


# Global singleton instance
_remote_engine: Optional[RemoteEngine] = None


def get_remote_engine() -> RemoteEngine:
    """Get or create the global remote engine instance."""
    global _remote_engine
    if _remote_engine is None:
        _remote_engine = RemoteEngine()
    return _remote_engine


async def align_with_remote_engine(
    source_text: str,
    target_text: str,
    lang: str
) -> Dict:
    """
    Convenience function to align using the global remote engine.
    
    Args:
        source_text: Source language text
        target_text: Target language text
        lang: Source language code
        
    Returns:
        Alignment result dictionary
        
    Raises:
        RemoteEngineError: If alignment fails
    """
    engine = get_remote_engine()
    return await engine.align(source_text, target_text, lang)
