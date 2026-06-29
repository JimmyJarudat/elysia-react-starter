import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker, waitFor } from "../../helpers/db";
import { ErrorLogUtil } from "../../../backend/src/utils/error-log";

describe("backend ErrorLogUtil (real DB)", () => {
  test("logs an Error instance with its message, stack, and level", async () => {
    const username = uniqueMarker("error-log");
    const error = new Error("boom");

    ErrorLogUtil.log(error, { username, source: "unit-test", code: "E_BOOM" });

    const row = await waitFor(() => prisma.error_logs.findFirst({ where: { username } }));

    try {
      expect(row.level).toBe("error");
      expect(row.message).toBe("boom");
      expect(row.stack_trace).toContain("Error: boom");
      expect(row.source).toBe("unit-test");
      expect(row.code).toBe("E_BOOM");
      expect(row.resolved).toBe(false);
    } finally {
      await prisma.error_logs.delete({ where: { id: row.id } });
    }
  });

  test("logs a plain string error without a stack trace", async () => {
    const username = uniqueMarker("error-log-string");

    ErrorLogUtil.log("Something went wrong", { username });

    const row = await waitFor(() => prisma.error_logs.findFirst({ where: { username } }));

    try {
      expect(row.message).toBe("Something went wrong");
      expect(row.stack_trace).toBe(null);
    } finally {
      await prisma.error_logs.delete({ where: { id: row.id } });
    }
  });

  test("falls back to a generic message for an unrecognized error shape", async () => {
    const username = uniqueMarker("error-log-unknown");

    ErrorLogUtil.log(12345, { username });

    const row = await waitFor(() => prisma.error_logs.findFirst({ where: { username } }));

    try {
      expect(row.message).toBe("Unknown error");
    } finally {
      await prisma.error_logs.delete({ where: { id: row.id } });
    }
  });

  test("warn() logs at the warn level", async () => {
    const username = uniqueMarker("error-log-warn");

    ErrorLogUtil.warn("Heads up", { username });

    const row = await waitFor(() => prisma.error_logs.findFirst({ where: { username } }));

    try {
      expect(row.level).toBe("warn");
      expect(row.message).toBe("Heads up");
    } finally {
      await prisma.error_logs.delete({ where: { id: row.id } });
    }
  });
});
