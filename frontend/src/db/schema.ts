import {
  pgTable,
  text,
  integer,
  bigint,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/**
 * Drizzle schema — mirrors `backend/schema.sql` EXACTLY. That file is the
 * single source of truth: the FastAPI backend applies it on startup, so
 * these tables already exist with these shapes:
 *
 *   * ids are TEXT (uuid4 hex, 32 chars — NOT uuid columns)
 *   * times are BIGINT unix-milliseconds (NOT timestamptz)
 *   * question options are TEXT holding a JSON array (NOT jsonb)
 *
 * The routes translate rows into the camelCase JSON the UI expects
 * (see the `toX` mappers below), so component code is unaffected.
 */

export const quizzes = pgTable(
  "quizzes",
  {
    id: text("id").primaryKey(),
    // Short human-friendly code used in the join link (e.g. /join/AB12CD)
    joinCode: text("join_code").notNull(),
    title: text("title").notNull(),
    description: text("description").default("").notNull(),
    // 'draft' -> 'lobby' -> 'active' -> 'ended'
    status: text("status").default("draft").notNull(),
    // Index of the question currently being played (only when status='active')
    currentIndex: integer("current_index").default(0).notNull(),
    // Server time the current question was revealed (unix-ms, nullable)
    questionStartedAtMs: bigint("question_started_at_ms", { mode: "number" }),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("quizzes_join_code_idx").on(t.joinCode)]
);

export const questions = pgTable(
  "questions",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    // JSON array stored as TEXT, e.g. '["opt1","opt2"]'
    optionsJson: text("options_json").notNull(),
    correctIndex: integer("correct_index").notNull(),
    // Per-question timer: 10, 20 or 30 seconds
    seconds: integer("seconds").default(20).notNull(),
  },
  (t) => [index("questions_quiz_idx").on(t.quizId, t.position)]
);

export const participants = pgTable(
  "participants",
  {
    id: text("id").primaryKey(),
    quizId: text("quiz_id")
      .notNull()
      .references(() => quizzes.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    stream: text("stream").notNull(),
    score: integer("score").default(0).notNull(),
    createdAtMs: bigint("created_at_ms", { mode: "number" }).notNull(),
  },
  (t) => [index("participants_quiz_idx").on(t.quizId)]
);

export const answers = pgTable(
  "answers",
  {
    id: text("id").primaryKey(),
    participantId: text("participant_id")
      .notNull()
      .references(() => participants.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    choice: integer("choice").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    // Points awarded (speed bonus baked in) — stored so the score is auditable
    points: integer("points").default(0).notNull(),
    msTaken: integer("ms_taken").default(0).notNull(),
    answeredAtMs: bigint("answered_at_ms", { mode: "number" }).notNull(),
  },
  (t) => [
    // One answer per participant per question — enforced by the DB, not just app logic
    uniqueIndex("answers_participant_question_idx").on(
      t.participantId,
      t.questionId
    ),
    // Admin live view filters by question alone ("x of y answered")
    index("answers_question_idx").on(t.questionId),
  ]
);

/* ---------------- Row → UI JSON mappers ---------------- */

export type QuizRow = typeof quizzes.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;

export function parseOptions(optionsJson: string): string[] {
  try {
    const v: unknown = JSON.parse(optionsJson);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

export function toQuizPublic(q: QuizRow) {
  return {
    id: q.id,
    joinCode: q.joinCode,
    title: q.title,
    description: q.description,
    status: q.status,
    currentIndex: q.currentIndex,
    questionStartedAtMs: q.questionStartedAtMs,
    createdAtMs: q.createdAtMs,
    // ISO string for legacy consumers that typed createdAt as a string
    createdAt: new Date(q.createdAtMs).toISOString(),
  };
}

export function toQuestionPublic(q: QuestionRow) {
  return {
    id: q.id,
    position: q.position,
    text: q.text,
    options: parseOptions(q.optionsJson),
    correctIndex: q.correctIndex,
    seconds: q.seconds,
  };
}
