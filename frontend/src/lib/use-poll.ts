"use client";

import { useEffect, useRef, useState } from "react";

type Fetcher<T> = () => Promise<T>;

/**
 * Simple polling hook — the backbone of live sync on Vercel serverless
 * (no WebSockets available). Keeps the last good data on transient errors.
 * Pass a `nonce` to force an immediate re-fetch.
 */
export function usePoll<T>(
  fetcher: Fetcher<T>,
  intervalMs: number,
  enabled = true,
  nonce = 0
): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const run = async () => {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Connection error");
        }
      } finally {
        if (!cancelled) timer = setTimeout(run, intervalMs);
      }
    };
    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [intervalMs, enabled, nonce]);

  return { data, error };
}

/** Fetch helper that throws on non-2xx with the server's error message. */
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof body.error === "string" ? body.error : `Request failed (${res.status})`
    );
  }
  return body as T;
}
