-- QuizLive · PostgreSQL schema
-- Single source of truth — idempotent, run on every deploy.
-- Apply:  psql $DATABASE_URL -f schema.sql
--
-- IDs  → TEXT (UUID4 hex, no SERIAL, collision-safe)
-- Times → BIGINT unix-milliseconds (simple, timezone-free, portable)
-- JSON  → TEXT (options stored as JSON string; no JSONB to stay SQL-portable)

CREATE TABLE IF NOT EXISTS quizzes (
  id                     TEXT    PRIMARY KEY,
  join_code              TEXT    NOT NULL UNIQUE,
  title                  TEXT    NOT NULL,
  description            TEXT    NOT NULL DEFAULT '',
  status                 TEXT    NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft','lobby','active','ended')),
  current_index          INTEGER NOT NULL DEFAULT 0,
  question_started_at_ms BIGINT,
  created_at_ms          BIGINT  NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id            TEXT    PRIMARY KEY,
  quiz_id       TEXT    NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  text          TEXT    NOT NULL,
  options_json  TEXT    NOT NULL,  -- JSON array: ["opt1","opt2",...]
  correct_index INTEGER NOT NULL,
  seconds       INTEGER NOT NULL DEFAULT 20
                        CHECK (seconds IN (10,20,30)),
  UNIQUE (quiz_id, position)
);
CREATE INDEX IF NOT EXISTS questions_quiz_idx ON questions(quiz_id, position);

CREATE TABLE IF NOT EXISTS participants (
  id            TEXT    PRIMARY KEY,
  quiz_id       TEXT    NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  stream        TEXT    NOT NULL,
  score         INTEGER NOT NULL DEFAULT 0,
  created_at_ms BIGINT  NOT NULL
);
CREATE INDEX IF NOT EXISTS participants_quiz_idx ON participants(quiz_id);

CREATE TABLE IF NOT EXISTS answers (
  id             TEXT    PRIMARY KEY,
  participant_id TEXT    NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  question_id    TEXT    NOT NULL REFERENCES questions(id)  ON DELETE CASCADE,
  choice         INTEGER NOT NULL,
  is_correct     BOOLEAN NOT NULL DEFAULT FALSE,
  points         INTEGER NOT NULL DEFAULT 0,
  ms_taken       INTEGER NOT NULL DEFAULT 0,
  answered_at_ms BIGINT  NOT NULL,
  UNIQUE (participant_id, question_id)
);
CREATE INDEX IF NOT EXISTS answers_question_idx    ON answers(question_id);
CREATE INDEX IF NOT EXISTS answers_participant_idx ON answers(participant_id);
