import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, participants } from "@/db";
import { getParticipant } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Live top-10 for players during and after the quiz.
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

  const [board, totalRows] = await Promise.all([
    db
      .select({
        id: participants.id,
        name: participants.name,
        stream: participants.stream,
        score: participants.score,
      })
      .from(participants)
      .where(eq(participants.quizId, me.quizId))
      .orderBy(sql`${participants.score} desc, ${participants.createdAtMs} asc`)
      .limit(10),
    db
      .select({ count: sql<number>`count(*)` })
      .from(participants)
      .where(eq(participants.quizId, me.quizId)),
  ]);

  const [{ count: betterThanMe }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(participants)
    .where(
      sql`${participants.quizId} = ${me.quizId} and ${participants.score} > ${me.score}`
    );

  // Competition ranking: tied scores share a rank (1, 2, 2, 4…), matching
  // myRank below and the ended-phase rank in /api/play.
  let rank = 0;
  let lastScore: number | null = null;
  const top10 = board.map((p, i) => {
    if (lastScore === null || p.score !== lastScore) {
      rank = i + 1;
      lastScore = p.score;
    }
    return { ...p, rank, isMe: p.id === me.id };
  });

  return NextResponse.json({
    serverNow: Date.now(),
    top10,
    totalParticipants: Number(totalRows[0]?.count ?? 0),
    myRank: Number(betterThanMe) + 1,
    myScore: me.score,
  });
}
