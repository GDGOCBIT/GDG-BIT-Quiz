import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import {
  db,
  quizzes,
  questions,
  participants,
  answers,
  parseOptions,
} from "@/db";
import { getParticipant } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Fast in-memory micro-cache to protect database when 50+ attendees query concurrently
type QuizCache = {
  expiresAt: number;
  quiz: { title: string; status: string; description: string };
  questions: Array<{
    id: string;
    index: number;
    position: number;
    text: string;
    options: string[];
    seconds: number;
    correctIndex: number;
  }>;
  totalQuestions: number;
  participantCount?: number;
};
const quizCache = new Map<string, QuizCache>();

export async function GET() {
  const session = await getParticipant();
  if (!session) {
    return NextResponse.json({ error: "Not joined" }, { status: 401 });
  }

  const [me] = await db
    .select()
    .from(participants)
    .where(eq(participants.id, session.pid))
    .limit(1);
  if (!me || me.quizId !== session.qid) {
    return NextResponse.json({ error: "Not joined" }, { status: 401 });
  }

  const now = Date.now();
  let cached = quizCache.get(me.quizId);

  // If cache expired or not present, fetch fresh quiz & question bundle
  if (!cached || now > cached.expiresAt) {
    const [freshQuiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, me.quizId))
      .limit(1);

    if (!freshQuiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    const questionRows = await db
      .select()
      .from(questions)
      .where(eq(questions.quizId, me.quizId))
      .orderBy(asc(questions.position));

    let pCount = 0;
    if (freshQuiz.status === "lobby") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(participants)
        .where(eq(participants.quizId, me.quizId));
      pCount = Number(count);
    }

    cached = {
      expiresAt: now + (freshQuiz.status === "active" ? 3000 : 1500),
      quiz: {
        title: freshQuiz.title,
        status: freshQuiz.status,
        description: freshQuiz.description,
      },
      questions: questionRows.map((q, idx) => ({
        id: q.id,
        index: idx,
        position: q.position,
        text: q.text,
        options: parseOptions(q.optionsJson),
        seconds: q.seconds,
        correctIndex: q.correctIndex,
      })),
      totalQuestions: questionRows.length,
      participantCount: pCount,
    };
    quizCache.set(me.quizId, cached);
  }

  const base = {
    serverNow: now,
    quizTitle: cached.quiz.title,
    status: cached.quiz.status,
    myScore: me.score,
    myName: me.name,
    myStream: me.stream,
  };

  if (cached.quiz.status === "draft") {
    return NextResponse.json({ ...base, phase: "draft" });
  }

  if (cached.quiz.status === "lobby") {
    return NextResponse.json({
      ...base,
      phase: "lobby",
      participantCount: cached.participantCount ?? 1,
    });
  }

  // Common stats for active and ended phases
  const [[{ count: better }], [{ count: totalPlayers }], answerRows] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(participants)
        .where(
          sql`${participants.quizId} = ${me.quizId} and ${participants.score} > ${me.score}`
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(participants)
        .where(eq(participants.quizId, me.quizId)),
      db
        .select()
        .from(answers)
        .where(eq(answers.participantId, me.id)),
    ]);

  const myRank = Number(better) + 1;
  const totalParticipants = Number(totalPlayers);
  const totalQuestions = cached.totalQuestions;

  if (cached.quiz.status === "ended") {
    return NextResponse.json({
      ...base,
      phase: "ended",
      totalQuestions,
      myRank,
      totalParticipants,
    });
  }

  // phase === "active"
  const myAnswers = answerRows.map((a) => ({
    questionId: a.questionId,
    choice: a.choice,
    isCorrect: a.isCorrect,
    points: a.points,
    msTaken: a.msTaken,
  }));

  return NextResponse.json({
    ...base,
    phase: "active",
    totalQuestions,
    myRank,
    totalParticipants,
    questions: cached.questions,
    myAnswers,
  });
}
