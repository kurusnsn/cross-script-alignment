import time
import asyncio
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable

# Metrics
REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "path", "status_code"]
)

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total number of HTTP requests",
    ["method", "path", "status_code"]
)

ERROR_COUNT = Counter(
    "http_errors_total",
    "Total number of HTTP errors",
    ["method", "path", "status_code", "error_type"]
)

EVENT_LOOP_LAG = Gauge(
    "event_loop_lag_seconds",
    "Event loop lag in seconds"
)

DB_POOL_USAGE = Gauge(
    "db_pool_usage_ratio",
    "Database connection pool usage ratio"
)

WORKER_UTILIZATION = Gauge(
    "worker_utilization_percent",
    "Thread pool worker utilization percentage"
)

class MetricsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        method = request.method
        path = request.url.path
        
        start_time = time.perf_counter()
        
        try:
            response = await call_next(request)
            duration = time.perf_counter() - start_time
            status_code = response.status_code
            
            REQUEST_DURATION_SECONDS.labels(
                method=method, path=path, status_code=status_code
            ).observe(duration)
            
            REQUEST_COUNT.labels(
                method=method, path=path, status_code=status_code
            ).inc()
            
            return response
        except Exception as e:
            duration = time.perf_counter() - start_time
            REQUEST_DURATION_SECONDS.labels(
                method=method, path=path, status_code=500
            ).observe(duration)
            
            REQUEST_COUNT.labels(
                method=method, path=path, status_code=500
            ).inc()
            
            ERROR_COUNT.labels(
                method=method, path=path, status_code=500, error_type=type(e).__name__
            ).inc()
            raise

async def track_event_loop_lag():
    """Background task to track event loop lag."""
    while True:
        start = time.perf_counter()
        await asyncio.sleep(0.1)
        # Ideal lag is 0.1s + scheduling time.
        # We subtract 0.1 to get the actual "lag" or "jitter"
        lag = time.perf_counter() - start - 0.1
        EVENT_LOOP_LAG.set(max(0, lag))
        await asyncio.sleep(1) # Track every second

def get_metrics_response() -> Response:
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
