"""Structured JSON logging with per-request context."""

import json
import logging
import sys
from contextvars import ContextVar
from datetime import UTC, datetime

from engine import ENGINE_VERSION

# Context fields named in CLAUDE.md; set by middleware and handlers where they apply.
CONTEXT_FIELDS = (
    "requestId",
    "userId",
    "startupId",
    "simulationId",
    "turn",
    "jobId",
    "modelVersion",
)
log_context: ContextVar[dict[str, object] | None] = ContextVar("log_context", default=None)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, object] = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
            "service": "simulation",
            "engineVersion": ENGINE_VERSION,
        }
        entry.update(log_context.get() or {})
        extra = getattr(record, "fields", None)
        if isinstance(extra, dict):
            entry.update(extra)
        if record.exc_info:
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
    # Uvicorn's access log duplicates our request log.
    logging.getLogger("uvicorn.access").disabled = True
    for name in ("uvicorn", "uvicorn.error"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
