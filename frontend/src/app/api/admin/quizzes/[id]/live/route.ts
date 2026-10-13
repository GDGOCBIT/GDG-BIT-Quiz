import { NextResponse } from "next/server";
import { asc, desc, eq, sql } from "drizzle-orm";
import {
  db,
  quizzes,
  questions,
  participants,
  answers,
  toQuizPublic,
  parseOptions,
} from "@/db";
import { isAdmin } from "@/lib/auth";
import {
  advanceQuizIfExpired,
  questionDeadline,
  ID_RE,
} from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await advanceQuizIfExpired(id);

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, id))
    .orderBy(asc(questions.position));

  const board = await db
    .select({
      id: participants.id,
      name: participants.name,
      stream: participants.stream,
      score: participants.score,
    })
    .from(participants)
    .where(eq(participants.quizId, id))
    .orderBy(desc(participants.score), asc(participants.createdAtMs));

  // Per-question answer stats (only for questions already shown)
  let stats: {
    questionId: string;
    total: number;
    correct: number;
  }[] = [];
  if (qs.length > 0) {
    stats = await db
      .select({
        questionId: answers.questionId,
        total: sql<number>`count(*)`,
        correct: sql<number>`count(*) filter (where ${answers.isCorrect})`,
      })
      .from(answers)
      .innerJoin(
        participants,
        eq(participants.id, answers.participantId)
      )
      .where(eq(participants.quizId, id))
      .groupBy(answers.questionId);
  }

  // answeredCount per current question for the live "x of y answered" meter
  let answeredCurrent = 0;
  const current =
    quiz.status === "active" && quiz.currentIndex < qs.length
      ? qs[quiz.currentIndex]
      : null;
  if (current) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(answers)
      .where(eq(answers.questionId, current.id));
    answeredCurrent = Number(count);
  }

  const options = current ? parseOptions(current.optionsJson) : [];
  return NextResponse.json({
    quiz: toQuizPublic(quiz),
    serverNow: Date.now(),
    totalQuestions: qs.length,
    participantCount: board.length,
    current: current
      ? {
          index: quiz.currentIndex,
          text: current.text,
          options,
          seconds: current.seconds,
          deadline: questionDeadline(
            quiz.questionStartedAtMs ?? Date.now(),
            current.seconds
          ),
          answered: answeredCurrent,
          correctIndex: current.correctIndex, // admin-only endpoint
        }
      : null,
    leaderboard: board.map((p, i) => ({ rank: i + 1, ...p })),
    stats: stats.map((s) => ({
      questionId: s.questionId,
      total: Number(s.total),
      correct: Number(s.correct),
    })),
  });
}
