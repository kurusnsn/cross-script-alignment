import logging
from typing import Optional

import structlog

from .config import get_settings


def configure_logging(level: Optional[str] = None) -> None:
    settings = get_settings()
    log_level = (level or settings.log_level).upper()

    logging.basicConfig(
        level=log_level,
        format="%(message)s",
    )

    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(log_level)),
        context_class=dict,
        cache_logger_on_first_use=True,
    )
