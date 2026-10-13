import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "admin_session";
const PARTICIPANT_COOKIE = "participant";

function secret(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  if (s.length < 16) {
    throw new Error("AUTH_SECRET must be at least 16 characters");
  }
  return new TextEncoder().encode(s);
}

async function sign(payload: Record<string, unknown>, expires: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret());
}

async function verify<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as T;
  } catch {
    return null;
  }
}

/* ---------------- Admin ---------------- */

export async function createAdminSession(): Promise<void> {
  const token = await sign({ role: "admin" }, "12h");
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroyAdminSession(): Promise<void> {
  // Overwrite (not just delete) so the clear carries the same path/flags
  // the cookie was created with — a bare delete can miss path="/" cookies.
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const payload = await verify<{ role?: string }>(token);
  return payload?.role === "admin";
}

/* ---------------- Participant ---------------- */

export async function setParticipant(
  participantId: string,
  quizId: string
): Promise<void> {
  const token = await sign(
    { pid: participantId, qid: quizId },
    // Long enough for a quiz session; participants are scoped per quiz
    "24h"
  );
  const store = await cookies();
  store.set(PARTICIPANT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getParticipant(): Promise<{
  pid: string;
  qid: string;
} | null> {
  const store = await cookies();
  const token = store.get(PARTICIPANT_COOKIE)?.value;
  if (!token) return null;
  const payload = await verify<{ pid?: string; qid?: string }>(token);
  if (!payload?.pid || !payload?.qid) return null;
  return { pid: payload.pid, qid: payload.qid };
}

export async function clearParticipant(): Promise<void> {
  const store = await cookies();
  store.set(PARTICIPANT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
