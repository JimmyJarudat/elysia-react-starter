import { describe, expect, test } from "bun:test";
import "../../helpers/db"; // loads DATABASE_URL/ENCRYPTION_SECRET before jwt.service imports get-setting-value -> prisma config
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verifyToken,
} from "../../../backend/src/modules/auth/jwt.service";

// getJwtConfig() reads jwt_secret/jwt_issuer/jwt_audience from the real system_config table
// (read-only — these tests never write to it) and falls back to safe defaults when unset.
describe("backend jwt.service (real DB, read-only)", () => {
  test("generateAccessToken produces a token that verifyToken can decode", async () => {
    const token = await generateAccessToken({ id: 123, roles: ["USER"] });
    const payload = await verifyToken(token);

    expect(payload.id).toBe("123");
    expect(payload.roles).toEqual(["USER"]);
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp! > payload.iat!).toBe(true);
  });

  test("generateRefreshToken produces a token that verifyRefreshToken can decode", async () => {
    const token = await generateRefreshToken(456, 789);
    const payload = await verifyRefreshToken(token);

    expect(payload.id).toBe("456");
    expect(payload.jti).toBe("789");
  });

  test("verifyToken rejects a tampered token", async () => {
    const token = await generateAccessToken({ id: 1 });

    let rejected = false;
    try {
      await verifyToken(`${token}tampered`);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });

  test("verifyToken rejects a token signed with the wrong issuer/audience", async () => {
    // jsonwebtoken lives only in backend/node_modules, so this crafts a minimal HS256 JWT
    // by hand (RFC 7519) instead of importing the package directly from this test file.
    const base64url = (input: string) =>
      Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const now = Math.floor(Date.now() / 1000);
    const body = base64url(
      JSON.stringify({ id: "1", iat: now, exp: now + 60, iss: "someone-else", aud: "someone-else-users" }),
    );
    const { createHmac } = await import("node:crypto");
    const signature = createHmac("sha256", "change-this-jwt-secret")
      .update(`${header}.${body}`)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const badToken = `${header}.${body}.${signature}`;

    let rejected = false;
    try {
      await verifyToken(badToken);
    } catch {
      rejected = true;
    }
    expect(rejected).toBe(true);
  });
});
