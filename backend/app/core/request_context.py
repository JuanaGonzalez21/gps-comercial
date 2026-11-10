"""Per-request id (X-Request-ID) shared with logs and error responses."""

import json
import logging
import time
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Message, Receive, Scope, Send

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)
logger = logging.getLogger("app.request")


def current_request_id() -> str | None:
    return _request_id.get()


async def _send_internal_error(send: Send, request_id: str, path: str | None) -> None:
    body = json.dumps(
        {
            "type": "about:blank",
            "title": "Error interno",
            "status": 500,
            "detail": "Ocurrió un error inesperado. Intenta de nuevo más tarde.",
            "code": "internal_error",
            "instance": path,
            "request_id": request_id,
            "errors": None,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    headers = [
        (b"content-type", b"application/problem+json"),
        (b"content-length", str(len(body)).encode()),
        (b"x-request-id", request_id.encode()),
        (b"cache-control", b"no-store"),
        (b"x-content-type-options", b"nosniff"),
        (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
    ]
    await send({"type": "http.response.start", "status": 500, "headers": headers})
    await send({"type": "http.response.body", "body": body})


class RequestContextMiddleware:
    """Assigns a request id and logs one line per request (never headers, cookies or body)."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        request_id = uuid.uuid4().hex
        token = _request_id.set(request_id)
        started = time.perf_counter()
        status_code = 500
        response_started = False

        async def send_with_id(message: Message) -> None:
            nonlocal status_code, response_started
            if message["type"] == "http.response.start":
                status_code = message["status"]
                response_started = True
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        except Exception:
            # Handled here (not by Starlette's outer error middleware) so the 500 keeps the request
            # id and safe headers, is logged once in JSON, and never exposes a stack trace.
            logger.exception("unhandled_error", extra={"path": scope.get("path")})
            if response_started:
                raise
            status_code = 500
            await _send_internal_error(send, request_id, scope.get("path"))
        finally:
            logger.info(
                "request",
                extra={
                    "method": scope.get("method"),
                    "path": scope.get("path"),
                    "status": status_code,
                    "duration_ms": round((time.perf_counter() - started) * 1000, 1),
                },
            )
            _request_id.reset(token)
