# QuizLive

A real-time live quiz competition platform for GDG events and conferences.

Players scan a QR code (or type a short join code), enter their name and stream, and race through the same questions against the clock. Scores are computed instantly on-device and synced to the server over WebSockets — no per-question round-trips, no rate-limit surprises on spotty mobile data.

```
Mobile (player)
  │  1× GET /bundle  (all Q&A at once)
  │  WS answer.submit / leaderboard.update
  ▼
FastAPI Backend ──── PostgreSQL (Aiven / Render / Neon / Supabase)
  │
  ├── WS /ws/admin/{id}   ◄── Admin Dashboard (quiz.state, leaderboard.update)
  └── REST /api/v1/*

Frontend (Next.js) ── Vercel / Netlify
```

## ⚡ One-Click Free Deploy

### Option 1: Fullstack Next.js on Vercel (Recommended — 100% Free, Instant)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FGDGOCBIT%2FGDG-BIT-Quiz&root-directory=frontend&env=DATABASE_URL,AUTH_SECRET,ADMIN_PASSWORD&project-name=gdg-quizlive)

1. Click the **Deploy with Vercel** button above.
2. Enter the 3 environment variables:
   - `DATABASE_URL`: `postgres://avnadmin:...@pg-384ce2d2-bit-projects.l.aivencloud.com:16658/defaultdb?sslmode=require` (or your Neon/Supabase URL)
   - `AUTH_SECRET`: `gdg-on-campus-quiz-production-secret-token-key-2026` (any 32+ char secret)
   - `ADMIN_PASSWORD`: `holyshit` (your admin console master password)
3. Click **Deploy** — your site will be live on `https://<your-project>.vercel.app` in ~60 seconds!

### Option 2: Python FastAPI WebSocket Backend on Render (Free)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/GDGOCBIT/GDG-BIT-Quiz)

Uses `backend/render.yaml` for instant automatic setup on Render with zero CLI commands needed.

---

## Architecture at a glance

| Layer | Tech | Notes |
|---|---|---|
| API | **FastAPI** | HTTP + WebSocket, async throughout |
| Database | **PostgreSQL** (asyncpg) | Aiven, Render PG, Neon, Supabase — any PG works |
| Auth | **JWT Bearer** (PyJWT) | Participant tokens (24h) + admin tokens (12h) |
| Realtime | **WebSockets** + HTTP fallback | `POST /sync` for networks that block WS upgrades |
| Frontend | **Next.js 15** | App Router, Tailwind, shadcn/ui |
| Hosting | **Render** (backend) + **Vercel / Netlify** (frontend) | Or Docker anywhere |

### Why offline-first bundle loading?

Mobile networks at events are unpredictable. Fetching one question at a time over HTTP risks request timeouts and rate-limit errors right when participants are mid-question. `GET /bundle` downloads every question (including `correct_index`) in a single request the moment the quiz starts. The phone then:

1. Advances questions locally (no network needed between questions).
2. Computes correctness and speed-bonus points client-side for zero-latency UI.
3. Streams results back over a single persistent WebSocket connection.

