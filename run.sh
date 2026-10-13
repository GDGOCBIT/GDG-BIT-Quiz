#!/usr/bin/env bash
# QuizLive local dev — starts the FastAPI backend (:8000) and the Next.js
# frontend (:3000) together. Ctrl+C stops both.
#
#   ./run.sh                    # default ports 8000 / 3000
#   API_PORT=9000 ./run.sh      # custom ports
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-3000}"

need() { command -v "$1" >/dev/null 2>&1 || { echo "missing: $1" >&2; exit 1; }; }
need uv
need npm

# -- backend env ---------------------------------------------------------
if [ ! -f "$BACKEND/.env" ]; then
  echo "[run] creating backend/.env from .env.example — edit it before continuing"
  cp "$BACKEND/.env.example" "$BACKEND/.env"
  echo "[run] ⚠  Set DATABASE_URL, AUTH_SECRET and ADMIN_PASSWORD in backend/.env"
  exit 1
fi

# Check DATABASE_URL is set (not the placeholder)
if grep -q "YOUR_PASSWORD" "$BACKEND/.env" 2>/dev/null; then
  echo "[run] ⚠  backend/.env still has the placeholder DATABASE_URL — update it first"
  exit 1
fi

# The backend uses asyncpg, which only speaks PostgreSQL — reject sqlite/file URLs early
DB_URL="$(grep -E '^DATABASE_URL=' "$BACKEND/.env" | tail -1 | cut -d= -f2- | tr -d ' "\"')"
case "$DB_URL" in
  postgresql://*|postgres://*)
    ;;
  *)
    echo "[run] ⚠  DATABASE_URL must start with postgresql:// or postgres:// (asyncpg has no sqlite support)" >&2
    echo "[run]    current value: $DB_URL" >&2
    echo "[run]    local dev: postgresql://postgres@127.0.0.1:5432/quizlive (see ./start-db.sh)" >&2
    exit 1
    ;;
esac

# Ensure local Postgres is up (no-op if already running or if helper is absent)
if [ -x "$ROOT/start-db.sh" ]; then
  "$ROOT/start-db.sh"
fi

port_in_use() { (echo > "/dev/tcp/127.0.0.1/$1") >/dev/null 2>&1; }
for spec in "backend:$API_PORT" "frontend:$WEB_PORT"; do
  name="${spec%%:*}"; port="${spec##*:}"
  if port_in_use "$port"; then
    echo "[run] ⚠  port $port is already in use ($name) — kill the stale process first:" >&2
    echo "[run]    ss -ltnp | grep $port" >&2
    echo "[run]    or run on other ports: API_PORT=8001 WEB_PORT=3001 ./run.sh" >&2
    exit 1
  fi
done

if [ ! -d "$BACKEND/.venv" ]; then
  echo "[run] installing backend deps…"
  (cd "$BACKEND" && uv sync --group dev)
fi

# -- frontend env --------------------------------------------------------
if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "[run] installing frontend deps…"
  (cd "$FRONTEND" && npm install)
fi

cleanup() {
  echo; echo "[run] stopping…"
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "[run] backend  → http://localhost:$API_PORT/docs"
(cd "$BACKEND" && uv run uvicorn app.main:app --reload --port "$API_PORT") &
API_PID=$!

echo "[run] frontend → http://localhost:$WEB_PORT"
# Local dev must share ONE database between backend and frontend — force the
# frontend onto the local Postgres regardless of its own .env (which may point
# at a cloud DB). Production (Vercel etc.) uses its own env instead.
LOCAL_DB_URL="${LOCAL_DATABASE_URL:-postgresql://postgres@127.0.0.1:5432/quizlive}"
(cd "$FRONTEND" && DATABASE_URL="$LOCAL_DB_URL" NEXT_PUBLIC_QUIZ_API_URL="http://localhost:$API_PORT" npm run dev -- --port "$WEB_PORT") &
WEB_PID=$!

wait
