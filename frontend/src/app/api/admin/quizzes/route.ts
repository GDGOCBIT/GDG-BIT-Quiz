import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db, quizzes, toQuizPublic } from "@/db";
import { isAdmin } from "@/lib/auth";
import {
  generateJoinCode,
  sanitizeText,
  newId,
  ID_RE,
} from "@/lib/game";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
});

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // NOTE: drizzle renders ${...} column refs unqualified, which breaks
  // correlated subqueries (both sides become bare "id"). Qualify explicitly.
  const rows = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      status: quizzes.status,
      joinCode: quizzes.joinCode,
      createdAtMs: quizzes.createdAtMs,
      questionCount: sql<number>`(
        select count(*) from "questions"
        where "questions"."quiz_id" = "quizzes"."id"
      )`,
      participantCount: sql<number>`(
        select count(*) from "participants"
        where "participants"."quiz_id" = "quizzes"."id"
      )`,
    })
    .from(quizzes)
    .orderBy(desc(quizzes.createdAtMs));
  // count(*) arrives as bigint/string from the driver — normalize to numbers.
  return NextResponse.json({
    quizzes: rows.map((r) => ({
      ...r,
      createdAt: new Date(r.createdAtMs).toISOString(),
      questionCount: Number(r.questionCount),
      participantCount: Number(r.participantCount),
    })),
  });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  // Retry in the (unlikely) event of a join-code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    try {
      const [quiz] = await db
        .insert(quizzes)
        .values({
          id: newId(),
          joinCode,
          title: sanitizeText(parsed.data.title, 120),
          description: sanitizeText(parsed.data.description ?? "", 300),
          createdAtMs: Date.now(),
        })
        .returning();
      return NextResponse.json({ quiz: toQuizPublic(quiz) }, { status: 201 });
    } catch (e) {
      // Unique violation on join_code (Postgres 23505) — retry with a new code
      if ((e as { code?: string })?.code !== "23505") {
        throw e;
      }
    }
  }
  return NextResponse.json(
    { error: "Could not allocate a join code, try again" },
    { status: 500 }
  );
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const [quiz] = await db
    .select({ status: quizzes.status })
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Deleting mid-game would strand 40 polling players — end it first.
  if (quiz.status === "lobby" || quiz.status === "active") {
    return NextResponse.json(
      { error: "End the quiz before deleting it" },
      { status: 409 }
    );
  }
  await db.delete(quizzes).where(eq(quizzes.id, id));
  return NextResponse.json({ ok: true });
}
