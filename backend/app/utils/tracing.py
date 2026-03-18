"""
OpenTelemetry tracing utilities for performance regression detection.

Provides manual spans for critical operations to measure real waiting times,
not just execution. This enables regression detection in CI.
"""

from contextlib import contextmanager
from typing import Optional, Dict, Any
import time

from opentelemetry import trace
from opentelemetry.trace import Status, StatusCode, Span

from app.utils.config import get_settings

settings = get_settings()

# Get tracer - will be noop if OTEL not configured
tracer = trace.get_tracer("align-backend", "1.0.0")


@contextmanager
def trace_span(
    name: str,
    attributes: Optional[Dict[str, Any]] = None,
    record_exception: bool = True
):
    """
    Context manager for creating traced spans.

    Args:
        name: Span name (e.g., "auth.verify_token", "db.pool_wait")
        attributes: Optional span attributes
        record_exception: Whether to record exceptions in the span

    Yields:
        The active span
    """
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                if value is not None:
                    span.set_attribute(key, value)
        try:
            yield span
        except Exception as e:
            if record_exception:
                span.record_exception(e)
                span.set_status(Status(StatusCode.ERROR, str(e)))
            raise


class SpanNames:
    """Standardized span names for consistency."""
    # Auth operations
    AUTH_VERIFY_TOKEN = "auth.verify_token"
    AUTH_PASSWORD_HASH = "auth.password_hash"
    AUTH_PASSWORD_VERIFY = "auth.password_verify"

    # Rate limiting
    RATE_LIMIT_CHECK = "rate_limit.check"

    # Database operations
    DB_POOL_WAIT = "db.pool_wait"
    DB_QUERY = "db.query"
    DB_COMMIT = "db.commit"

    # Cache operations
    CACHE_GET = "cache.get"
    CACHE_SET = "cache.set"
    CACHE_TTS_LOOKUP = "cache.tts_lookup"

    # External API calls
    EXTERNAL_OPENAI = "external.openai"
    EXTERNAL_OPENAI_TRANSLITERATE = "external.openai.alignerate"
    EXTERNAL_OPENAI_TRANSLATE = "external.openai.translate"
    EXTERNAL_OPENAI_COMBINED = "external.openai.combined"
    EXTERNAL_STRIPE = "external.stripe"
    EXTERNAL_REMOTE_ENGINE = "external.remote_engine"
    EXTERNAL_REMOTE_ENGINE_ALIGN = "external.remote_engine.align"
    EXTERNAL_TTS = "external.tts"
    EXTERNAL_GOOGLE_VISION = "external.google_vision"
    EXTERNAL_GOOGLE_DOCAI = "external.google_docai"

    # Queue/background operations
    QUEUE_WAIT = "queue.wait"
    BACKGROUND_JOB = "background.job"

    # Streaming operations
    STREAM_FIRST_BYTE = "stream.first_byte"
    STREAM_COMPLETE = "stream.complete"


def add_span_attributes(span: Span, **kwargs):
    """Add multiple attributes to a span, filtering None values."""
    for key, value in kwargs.items():
        if value is not None:
            span.set_attribute(key, value)


def record_span_timing(span: Span, start_time: float, key: str = "duration_ms"):
    """Record timing information in a span."""
    duration_ms = (time.time() - start_time) * 1000
    span.set_attribute(key, duration_ms)
    return duration_ms


# Convenience decorators for common operations
def trace_external_call(service: str, operation: str):
    """Decorator for tracing external service calls."""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            span_name = f"external.{service}.{operation}"
            with trace_span(span_name, {"service": service, "operation": operation}) as span:
                start = time.time()
                try:
                    result = await func(*args, **kwargs)
                    record_span_timing(span, start)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    record_span_timing(span, start)
                    raise

        def sync_wrapper(*args, **kwargs):
            span_name = f"external.{service}.{operation}"
            with trace_span(span_name, {"service": service, "operation": operation}) as span:
                start = time.time()
                try:
                    result = func(*args, **kwargs)
                    record_span_timing(span, start)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    record_span_timing(span, start)
                    raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator


def trace_db_operation(operation: str):
    """Decorator for tracing database operations."""
    def decorator(func):
        async def async_wrapper(*args, **kwargs):
            span_name = f"db.{operation}"
            with trace_span(span_name, {"db.operation": operation}) as span:
                start = time.time()
                try:
                    result = await func(*args, **kwargs)
                    record_span_timing(span, start)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    record_span_timing(span, start)
                    raise

        def sync_wrapper(*args, **kwargs):
            span_name = f"db.{operation}"
            with trace_span(span_name, {"db.operation": operation}) as span:
                start = time.time()
                try:
                    result = func(*args, **kwargs)
                    record_span_timing(span, start)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    record_span_timing(span, start)
                    raise

        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper
    return decorator
