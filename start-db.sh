#!/usr/bin/env bash
# QuizLive local Postgres — starts the user-level PostgreSQL 16 instance
# (binaries under ~/.local/share/quizlive-pg, data under ~/.local/share/quizlive-pg/data).
# No Docker or sudo required. Safe to run multiple times.
#
#   ./start-db.sh
#
set -euo pipefail

PGBIN="$HOME/.local/share/quizlive-pg/pgserver/pginstall/bin"
PGDATA="$HOME/.local/share/quizlive-pg/data"
PGHOST="127.0.0.1"
PGPORT="${PG_PORT:-5432}"

if [ ! -x "$PGBIN/pg_ctl" ]; then
  echo "[db] Postgres binaries not found at $PGBIN" >&2
  echo "[db] They are installed on first setup; see README for details." >&2
  exit 1
fi

if "$PGBIN/pg_isready" -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  echo "[db] already running on $PGHOST:$PGPORT"
  exit 0
fi

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "[db] initialising data directory at $PGDATA…"
  "$PGBIN/initdb" -D "$PGDATA" --auth=trust --encoding=utf8 -U postgres >/dev/null
fi

echo "[db] starting Postgres on $PGHOST:$PGPORT…"
"$PGBIN/pg_ctl" -D "$PGDATA" -l "$PGDATA/logfile" -o "-h $PGHOST -p $PGPORT" -w start
"$PGBIN/psql" -h "$PGHOST" -p "$PGPORT" -U postgres -tc \
  "SELECT 1 FROM pg_database WHERE datname='quizlive'" | grep -q 1 \
  || "$PGBIN/psql" -h "$PGHOST" -p "$PGPORT" -U postgres -c "CREATE DATABASE quizlive."
echo "[db] ready → postgresql://postgres@$PGHOST:$PGPORT/quizlive"
