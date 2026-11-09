# Production image for the GPS Comercial API (DEP-05). Dependencies come from uv.lock (pinned).
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH"

COPY --from=ghcr.io/astral-sh/uv:0.13.7 /uv /bin/uv
WORKDIR /app

# Dependencies first so code changes do not invalidate this layer.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --locked --no-dev --no-install-project

COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
COPY scripts/start.sh ./start.sh
RUN uv sync --locked --no-dev && chmod +x start.sh \
    && useradd --create-home --uid 10001 api && chown -R api /app
USER api

EXPOSE 8000
CMD ["./start.sh"]
