import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker, waitFor } from "../../../helpers/db";
import { AuthHistoryUtil } from "../../../../backend/src/utils/auth-history";

describe("backend AuthHistoryUtil (real DB)", () => {
  test("writes a login attempt with defaults applied", async () => {
    const username = uniqueMarker("auth-history-login");

    AuthHistoryUtil.log({
      username,
      auth_type: "LOGIN",
      auth_status: "SUCCESS",
      ip_address: "203.0.113.10",
    });

    const row = await waitFor(() => prisma.auth_history.findFirst({ where: { username } }));

    try {
      expect(row.auth_type).toBe("LOGIN");
      expect(row.auth_status).toBe("SUCCESS");
      expect(row.auth_source).toBe("WEB");
      expect(row.two_factor_used).toBe(false);
      expect(row.remember_me).toBe(false);
      expect(row.ip_address).toBe("203.0.113.10");
    } finally {
      await prisma.auth_history.delete({ where: { id: row.id } });
    }
  });

  test("serializes additional_data as JSON and records a failure reason", async () => {
    const username = uniqueMarker("auth-history-failed");

    AuthHistoryUtil.log({
      username,
      auth_type: "LOGIN",
      auth_status: "FAILED",
      failure_reason: "Invalid password",
      two_factor_used: true,
      remember_me: true,
      additional_data: { attempt: 3 },
    });

    const row = await waitFor(() => prisma.auth_history.findFirst({ where: { username } }));

    try {
      expect(row.auth_status).toBe("FAILED");
      expect(row.failure_reason).toBe("Invalid password");
      expect(row.two_factor_used).toBe(true);
      expect(row.remember_me).toBe(true);
      expect(row.additional_data).toBe('{"attempt":3}');
    } finally {
      await prisma.auth_history.delete({ where: { id: row.id } });
    }
  });
});
