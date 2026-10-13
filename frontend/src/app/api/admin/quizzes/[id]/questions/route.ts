import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, quizzes, questions, toQuestionPublic } from "@/db";
import { isAdmin } from "@/lib/auth";
import { ID_RE, newId } from "@/lib/game";

const addSchema = z.object({
  text: z.string().trim().min(1).max(500),
  options: z.array(z.string().trim().min(1).max(200)).min(2).max(4),
  correctIndex: z.number().int().min(0).max(3),
  seconds: z.union([z.literal(10), z.literal(20), z.literal(30)]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  if (parsed.data.correctIndex >= parsed.data.options.length) {
    return NextResponse.json(
      { error: "Correct answer index out of range" },
      { status: 400 }
    );
  }

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);
  if (!quiz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (quiz.status !== "draft") {
    return NextResponse.json(
      { error: "Questions can only be added before the quiz opens" },
      { status: 409 }
    );
  }

  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${questions.position}), -1)` })
    .from(questions)
    .where(eq(questions.quizId, id));

  const [question] = await db
    .insert(questions)
    .values({
      id: newId(),
      quizId: id,
      position: Number(max) + 1,
      text: parsed.data.text,
      optionsJson: JSON.stringify(parsed.data.options),
      correctIndex: parsed.data.correctIndex,
      seconds: parsed.data.seconds,
    })
    .returning();

  return NextResponse.json({ question: toQuestionPublic(question) }, { status: 201 });
}
