import { NextResponse } from "next/server";
import { eq, asc } from "drizzle-orm";
import { db, quizzes, questions, toQuizPublic, toQuestionPublic } from "@/db";
import { isAdmin } from "@/lib/auth";
import { ID_RE } from "@/lib/game";

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
  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);
  if (!quiz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, id))
    .orderBy(asc(questions.position));
  // Never expose correct answers in bulk responses either — only the admin
  // manage view needs them, and this IS that view, so include them here.
  return NextResponse.json({
    quiz: toQuizPublic(quiz),
    questions: qs.map(toQuestionPublic),
  });
}

export async function DELETE(
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
  const [quiz] = await db
    .select({ status: quizzes.status })
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (quiz.status === "lobby" || quiz.status === "active") {
    return NextResponse.json(
      { error: "End the quiz before deleting it" },
      { status: 409 }
    );
  }
  await db.delete(quizzes).where(eq(quizzes.id, id));
  return NextResponse.json({ ok: true });
}
