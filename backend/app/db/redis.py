import redis
import json
import structlog
from typing import Optional, Any
from app.utils.config import get_settings

logger = structlog.get_logger(__name__)

_REDIS_CLIENT: Optional[redis.Redis] = None

def get_redis_client() -> Optional[redis.Redis]:
    """Get or initialize the Redis client singleton."""
    global _REDIS_CLIENT
    
    settings = get_settings()
    if not settings.redis_enabled:
        return None
        
    if _REDIS_CLIENT is None:
        try:
            _REDIS_CLIENT = redis.Redis(
                host=settings.redis_host,
                port=settings.redis_port,
                db=settings.redis_db,
                username=settings.redis_username,
                password=settings.redis_password,
                decode_responses=False, # We want bytes for cache usually, but strings for some things
                socket_timeout=2.0,
                retry_on_timeout=True
            )
            _REDIS_CLIENT.ping()
            logger.info("redis_connected", host=settings.redis_host, port=settings.redis_port)
        except Exception as e:
            logger.error("redis_connection_failed", error=str(e))
            _REDIS_CLIENT = None
            
    return _REDIS_CLIENT

def redis_set_json(key: str, value: Any, ex: int = 86400) -> bool:
    """Set a JSON-serializable value in Redis."""
    client = get_redis_client()
    if not client:
        return False
    try:
        client.set(key, json.dumps(value), ex=ex)
        return True
    except Exception as e:
        logger.error("redis_set_failed", key=key, error=str(e))
        return False

def redis_get_json(key: str) -> Optional[Any]:
    """Get a JSON-deserialized value from Redis."""
    client = get_redis_client()
    if not client:
        return None
    try:
        data = client.get(key)
        if data:
            return json.loads(data)
    except Exception as e:
        logger.error("redis_get_failed", key=key, error=str(e))
    return None
