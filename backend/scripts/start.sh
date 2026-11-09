#!/bin/sh
# Container entrypoint (Render free tier has no shell or pre-deploy step).
# 1) Apply pending migrations (idempotent).  2) Ensure the initial admin if ADMIN_EMAIL is set
# (idempotent; remove ADMIN_PASSWORD from the provider after the first deploy).  3) Serve the API.
set -e
alembic upgrade head
if [ -n "${ADMIN_EMAIL:-}" ]; then
  python -m app.cli seed-admin
fi
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
