import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { db, quizzes, questions, toQuizPublic } from "@/db";
import { isAdmin } from "@/lib/auth";
import { ID_RE } from "@/lib/game";

// Server-side backstop against double-clicks skipping questions (the admin
// UI also disables the button while a control request is in flight).
const lastNextAt = new Map<string, number>();

const controlSchema = z.object({
  action: z.union([
    z.literal("open"), // draft -> lobby (players can join)
    z.literal("start"), // lobby -> active, question 0 revealed
    z.literal("next"), // advance to next question (or end)
    z.literal("end"), // force end
  ]),
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

  const body = (await req.json().catch(() => null)) as unknown;
  const parsed = controlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const [quiz] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);
  if (!quiz) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const qs = await db
    .select()
    .from(questions)
    .where(eq(questions.quizId, id))
    .orderBy(asc(questions.position));

  switch (parsed.data.action) {
    case "open": {
      if (quiz.status !== "draft") {
        return NextResponse.json(
          { error: "Quiz already opened" },
          { status: 409 }
        );
      }
      if (qs.length === 0) {
        return NextResponse.json(
          { error: "Add at least one question first" },
          { status: 409 }
        );
      }
      await db
        .update(quizzes)
        .set({ status: "lobby" })
        .where(eq(quizzes.id, id));
      break;
    }
    case "start": {
      if (quiz.status !== "lobby" && quiz.status !== "draft") {
        return NextResponse.json(
          { error: "Quiz already started" },
          { status: 409 }
        );
      }
      if (qs.length === 0) {
        return NextResponse.json(
          { error: "Add at least one question first" },
          { status: 409 }
        );
      }
      await db
        .update(quizzes)
        .set({
          status: "active",
          currentIndex: 0,
          questionStartedAtMs: Date.now(),
        })
        .where(eq(quizzes.id, id));
      break;
    }
    case "next": {
      if (quiz.status !== "active") {
        return NextResponse.json(
          { error: "Quiz is not running" },
          { status: 409 }
        );
      }
      const now = Date.now();
      if (now - (lastNextAt.get(id) ?? 0) < 2000) {
        return NextResponse.json(
          { error: "Slow down — question already advancing" },
          { status: 429 }
        );
      }
      lastNextAt.set(id, now);
      const next = quiz.currentIndex + 1;
      if (next >= qs.length) {
        await db
          .update(quizzes)
          .set({ status: "ended" })
          .where(eq(quizzes.id, id));
      } else {
        await db
          .update(quizzes)
          .set({ currentIndex: next, questionStartedAtMs: Date.now() })
          .where(eq(quizzes.id, id));
      }
      break;
    }
    case "end": {
      if (quiz.status !== "lobby" && quiz.status !== "active") {
        return NextResponse.json(
          { error: "Quiz is not running" },
          { status: 409 }
        );
      }
      await db
        .update(quizzes)
        .set({ status: "ended" })
        .where(eq(quizzes.id, id));
      break;
    }
  }

  const [updated] = await db
    .select()
    .from(quizzes)
    .where(eq(quizzes.id, id))
    .limit(1);
  return NextResponse.json({ quiz: updated ? toQuizPublic(updated) : null });
}
