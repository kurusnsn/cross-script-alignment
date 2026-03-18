from contextlib import suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError

from app.db import models  # noqa: F401  # ensure models are imported for metadata
from app.db.base import Base, engine
from app.db.redis import get_redis_client
from app.routers import align, quiz, upload, test_align, auth, history, billing, vocabulary, progress
from app.services.align_service import warm_up_translator
from app.utils.rate_limit import limiter, rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
import sentry_sdk
from app.utils.config import get_settings
from app.utils.logging import configure_logging
from app.utils.metrics import MetricsMiddleware, get_metrics_response, track_event_loop_lag
import asyncio

configure_logging()
settings = get_settings()

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        traces_sample_rate=1.0,
        profiles_sample_rate=1.0,
    )

# OpenTelemetry Setup
if settings.otel_exporter_otlp_endpoint:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

    resource = Resource.create(attributes={
        "service.name": settings.otel_service_name,
        "environment": "production"
    })

    provider = TracerProvider(resource=resource)
    processor = BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint, insecure=True))
    provider.add_span_processor(processor)
    trace.set_tracer_provider(provider)


app = FastAPI(
    title="Translit Backend",
    description="API powering aligneration-first language learning.",
    version="0.1.0",
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(MetricsMiddleware)

app.include_router(align.router)
app.include_router(quiz.router)
app.include_router(upload.router)
app.include_router(test_align.router)  # New test router for remote engine
app.include_router(auth.router)
app.include_router(history.router)
app.include_router(vocabulary.router)
app.include_router(billing.router)
app.include_router(progress.router)

if settings.otel_exporter_otlp_endpoint:
    FastAPIInstrumentor.instrument_app(app)

@app.get("/metrics", tags=["observability"], summary="Prometheus metrics")
async def metrics():
    return get_metrics_response()



@app.on_event("startup")
def on_startup() -> None:
    # Fail fast when Redis is expected but unavailable, so rate limiting and shared cache semantics stay consistent.
    if settings.redis_enabled and get_redis_client() is None:
        raise RuntimeError("Redis is required but unavailable at startup.")

    # Start background tasks
    asyncio.create_task(track_event_loop_lag())
    
    with suppress(OperationalError):
        Base.metadata.create_all(bind=engine)
    # Skip NLLB model loading - using OpenAI for translation
    # warm_up_translator()


@app.get("/healthz", tags=["health"], summary="Simple service health check")
def healthcheck() -> dict[str, str]:
    with suppress(OperationalError):
        engine.connect().close()
    return {"status": "ok"}
