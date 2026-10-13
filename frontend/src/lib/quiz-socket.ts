/**
 * QuizLive new-protocol client — bulk-load once, score locally, sync over WS.
 *
 * Talk to the FastAPI backend (`backend/`) instead of the legacy Next.js
 * `/api/*` routes:
 *
 *   1. `fetchBundle(token)` — ONE fetch at quiz start, returns every question
 *      WITH `correct_index`, plus your score and the leaderboard top-10.
 *   2. Advance locally (`currentIndex` state in your component), score each
 *      answer with `pointsFor()` for instant UI.
 *   3. `connectQuizSocket(token, handlers)` streams results back
 *      (`answer.submit`) and pushes live `leaderboard.update` events to all
 *      players — no polling, no per-question GETs, no rate limits.
 *   4. `syncAnswersHttp()` is the fallback for networks that block WS upgrades.
 *
 * Set `NEXT_PUBLIC_QUIZ_API_URL` (e.g. https://quizlive-api.<you>.workers.dev).
 * When unset, same-origin is used (local dev proxy).
 */

export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;

export function pointsFor(seconds: number, msTaken: number): number {
  const s = Math.max(1, Math.floor(seconds));
  const taken = Math.max(0, msTaken);
  const remaining = Math.max(0, s * 1000 - taken);
  return BASE_POINTS + Math.round((remaining / (s * 1000)) * MAX_SPEED_BONUS);
}

export function apiBase(): string {
  return (process.env.NEXT_PUBLIC_QUIZ_API_URL ?? "").replace(/\/$/, "");
}

export async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof body.detail === "string" ? body.detail : `Request failed (${res.status})`);
  }
  return body as T;
}

export type BundleQuestion = {
  id: string;
  position: number;
  text: string;
  options: string[];
  correct_index: number;
  seconds: number;
};

export type QuizBundle = {
  server_now_ms: number;
  quiz: {
    id: string;
    title: string;
    description: string;
    status: string;
    current_index: number;
    question_started_at_ms: number | null;
  };
  me: { id: string; name: string; stream: string; score: number; rank: number };
  questions: BundleQuestion[];
  leaderboard: { top10: LeaderRow[]; total_participants: number };
};

export type LeaderRow = {
  rank: number;
  id: string;
  name: string;
  stream: string;
  score: number;
};

export const fetchBundle = (token: string) =>
  api<QuizBundle>("/api/v1/quiz/bundle", undefined, token);

export async function syncAnswersHttp(
  token: string,
  answers: { question_id: string; choice: number; ms_taken: number; points: number }[]
): Promise<{ results: unknown[]; my_score: number }> {
  return api(
    "/api/v1/quiz/sync",
    { method: "POST", body: JSON.stringify({ answers }) },
    token
  );
}

export type AnswerResult = {
  question_id: string;
  accepted: boolean;
  correct: boolean;
  points: number;
  my_score: number;
};

export type SocketHandlers = {
  onLeaderboard?: (top10: LeaderRow[], total: number, myScore?: number) => void;
  onResult?: (results: AnswerResult[], myScore: number) => void;
  onQuizState?: (state: { status: string; current_index: number; total_questions: number }) => void;
  onClose?: () => void;
};

/** Open the play socket: hello-first auth (no token in URL), JSON protocol. */
export function connectQuizSocket(token: string, handlers: SocketHandlers): WebSocket {
  const base = apiBase().replace(/^http/, "ws");
  const ws = new WebSocket(`${base}/ws/play`);
  ws.onopen = () => ws.send(JSON.stringify({ type: "hello", token }));
  ws.onmessage = (ev) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(ev.data as string) as Record<string, unknown>;
    } catch {
      return;
    }
    if (msg.type === "welcome" || msg.type === "leaderboard.update") {
      handlers.onLeaderboard?.(
        (msg.top10 ?? []) as LeaderRow[],
        (msg.total_participants ?? 0) as number,
        msg.my_score as number | undefined
      );
    } else if (msg.type === "answer.result") {
      handlers.onResult?.((msg.results ?? []) as AnswerResult[], msg.my_score as number);
    } else if (msg.type === "quiz.state") {
      handlers.onQuizState?.((msg.quiz ?? msg) as { status: string; current_index: number; total_questions: number });
    }
  };
  ws.onclose = () => handlers.onClose?.();
  return ws;
}

/** Score locally, return the payload to send over WS/HTTP. */
export function localAnswer(
  q: BundleQuestion,
  choice: number,
  startedAtMs: number
): { choice: number; isCorrect: boolean; points: number; msTaken: number } {
  const msTaken = Date.now() - startedAtMs;
  const isCorrect = choice === q.correct_index;
  return { choice, isCorrect, points: isCorrect ? pointsFor(q.seconds, msTaken) : 0, msTaken };
}
