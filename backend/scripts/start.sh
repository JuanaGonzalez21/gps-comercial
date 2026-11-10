#!/bin/sh
# Container entrypoint (Render free tier has no shell or pre-deploy step).
# 1) Apply pending migrations (idempotent).
# 2) Create the initial admin only when ADMIN_EMAIL and ADMIN_PASSWORD are both set; an existing
#    user is left untouched. A seed problem is logged but never prevents the API from starting.
# 3) Serve the API.
set -e
alembic upgrade head
if [ -n "${ADMIN_EMAIL:-}" ] && [ -n "${ADMIN_PASSWORD:-}" ]; then
  python -m app.cli seed-admin || echo "seed-admin failed; continuing startup" >&2
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
