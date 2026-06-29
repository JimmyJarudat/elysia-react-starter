import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url));

function loadBackendEnv() {
  const dotenv = backendRequire("dotenv");
  const envPath = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "backend/.env")].find((filePath) =>
    existsSync(filePath),
  );

  dotenv.config(envPath ? { path: envPath, quiet: true } : { quiet: true });
}

loadBackendEnv();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to .env or backend/.env before running DB integration tests.");
}

const { default: prisma } = await import("../../backend/src/config/prisma.config");

export default prisma;

/** Marker prefix so test rows are easy to spot and never collide with real data. */
export const TEST_MARKER = "it-unit-test";

export function uniqueMarker(label: string) {
  return `${TEST_MARKER}:${label}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

/**
 * Same idea as uniqueMarker(), but length-bounded — safe to use as a `username` value that goes
 * through Elysia's `t.String({ maxLength: 50 })` validation on /auth/login and /auth/register.
 * uniqueMarker()'s random suffix is NOT bounded (`Math.random().toString(36).slice(2)` can run to
 * 15+ chars in practice), which intermittently pushed real marker usernames over 50 chars and
 * caused 422s that silently no-op'd the request — keep `label` short (≲15 chars) for headroom.
 */
export function loginSafeMarker(label: string) {
  const random = Math.random().toString(36).slice(2, 6);
  return `${TEST_MARKER}:${label}:${Date.now().toString(36)}:${random}`;
}

/**
 * Several log utils write via a fire-and-forget `void prisma.x.create(...)`, so the
 * row may not exist yet right after the call returns. Poll until it shows up.
 */
export async function waitFor<T>(
  fn: () => Promise<T | null | undefined>,
  { timeoutMs = 3000, intervalMs = 50 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result != null) return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`waitFor: condition not met within ${timeoutMs}ms`);
}
