from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base
from sqlalchemy import event
import time

from app.utils.config import get_settings
from app.utils.metrics import DB_POOL_USAGE
from app.utils.tracing import trace_span, SpanNames

settings = get_settings()

engine = create_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=settings.db_pool_timeout,
)

@event.listens_for(engine, "checkout")
def receive_checkout(dbapi_connection, connection_record, connection_proxy):
    # Track pool usage
    pool = engine.pool
    usage_ratio = (pool.checkedout() + 1) / (pool.size() + pool._max_overflow)
    DB_POOL_USAGE.set(usage_ratio)
    
    # Store start time for pool wait if we had to wait
    # This is slightly tricky to measure exactly without custom pool
    # but we can at least log that a checkout happened.
    connection_record.info['checkout_start'] = time.perf_counter()

@event.listens_for(engine, "checkin")
def receive_checkin(dbapi_connection, connection_record):
    pool = engine.pool
    usage_ratio = (pool.checkedout() - 1) / (pool.size() + pool._max_overflow)
    DB_POOL_USAGE.set(usage_ratio)

# Manual span hook for DB operations is better handled in a decorator or session wrapper
# but we can record pool wait here if we had a way to know it was stalled.

Base = declarative_base()
