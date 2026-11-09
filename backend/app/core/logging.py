"""Structured JSON logging with redaction of sensitive values (ARQ-07, SEG-09)."""

import json
import logging
import re
import sys
from datetime import UTC, datetime
from typing import Any

from app.core.request_context import current_request_id

_RESERVED = set(vars(logging.makeLogRecord({})).keys()) | {"message", "asctime"}
_SENSITIVE_KEY = re.compile(r"pass|token|secret|cookie|sid|authorization", re.IGNORECASE)
# Values that look like long hex/base64url secrets (Wialon tokens, session ids, JWTs).
_SECRET_VALUE = re.compile(r"[A-Fa-f0-9]{32,}|eyJ[\w-]+\.[\w-]+\.[\w-]+")


def _redact(value: Any) -> Any:
    if isinstance(value, str):
        return _SECRET_VALUE.sub("[redacted]", value)
    return value


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": _redact(record.getMessage()),
        }
        request_id = current_request_id()
        if request_id:
            payload["request_id"] = request_id
        for key, value in vars(record).items():
            if key in _RESERVED or key.startswith("_"):
                continue
            payload[key] = "[redacted]" if _SENSITIVE_KEY.search(key) else _redact(value)
        if record.exc_info:
            payload["exception"] = _redact(self.formatException(record.exc_info))
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
    # httpx-style clients log full URLs at INFO; keep them quiet.
    for noisy in ("httpx2", "httpcore2", "uvicorn.access"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
