import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, participants } from "@/db";
import { getParticipant } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LeaderboardCache = {
  expiresAt: number;
  top10: Array<{
    id: string;
    name: string;
    stream: string;
    score: number;
    rank: number;
  }>;
  totalParticipants: number;
};
const leaderboardCache = new Map<string, LeaderboardCache>();

// Live top-10 for players during and after the quiz with 2s TTL micro-cache
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
  let cached = leaderboardCache.get(me.quizId);

  if (!cached || now > cached.expiresAt) {
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

    let rank = 0;
    let lastScore: number | null = null;
    const computedTop10 = board.map((p, i) => {
      if (lastScore === null || p.score !== lastScore) {
        rank = i + 1;
        lastScore = p.score;
      }
      return { ...p, rank };
    });

    cached = {
      expiresAt: now + 2000,
      top10: computedTop10,
      totalParticipants: Number(totalRows[0]?.count ?? 0),
    };
    leaderboardCache.set(me.quizId, cached);
  }

  const [{ count: betterThanMe }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(participants)
    .where(
      sql`${participants.quizId} = ${me.quizId} and ${participants.score} > ${me.score}`
    );

  const top10WithMe = cached.top10.map((p) => ({
    ...p,
    isMe: p.id === me.id,
  }));

  return NextResponse.json({
    serverNow: now,
    top10: top10WithMe,
    totalParticipants: cached.totalParticipants,
    myRank: Number(betterThanMe) + 1,
    myScore: me.score,
  });
}
