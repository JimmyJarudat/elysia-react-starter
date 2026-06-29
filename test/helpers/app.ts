import "./db"; // loads DATABASE_URL/ENCRYPTION_SECRET before the app's module graph imports prisma/redis config
import { app } from "../../backend/src/index";

export { app };

export type CookieJar = Record<string, string>;

function applySetCookies(jar: CookieJar, response: Response) {
  const setCookies =
    typeof (response.headers as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [];

  for (const raw of setCookies) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq === -1) continue;
    jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }

  return jar;
}

function cookieHeader(jar: CookieJar) {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

/**
 * Sends a real request through the full Elysia app (middleware, route matching,
 * validation) via `app.handle()` — no network port is bound. Pass a shared `jar` object
 * across calls in a test to carry cookies (accessToken/refreshToken) between requests,
 * the way a browser would.
 */
export async function apiRequest(
  method: string,
  path: string,
  options: { body?: unknown; jar?: CookieJar; headers?: Record<string, string> } = {},
) {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.jar && Object.keys(options.jar).length > 0) headers["cookie"] = cookieHeader(options.jar);

  const response = await app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    }),
  );

  if (options.jar) applySetCookies(options.jar, response);

  const text = await response.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }

  return { status: response.status, json, text, response };
}
