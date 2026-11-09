"""Security headers for every response (SEG-05)."""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

# The API only returns JSON: nothing may be loaded, framed or executed from it.
_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
# Swagger UI (development or explicitly enabled) loads its bundle from jsDelivr with an inline init.
_DOCS_CSP = (
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: "
    "https://fastapi.tiangolo.com; connect-src 'self'; frame-ancestors 'none'"
)


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, hsts: bool) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path: str = scope.get("path", "")
        is_docs = path.startswith("/docs") or path == "/openapi.json"

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = message.setdefault("headers", [])
                extra = {
                    b"x-content-type-options": b"nosniff",
                    b"x-frame-options": b"DENY",
                    # Not "no-referrer": OpenStreetMap's tile policy asks clients to send a Referer.
                    b"referrer-policy": b"strict-origin-when-cross-origin",
                    b"permissions-policy": b"geolocation=(), camera=(), microphone=()",
                    b"cross-origin-opener-policy": b"same-origin",
                    b"content-security-policy": (_DOCS_CSP if is_docs else _API_CSP).encode(),
                }
                if not is_docs:
                    # API data is per-user and changes constantly: never cache it anywhere.
                    extra[b"cache-control"] = b"no-store"
                if self.hsts:
                    extra[b"strict-transport-security"] = b"max-age=63072000; includeSubDomains"
                present = {name.lower() for name, _ in headers}
                headers.extend((k, v) for k, v in extra.items() if k not in present)
            await send(message)

        await self.app(scope, receive, send_with_headers)
