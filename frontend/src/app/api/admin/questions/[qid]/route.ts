import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, questions, quizzes } from "@/db";
import { isAdmin } from "@/lib/auth";
import { ID_RE } from "@/lib/game";

async function liveQuizId(qid: string): Promise<string | null> {
  const [q] = await db
    .select({ quizId: questions.quizId })
    .from(questions)
    .where(eq(questions.id, qid))
    .limit(1);
  return q?.quizId ?? null;
}

async function requireDraft(quizId: string): Promise<boolean> {
  const [quiz] = await db
    .select({ status: quizzes.status })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  return quiz?.status === "draft";
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ qid: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { qid } = await params;
  if (!ID_RE.test(qid)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const quizId = await liveQuizId(qid);
  if (!quizId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Deleting mid-game would shift positions under a live currentIndex.
  if (!(await requireDraft(quizId))) {
    return NextResponse.json(
      { error: "Questions are locked once the quiz opens" },
      { status: 409 }
    );
  }
  await db.delete(questions).where(eq(questions.id, qid));
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ qid: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { qid } = await params;
  if (!ID_RE.test(qid)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as {
    move?: "up" | "down";
  } | null;
  if (body?.move !== "up" && body?.move !== "down") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [q] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, qid))
    .limit(1);
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await requireDraft(q.quizId))) {
    return NextResponse.json(
      { error: "Questions are locked once the quiz opens" },
      { status: 409 }
    );
  }

  const siblings = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, q.quizId));
  siblings.sort((a, b) => a.position - b.position);
  const idx = siblings.findIndex((s) => s.id === qid);
  const swapWith = body.move === "up" ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= siblings.length) {
    return NextResponse.json({ ok: true }); // nothing to do
  }

  const a = siblings[idx];
  const b = siblings[swapWith];
  // Swap via a temp position inside a transaction: Postgres checks the
  // UNIQUE(quiz_id, position) constraint per row, so a single-statement
  // CASE swap ("a→b, b→a") trips a duplicate-key error midway.
  await db.transaction(async (tx) => {
    await tx
      .update(questions)
      .set({ position: -1 })
      .where(eq(questions.id, a.id));
    await tx
      .update(questions)
      .set({ position: a.position })
      .where(eq(questions.id, b.id));
    await tx
      .update(questions)
      .set({ position: b.position })
      .where(eq(questions.id, a.id));
  });

  return NextResponse.json({ ok: true });
}
