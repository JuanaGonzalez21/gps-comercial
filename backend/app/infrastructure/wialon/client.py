"""Low-level Wialon Remote API client: transport, session lifecycle and retries.

- Every call is a POST to the single configured host (no user-controlled URLs, SEG-10).
- Lazy `token/login`; the session id lives only in memory and is never logged.
- Wialon kills idle sessions after 5 minutes: we log in again before that and, if a call still
  answers "invalid session" (1 or 1011), we log in once more and retry that call once.
- Reads are retried with exponential backoff on transport errors and concurrency limits.
  Writes are never retried after being sent: the change might have been applied.
"""

import json
import logging
import threading
import time
from collections.abc import Callable
from typing import Any

import httpx2

from app.domain import errors as domain
from app.infrastructure.wialon.errors import (
    CONCURRENCY_CODES,
    INVALID_SESSION_CODES,
    WialonApiError,
    login_error,
    to_domain_error,
)

logger = logging.getLogger("app.wialon")

SESSION_IDLE_LIMIT_SECONDS = 240  # Wialon destroys sessions after 300 s without requests.
READ_RETRIES = 2
BACKOFF_SECONDS = 0.5

UNAVAILABLE = "Wialon no respondió a tiempo. Intenta de nuevo en unos segundos."
UNCERTAIN_WRITE = (
    "No se pudo confirmar si Wialon aplicó el cambio. Revisa el estado antes de reintentar."
)


class WialonClient:
    def __init__(
        self,
        *,
        base_url: str,
        token: str,
        timeout_seconds: float,
        transport: httpx2.BaseTransport | None = None,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._url = base_url
        self._token = token
        self._clock = clock
        self._sleep = sleep
        self._http = httpx2.Client(
            timeout=httpx2.Timeout(timeout_seconds, connect=min(5.0, timeout_seconds)),
            transport=transport,
            headers={"User-Agent": "gps-comercial-backend"},
        )
        self._session_lock = threading.Lock()
        self._sid: str | None = None
        self._last_used = 0.0

    @property
    def configured(self) -> bool:
        return bool(self._token)

    # ----- public API --------------------------------------------------------------------
    def call(
        self,
        svc: str,
        params: dict[str, Any],
        *,
        read_only: bool,
        accept_errors: frozenset[int] = frozenset(),
    ) -> Any:
        """Run one service call. Codes in `accept_errors` are returned as the body (e.g. 1001)."""
        if not self._token:
            raise domain.UpstreamNotConfiguredError(
                "La integración con Wialon no está configurada (falta WIALON_TOKEN)."
            )
        attempt = 0
        relogged = False
        while True:
            sid = self._ensure_session()
            try:
                body = self._post(svc, params, sid)
                self._raise_for_wialon_error(body, svc, accept_errors)
                self._last_used = self._clock()
                return body
            except WialonApiError as error:
                if error.code in INVALID_SESSION_CODES and not relogged:
                    relogged = True
                    self._invalidate(sid)
                    continue
                if error.code in CONCURRENCY_CODES and read_only and attempt < READ_RETRIES:
                    attempt += 1
                    self._backoff(attempt)
                    continue
                logger.warning("wialon_error", extra={"svc": svc, "wialon_code": error.code})
                raise to_domain_error(error) from None
            except httpx2.TransportError as exc:
                # ConnectError means nothing reached Wialon, so even a write is safe to resend.
                safe = read_only or isinstance(exc, httpx2.ConnectError)
                if safe and attempt < READ_RETRIES:
                    attempt += 1
                    self._backoff(attempt)
                    continue
                logger.warning(
                    "wialon_unavailable", extra={"svc": svc, "error_type": type(exc).__name__}
                )
                message = UNAVAILABLE if safe else UNCERTAIN_WRITE
                raise domain.UpstreamUnavailableError(message, retry_after_seconds=10) from None

    def logout(self) -> None:
        with self._session_lock:
            sid, self._sid = self._sid, None
        if sid:
            try:
                self._post("core/logout", {}, sid)
            except (httpx2.HTTPError, domain.DomainError):
                logger.info("wialon_logout_failed")

    def close(self) -> None:
        self.logout()
        self._http.close()

    # ----- internals ---------------------------------------------------------------------
    def _ensure_session(self) -> str:
        with self._session_lock:
            fresh = self._clock() - self._last_used < SESSION_IDLE_LIMIT_SECONDS
            if self._sid and fresh:
                return self._sid
            self._sid = self._login()
            self._last_used = self._clock()
            return self._sid

    def _login(self) -> str:
        try:
            body = self._post("token/login", {"token": self._token}, None)
        except httpx2.TransportError:
            logger.warning("wialon_login_unavailable")
            raise domain.UpstreamUnavailableError(UNAVAILABLE, retry_after_seconds=10) from None
        if isinstance(body, dict) and body.get("error"):
            logger.warning("wialon_login_failed", extra={"wialon_code": body.get("error")})
            raise login_error(int(body["error"]))
        sid = body.get("eid") if isinstance(body, dict) else None
        if not isinstance(sid, str) or not sid:
            raise domain.UpstreamError("Wialon respondió el inicio de sesión sin sesión válida.")
        logger.info("wialon_session_started")
        return sid

    def _invalidate(self, sid: str) -> None:
        with self._session_lock:
            if self._sid == sid:  # another thread may already have renewed it
                self._sid = None

    def _post(self, svc: str, params: dict[str, Any], sid: str | None) -> Any:
        data = {"svc": svc, "params": json.dumps(params, separators=(",", ":"))}
        if sid:
            data["sid"] = sid
        response = self._http.post(self._url, data=data)
        if response.status_code >= 500:
            raise httpx2.RemoteProtocolError(f"HTTP {response.status_code}")
        if response.status_code != 200:
            raise domain.UpstreamError("Wialon respondió con un estado HTTP inesperado.")
        try:
            return response.json()
        except ValueError:
            raise domain.UpstreamError("Wialon devolvió una respuesta que no es JSON.") from None

    @staticmethod
    def _raise_for_wialon_error(body: Any, svc: str, accept: frozenset[int] = frozenset()) -> None:
        # {"error": 0} means success (e.g. core/logout); errors carry a non-zero code.
        if isinstance(body, dict) and isinstance(body.get("error"), int):
            code = body["error"]
            if code != 0 and code not in accept:
                raise WialonApiError(code, svc)

    def _backoff(self, attempt: int) -> None:
        self._sleep(BACKOFF_SECONDS * (2 ** (attempt - 1)))
