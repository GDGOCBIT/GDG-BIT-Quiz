import { NextResponse } from "next/server";
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
import { advanceQuizIfExpired, questionDeadline } from "@/lib/game";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
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

  await advanceQuizIfExpired(me.quizId);

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

  if (quiz.status === "draft") {
    return NextResponse.json({ ...base, phase: "draft" });
  }

  if (quiz.status === "ended") {
    // Rank = 1 + players strictly ahead (ties share a rank), same as the
    // leaderboard endpoint — no full-board fetch needed.
    const [[{ count: better }], [{ count: totalPlayers }], [{ count: totalQ }]] =
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
          .select({ count: sql<number>`count(*)` })
          .from(questions)
          .where(eq(questions.quizId, me.quizId)),
      ]);
    return NextResponse.json({
      ...base,
      phase: "ended",
      totalQuestions: Number(totalQ),
      myRank: Number(better) + 1,
      totalParticipants: Number(totalPlayers),
    });
  }

  // status === 'active': self-paced — the player views any question by
  // index (?index=N, default = the live one) and moves Next/Prev on their
  // own screen. Only the live question has a server-enforced deadline;
  // other questions are untimed (deadline: null).
  const [{ count: totalQ }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.quizId, me.quizId));
  const total = Number(totalQ);

  let index = quiz.currentIndex;
  const rawIndex = new URL(req.url).searchParams.get("index");
  if (rawIndex !== null) {
    const parsed = Number(rawIndex);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= total) {
      return NextResponse.json({ error: "No such question" }, { status: 400 });
    }
    index = parsed;
  }

  const currentRows = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, me.quizId))
    .orderBy(asc(questions.position))
    .limit(1)
    .offset(index);
  const current = currentRows[0];
  if (index >= total || !current) {
    return NextResponse.json({ ...base, phase: "active", question: null });
  }
  const isLive = index === quiz.currentIndex;
  const options = parseOptions(current.optionsJson);
  const deadline = isLive
    ? questionDeadline(
        quiz.questionStartedAtMs ?? Date.now(),
        Math.max(1, current.seconds)
      )
    : null;

  const [myAnswer] = await db
    .select()
    .from(answers)
    .where(
      and(
        eq(answers.participantId, me.id),
        eq(answers.questionId, current.id)
      )
    )
    .limit(1);

  const answered = Boolean(myAnswer);
  // Reveal the correct option once the player answered it themselves, or
  // once its global window has closed for EVERYONE (past questions, or the
  // live one after the deadline). Future unanswered questions stay hidden
  // so one player can't preview answers for the room.
  // (Your own correctness is still reported via myResult below.)
  const reveal =
    answered ||
    index < quiz.currentIndex ||
    (isLive && Date.now() >= (deadline ?? 0));

  // Personal progress for the "X of N answered" header.
  const [{ count: answeredCount }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(answers)
    .where(eq(answers.participantId, me.id));

  return NextResponse.json({
    ...base,
    phase: "active",
    answeredCount: Number(answeredCount),
    question: {
      index,
      total,
      text: current.text,
      options,
      seconds: current.seconds,
      deadline,
      isLive,
    },
    answered,
    myChoice: answered ? myAnswer.choice : null,
    myResult: answered
      ? { correct: myAnswer.isCorrect, points: myAnswer.points }
      : null,
    correctIndex: reveal ? current.correctIndex : null,
  });
}
