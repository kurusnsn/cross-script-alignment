"""
Rate limiting utility for FastAPI backend.
Uses slowapi for rate limiting based on IP address.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi import Request
from fastapi.responses import JSONResponse
from app.utils.config import get_settings

settings = get_settings()

# Create limiter instance backed by Redis only.
if not settings.redis_enabled:
    raise RuntimeError("Redis-backed rate limiting is required; set redis_enabled=true.")

# Redis URI format: redis://[[username]:[password]@]host:port/db
if settings.redis_username and settings.redis_password:
    auth = f"{settings.redis_username}:{settings.redis_password}@"
elif settings.redis_password:
    auth = f":{settings.redis_password}@"
elif settings.redis_username:
    auth = f"{settings.redis_username}@"
else:
    auth = ""

storage_uri = f"redis://{auth}{settings.redis_host}:{settings.redis_port}/{settings.redis_db}"
limiter = Limiter(key_func=get_remote_address, storage_uri=storage_uri)

# Default rate limits for different endpoint types
class RateLimits:
    """Default rate limits for various endpoint categories"""
    # Expensive AI/external API calls
    TRANSLIT = "30/minute"      # OpenAI API calls
    UPLOAD = "10/minute"        # Google Vision/DocumentAI calls
    TTS = "20/minute"           # TTS service calls
    
    # Authentication endpoints (stricter to prevent brute force)
    LOGIN = "5/minute"
    REGISTER = "10/minute"
    
    # Standard user endpoints
    DEFAULT = "60/minute"
    
    # Quiz/progress endpoints
    QUIZ = "60/minute"


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    """Custom handler for rate limit exceeded errors"""
    return JSONResponse(
        status_code=429,
        content={
            "error": "Rate limit exceeded",
            "detail": str(exc.detail),
            "retry_after": getattr(exc, 'retry_after', None)
        }
    )
