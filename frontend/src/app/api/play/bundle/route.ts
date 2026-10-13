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

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, me.quizId))
    .limit(1);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const base = {
    serverNow: Date.now(),
    quizTitle: quiz.title,
    status: quiz.status,
    myScore: me.score,
    myName: me.name,
    myStream: me.stream,
  };

  if (quiz.status === "draft") {
    return NextResponse.json({ ...base, phase: "draft" });
  }

  if (quiz.status === "lobby") {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(participants)
      .where(eq(participants.quizId, me.quizId));
    return NextResponse.json({
      ...base,
      phase: "lobby",
      participantCount: Number(count),
    });
  }

  // Common stats for active and ended phases
  const [[{ count: better }], [{ count: totalPlayers }], questionRows, answerRows] =
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
        .from(questions)
        .where(eq(questions.quizId, me.quizId))
        .orderBy(asc(questions.position)),
      db
        .select()
        .from(answers)
        .where(eq(answers.participantId, me.id)),
    ]);

  const myRank = Number(better) + 1;
  const totalParticipants = Number(totalPlayers);
  const totalQuestions = questionRows.length;

  if (quiz.status === "ended") {
    return NextResponse.json({
      ...base,
      phase: "ended",
      totalQuestions,
      myRank,
      totalParticipants,
    });
  }

  // phase === "active"
  // Return all questions with options and time limit, plus any answers this participant has already recorded.
  const formattedQuestions = questionRows.map((q, idx) => ({
    id: q.id,
    index: idx,
    position: q.position,
    text: q.text,
    options: parseOptions(q.optionsJson),
    seconds: q.seconds,
    correctIndex: q.correctIndex,
  }));

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
    questions: formattedQuestions,
    myAnswers,
  });
}
