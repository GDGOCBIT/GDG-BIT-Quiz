import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db, quizzes, participants } from "@/db";
import { rateLimit, clientIp } from "@/lib/game";

export const dynamic = "force-dynamic";

const CODE_RE = /^[A-Z0-9]{4,10}$/i;

// Public info for the join page (title, whether joinable) — no auth needed.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  if (!rateLimit(`quizinfo:${clientIp(req)}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a moment." },
      { status: 429 }
    );
  }
  const { code } = await params;
  if (!CODE_RE.test(code.trim())) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }
  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      status: quizzes.status,
    })
    .from(quizzes)
    .where(eq(quizzes.joinCode, code.toUpperCase()))
    .limit(1);

  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(participants)
    .where(eq(participants.quizId, quiz.id));

  return NextResponse.json({
    quiz: {
      title: quiz.title,
      description: quiz.description,
      status: quiz.status,
    },
    participantCount: Number(count),
  });
}
