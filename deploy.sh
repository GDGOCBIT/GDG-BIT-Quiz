#!/usr/bin/env bash
# QuizLive deploy helper.
#
# Typical workflow:
#   1. Backend  → render.com (auto-deploy from Git, see backend/render.yaml)
#   2. Frontend → Vercel or Netlify (connect repo, set NEXT_PUBLIC_QUIZ_API_URL)
#
# This script handles the manual / CI path:
#
#   ./deploy.sh                 build + push frontend to Vercel
#   ./deploy.sh --backend-only  apply DB schema + restart backend on Render
#   ./deploy.sh --schema-only   apply schema.sql to the DATABASE_URL
#
# Prerequisites:
#   npm i -g vercel           # Vercel CLI
#   pip install render-cli    # optional — or use Render dashboard
#   DATABASE_URL env var set  # for --schema-only / --backend-only
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

FRONTEND_ONLY=0
BACKEND_ONLY=0
SCHEMA_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --frontend-only) FRONTEND_ONLY=1 ;;
    --backend-only)  BACKEND_ONLY=1  ;;
    --schema-only)   SCHEMA_ONLY=1   ;;
    *) echo "unknown flag: $arg (use --frontend-only, --backend-only, --schema-only)" >&2; exit 1 ;;
  esac
done

# -- Schema migration -----------------------------------------------------
apply_schema() {
  : "${DATABASE_URL:?DATABASE_URL must be set}"
  echo "[deploy] applying schema.sql to database…"
  psql "$DATABASE_URL" -f "$BACKEND/schema.sql"
  echo "[deploy] schema applied ✓"
}

if [ "$SCHEMA_ONLY" -eq 1 ]; then
  apply_schema
  exit 0
fi

# -- Backend (Render auto-deploys from Git — manual psql fallback here) ---
if [ "$BACKEND_ONLY" -eq 1 ] || [ "$FRONTEND_ONLY" -eq 0 ]; then
  if [ -n "${DATABASE_URL:-}" ]; then
    apply_schema
  else
    echo "[deploy] DATABASE_URL not set — skipping schema migration"
    echo "[deploy]   Render will apply it on startup via Store.connect()"
  fi
fi

if [ "$BACKEND_ONLY" -eq 1 ]; then
  echo "[deploy] Backend deployed via Render auto-deploy (push to main branch)."
  echo "[deploy] To trigger a manual deploy: open Render dashboard → Manual Deploy"
  exit 0
fi

# -- Frontend (Vercel) ----------------------------------------------------
command -v vercel >/dev/null 2>&1 || {
  echo "missing: vercel (npm i -g vercel)" >&2
  exit 1
}

echo "[deploy] building frontend…"
(cd "$FRONTEND" && npm ci && npm run build)

echo "[deploy] deploying frontend to Vercel…"
(cd "$FRONTEND" && vercel --prod)

echo "[deploy] done ✓"
echo ""
echo "Remember to set NEXT_PUBLIC_QUIZ_API_URL in your Vercel project settings"
echo "to point at your Render backend URL."
