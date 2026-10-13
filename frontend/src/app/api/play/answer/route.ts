import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  db,
  quizzes,
  questions,
  participants,
  answers,
  parseOptions,
} from "@/db";
import { getParticipant } from "@/lib/auth";
import {
  advanceQuizIfExpired,
  pointsFor,
  rateLimit,
  newId,
} from "@/lib/game";

const submitSchema = z.object({
  questionIndex: z.number().int().min(0),
  choice: z.number().int().min(0).max(3),
  // Measured by the client from when the question rendered; only used for
  // non-live questions (the live one is timed by the server clock).
  msTaken: z.number().int().min(0).max(300_000).optional(),
});

export async function POST(req: Request) {
  const session = await getParticipant();
  if (!session) {
    return NextResponse.json({ error: "Not joined" }, { status: 401 });
  }
  if (!rateLimit(`answer:${session.pid}`, 30, 60_000)) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  const [me] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, session.pid))
    .limit(1);
  if (!me || me.quizId !== session.qid) {
    return NextResponse.json({ error: "Not joined" }, { status: 401 });
  }

  await advanceQuizIfExpired(me.quizId);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, me.quizId))
    .limit(1);
  if (!quiz || quiz.status !== "active") {
    return NextResponse.json(
      { error: "The quiz is not running right now" },
      { status: 409 }
    );
  }

  const [{ count: totalQ }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.quizId, me.quizId));
  const total = Number(totalQ);
  if (parsed.data.questionIndex >= total) {
    return NextResponse.json({ error: "No such question" }, { status: 400 });
  }

  const currentRows = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, me.quizId))
    .orderBy(asc(questions.position))
    .limit(1)
    .offset(parsed.data.questionIndex);
  const current = currentRows[0];
  if (!current) {
    return NextResponse.json(
      { error: "No such question" },
      { status: 400 }
    );
  }

  const windowMs = Math.max(1, current.seconds) * 1000;
  const msTaken = Math.min(Math.max(parsed.data.msTaken ?? windowMs, 0), windowMs);
  const options = parseOptions(current.optionsJson);
  if (parsed.data.choice >= options.length) {
    return NextResponse.json({ error: "Invalid answer" }, { status: 400 });
  }

  const isCorrect = parsed.data.choice === current.correctIndex;
  const now = Date.now();
  const points = isCorrect ? pointsFor(current.seconds, msTaken) : 0;

  // Unique index makes this idempotent: the first accepted answer wins,
  // duplicates (double-tap, retries) are silently ignored.
  const inserted = await db
    .insert(answers)
    .values({
      id: newId(),
      participantId: me.id,
      questionId: current.id,
      choice: parsed.data.choice,
      isCorrect,
      points,
      msTaken,
      answeredAtMs: now,
    })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0 && isCorrect) {
    // Atomic increment — never read-modify-write from a stale snapshot.
    await db
      .update(participants)
      .set({ score: sql`${participants.score} + ${points}` })
      .where(eq(participants.id, me.id));
  }

  // A re-submission (double-tap, retry) is answered from the STORED first
  // answer — never from the new choice — so the response can't lie.
  const [stored] =
    inserted.length > 0
      ? inserted
      : await db
          .select()
          .from(answers)
          .where(
            and(
              eq(answers.participantId, me.id),
              eq(answers.questionId, current.id)
            )
          )
          .limit(1);

  const accepted = inserted.length > 0;
  const reveal = true;

  return NextResponse.json({
    ok: true,
    accepted,
    correct: stored?.isCorrect ?? isCorrect,
    points: stored?.points ?? points,
    correctIndex: reveal ? current.correctIndex : null,
    myScore: accepted && isCorrect ? me.score + points : me.score,
  });
}
