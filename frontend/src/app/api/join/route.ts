import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, quizzes, participants } from "@/db";
import { setParticipant, getParticipant, clearParticipant } from "@/lib/auth";
import { rateLimit, clientIp, sanitizeText, newId } from "@/lib/game";

const joinSchema = z.object({
  code: z.string().trim().min(4).max(10),
  name: z.string().trim().min(1).max(40),
  stream: z.string().trim().min(1).max(40),
});

export async function POST(req: Request) {
  // Basic anti-spam: 10 joins per IP per minute
  if (!rateLimit(`join:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts. Wait a moment." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your name and stream" }, { status: 400 });
  }

  const code = parsed.data.code.toUpperCase();
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.joinCode, code))
    .limit(1);
  if (!quiz) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }
  if (quiz.status === "ended") {
    return NextResponse.json({ error: "This quiz has ended" }, { status: 409 });
  }
  if (quiz.status === "draft") {
    return NextResponse.json(
      { error: "This quiz isn't open yet" },
      { status: 409 }
    );
  }

  // Already joined this quiz on this device? Just resume their session.
  const existing = await getParticipant();
  if (existing && existing.qid === quiz.id) {
    const [p] = await db
      .select()
      .from(participants)
      .where(eq(participants.id, existing.pid))
      .limit(1);
    if (p) {
      return NextResponse.json({ ok: true, resumed: true });
    }
  }
  await clearParticipant();

  const name = sanitizeText(parsed.data.name, 40);
  const stream = sanitizeText(parsed.data.stream, 40);

  // Avoid duplicate live names per quiz: append a suffix if taken
  const [{ count: dupes }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(participants)
    .where(
      sql`${participants.quizId} = ${quiz.id} and ${participants.name} ilike ${name}`
    );

  const displayName = Number(dupes) > 0 ? `${name} (${Number(dupes) + 1})` : name;

  const [participant] = await db
    .insert(participants)
    .values({
      id: newId(),
      quizId: quiz.id,
      name: displayName,
      stream,
      createdAtMs: Date.now(),
    })
    .returning();

  await setParticipant(participant.id, quiz.id);
  return NextResponse.json({ ok: true }, { status: 201 });
}
