import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzleNeon<typeof schema>>;

// The neon-http driver only works against Neon hosts (it talks to Neon's
// HTTP API via fetch). Pointing it at any other Postgres (Aiven, Supabase
// pooler, local pg, …) fails with:
//   NeonDbError: Error connecting to database: TypeError: fetch failed
// So: use neon-http only for real Neon URLs, node-postgres otherwise.
function isNeonUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith("neon.tech") ||
      host.includes("neon.database") ||
      host.includes("neon.aws")
    );
  } catch {
    return false;
  }
}

// Production: Neon serverless HTTP driver (Vercel-friendly).
// Other Postgres providers (Aiven, …) / local dev: node-postgres.
// Set USE_LOCAL_PG=1 to force the node-postgres path even for Neon URLs.
function makeClient(): DrizzleDb {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  if (process.env.USE_LOCAL_PG === "1" || !isNeonUrl(url)) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool } = require("pg") as typeof import("pg");
    // NB: pg lets `?sslmode=` in the URL override the `ssl` option object,
    // and providers like Aiven use a self-signed chain that fails Node's
    // default verification ("self-signed certificate in certificate chain").
    // So strip sslmode from the URL and pass `ssl` explicitly.
    const wantsSsl = /[?&]sslmode=(require|verify-ca|verify-full|prefer|allow)/i.test(
      url
    );
    const cleanUrl = url
      .replace(/([?&])sslmode=[^&]*&?/i, "$1")
      .replace(/[?&]$/, "");
    const pool = new Pool({
      connectionString: cleanUrl,
      ...(wantsSsl ? { ssl: { rejectUnauthorized: false } } : {}),
      // Tuned for 50+ concurrent live event attendees
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    return drizzle(pool, {
      schema,
    }) as unknown as DrizzleDb;
  }
  return drizzleNeon(neon(url), { schema });
}

// Global connection cache across hot reloads and serverless invocations
declare global {
  var __drizzle_instance__: DrizzleDb | undefined;
}

export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    if (!globalThis.__drizzle_instance__) {
      globalThis.__drizzle_instance__ = makeClient();
    }
    const inst = globalThis.__drizzle_instance__;
    const value = Reflect.get(inst, prop, receiver);
    return typeof value === "function" ? value.bind(inst) : value;
  },
});

export * from "./schema";
