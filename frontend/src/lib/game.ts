
export const BASE_POINTS = 100;
export const MAX_SPEED_BONUS = 50;

export function pointsFor(
  seconds: number,
  msTaken: number
): number {
  const s = Math.max(1, Math.floor(seconds));
  if (msTaken < 0) msTaken = 0;
  const remaining = Math.max(0, s * 1000 - msTaken);
  const bonus = Math.round((remaining / (s * 1000)) * MAX_SPEED_BONUS);
  return BASE_POINTS + bonus;
}

export function questionDeadline(
  startedAtMs: number,
  seconds: number
): number {
  return startedAtMs + seconds * 1000;
}

/** 32-char hex id — matches the backend (`uuid4().hex`) and the TEXT id columns. */
export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

/** Backend ids are 32 lowercase hex chars (uuid4 hex), not UUID-with-dashes. */
export const ID_RE = /^[0-9a-f]{32}$/i;

/**
 * Lazily advances the quiz when the current question's time is up.
 * Called from any poll (player state, leaderboard, admin live view), so no
 * cron is needed on Vercel serverless. Idempotent via optimistic update:
 * only one request wins the compare-and-set on currentIndex.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function advanceQuizIfExpired(_quizId?: string): Promise<void> {
  // In self-paced Wayground mode, each participant progresses through questions
  // independently with their own per-question countdown. The quiz remains active until
  // the host concludes it or all participants complete.
  return;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars
export function generateJoinCode(): string {
  let code = "";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return code;
}

/* ---------------- Simple rate limiting ----------------
 * In-memory sliding window. Good-enough abuse protection for a single
 * event; per-lambda so not a hard global cap, but raises the bar a lot.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  // Opportunistic cleanup so the map doesn't grow forever
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t > windowMs)) buckets.delete(k);
    }
  }
  return true;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}

export function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, maxLen);
}