The server re-validates every submission (`ms_taken` → recalculated points, clamped to max 150) and deduplicates (first answer wins — double-taps can't double-score). The leaderboard is the server's source of truth.

> **Security note**: shipping `correct_index` to every phone means a curious participant can open DevTools and see answers. For a friendly GDG event this is an explicit and acceptable trade-off. For competitive quizzes, remove `correct_index` from the bundle and score server-side on `POST /answer`.

---

## Quick start — local

### Option A: Docker Compose (recommended, zero setup)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env: set AUTH_SECRET and ADMIN_PASSWORD (DATABASE_URL is pre-set for Docker)

docker compose up --build
# backend  → http://localhost:8000/docs
# postgres → localhost:5432
```

Seed a demo quiz:
```bash
docker compose exec api uv run seed.py sample-questions.json
```

### Option B: Manual (uv + local/remote PostgreSQL)

```bash
# 1. Copy and fill in the env file
cp backend/.env.example backend/.env
# Set DATABASE_URL to your PostgreSQL URL, e.g.:
#   postgresql://quiz:quiz@localhost:5432/quizlive
#   or your Aiven URL: postgresql://avnadmin:…@pg-…aivencloud.com:16658/defaultdb?sslmode=require

# 2. Install deps
cd backend && uv sync --group dev

# 3. Run (schema is applied automatically on startup)
uv run uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs

# 4. (optional) seed a demo quiz
uv run seed.py sample-questions.json

# 5. Frontend (separate terminal)
cd ../frontend && NEXT_PUBLIC_QUIZ_API_URL=http://localhost:8000 npm install && npm run dev
```

### One-command dev

```bash
./run.sh
# backend  → http://localhost:8000/docs
# frontend → http://localhost:3000
```

---

## Deploy to production

### Backend → Render.com (recommended — full WebSocket support)

Render is the easiest host for FastAPI with persistent WebSocket connections.

1. **Push this repo to GitHub / GitLab.**
2. [render.com](https://render.com) → **New → Blueprint** → select this repo.  
   Render reads `backend/render.yaml` and creates the web service automatically.
3. In the Render dashboard, set these environment variables:
   ```
   DATABASE_URL   = postgresql://avnadmin:…@pg-….aivencloud.com:16658/defaultdb?sslmode=require
   ADMIN_PASSWORD = your-strong-password
   ```
   (`AUTH_SECRET` is auto-generated by Render from `render.yaml`.)
4. Every push to `main` triggers an auto-deploy.

**Manual deploy** (skip Blueprint):

```bash
# Render → New → Web Service → Python
# Build command:  pip install -r requirements.txt
# Start command:  uvicorn app.main:app --host 0.0.0.0 --port $PORT
# Health path:    /healthz
```

### Frontend → Vercel

```bash
npm i -g vercel
cd frontend && vercel --prod
```

In the Vercel project settings → Environment Variables:
```
NEXT_PUBLIC_QUIZ_API_URL = https://your-api.onrender.com
```

### Frontend → Netlify

```bash
npm i -g netlify-cli
cd frontend && netlify deploy --prod --dir=out  # after `npm run build`
```

Or connect the repo in the Netlify dashboard and set:
```
NEXT_PUBLIC_QUIZ_API_URL = https://your-api.onrender.com
```

### Alternative: Docker (self-hosted / VPS)

```bash
docker build backend -t quizlive-api
docker run -d -p 8000:8000 \
  -e DATABASE_URL="postgresql://…" \
  -e AUTH_SECRET="$(python -c 'import secrets; print(secrets.token_hex(32))')" \
  -e ADMIN_PASSWORD="your-password" \
  quizlive-api
```

---

## API reference

Base path: `/api/v1` · Full interactive docs at `/docs` when the server is running.

### Admin endpoints (require `Authorization: Bearer <admin JWT>`)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/admin/login` | `{password}` → `{token}` (12h JWT) |
| `GET` | `/admin/quizzes` | List all quizzes with counts |
| `POST` | `/admin/quizzes` | Create quiz (auto-generates join code) |
| `DELETE` | `/admin/quizzes?id=` | Delete (quiz must be ended first) |
| `GET` | `/admin/quizzes/{id}/questions` | List questions |
| `POST` | `/admin/quizzes/{id}/questions` | Add one question (draft only) |
| `POST` | `/admin/quizzes/{id}/questions/bulk` | Import up to 200 questions |
| `DELETE` | `/admin/questions/{qid}` | Remove a question |
| `POST` | `/admin/quizzes/{id}/control` | `{action: open\|start\|next\|end}` |
| `GET` | `/admin/quizzes/{id}/live` | Host snapshot (current Q, board, stats) |

### Player endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/quiz/by-code/{code}` | — | Join-page info (title, status, count) |
| `POST` | `/quiz/join` | — | `{code, name, stream}` → `{participant_token, …}` |
| `GET` | `/quiz/bundle` | player JWT | **One-shot**: quiz + all Q&A + score + top-10 |
| `GET` | `/quiz/leaderboard` | player JWT | Top-10 + my rank + score |
| `POST` | `/quiz/answer` | player JWT | Single answer (HTTP fallback) |
| `POST` | `/quiz/sync` | player JWT | Batched answers (HTTP fallback) |

### WebSockets

> Browsers can't set custom headers on `new WebSocket()`, so auth travels as the **first JSON message** (within 5 seconds), never in the URL.

**`WS /ws/play`** — player connection

```jsonc
// → Client sends (within 5s of connecting)
{ "type": "hello", "token": "<participant JWT>" }

// ← Server responds
{ "type": "welcome", "me": { "score": 0, "rank": 1 }, "top10": [], "total_participants": 0, "server_now_ms": 1700000000000 }

// → Submit answer
{ "type": "answer.submit", "question_id": "abc123", "choice": 2, "ms_taken": 3200, "points": 125 }

// → Batched sync (same as HTTP /sync)
{ "type": "sync", "answers": [ { "question_id": "…", "choice": 1, "ms_taken": 8000, "points": 100 } ] }

// ← Answer result
{ "type": "answer.result", "results": [ { "question_id": "…", "accepted": true, "correct": true, "points": 125, "my_score": 125 } ], "my_score": 125 }

// ← Leaderboard broadcast (to all players in the quiz)
{ "type": "leaderboard.update", "top10": [ … ], "total_participants": 42, "server_now_ms": … }

// ← Quiz state (pushed on open / start / next / end)
{ "type": "quiz.state", "quiz": { "status": "active", "current_index": 2, "total_questions": 10 }, "server_now_ms": … }

// → Keep-alive ping
{ "type": "ping" }
// ← Pong
{ "type": "pong", "server_now_ms": … }
```

**`WS /ws/admin/{quiz_id}`** — admin connection

```jsonc
// → Authenticate
{ "type": "hello", "token": "<admin JWT>" }
// ← Welcome, then receives quiz.state and leaderboard.update on every control action
```

---

## Scoring formula

```
points = 100 + round((remaining_ms / total_ms) × 50)
```

- Correct answer at t=0ms on a 20s question → **150 points** (100 base + 50 speed bonus)
- Correct answer at t=10s → **125 points**
- Correct answer at t=20s (deadline) → **100 points**
- Wrong answer → **0 points**

The same formula runs in TypeScript on the client (`quiz-socket.ts → pointsFor()`) for instant feedback, and in Python on the server (`scoring.py → server_points()`) for the authoritative leaderboard.

---

## Environment variables

| Variable | Where | Description |
|---|---|---|
| `DATABASE_URL` | backend `.env` / Render | PostgreSQL connection string |
| `AUTH_SECRET` | backend `.env` / Render secret | 32+ char JWT signing key |
| `ADMIN_PASSWORD` | backend `.env` / Render secret | Admin dashboard login |
| `CORS_ORIGINS` | backend `.env` | `*` for dev; exact frontend origin(s) for prod |
| `NEXT_PUBLIC_QUIZ_API_URL` | frontend / Vercel | Backend base URL (no trailing slash) |

---

## Tests

```bash
cd backend

# Against your Aiven database:
DATABASE_URL="postgresql://avnadmin:…@pg-….aivencloud.com:16658/defaultdb?sslmode=require" \
  uv run pytest -v

# Against a local Docker PostgreSQL:
docker run -d --name quizpg \
  -e POSTGRES_USER=quiz -e POSTGRES_PASSWORD=quiz -e POSTGRES_DB=quizlive \
  -p 5432:5432 postgres:16-alpine

DATABASE_URL=postgresql://quiz:quiz@localhost:5432/quizlive \
  uv run pytest -v

# Scoring unit tests only (no DB needed):
uv run pytest tests/test_scoring.py -v
```

The test suite covers: scoring formulas, full quiz flow (create → open → start → join → bundle → answer → leaderboard), duplicate name handling, WebSocket answer submission, admin live snapshot, and schema integrity.

---

## Scaling notes

A single Render instance holds in-memory WebSocket rooms — sufficient for a hall of tens or hundreds of players on one process. For multi-instance scale:

- Replace `RoomHub.broadcast_quiz()` with a Redis Pub/Sub or a dedicated message broker — the call sites are already centralised in `app/ws_hub.py`.
- Use a PostgreSQL connection pooler (PgBouncer) if you hit connection limits; `asyncpg` is already configured with `statement_cache_size=0` for PgBouncer transaction-mode compatibility.
