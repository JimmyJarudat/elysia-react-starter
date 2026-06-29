import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker, waitFor } from "../../../helpers/db";
import { SystemEventUtil } from "../../../../backend/src/utils/system-event";

describe("backend SystemEventUtil (real DB)", () => {
  test("log() writes the full event shape", async () => {
    const eventName = uniqueMarker("event-log");

    SystemEventUtil.log({
      eventType: "CRON",
      eventName,
      status: "running",
      durationMs: 120,
      message: "Started",
      details: { jobId: 7 },
      triggeredBy: "cron",
    });

    const row = await waitFor(() => prisma.system_events.findFirst({ where: { event_name: eventName } }));

    try {
      expect(row.event_type).toBe("CRON");
      expect(row.status).toBe("running");
      expect(row.duration_ms).toBe(120);
      expect(row.message).toBe("Started");
      expect(row.details).toBe('{"jobId":7}');
      expect(row.triggered_by).toBe("cron");
    } finally {
      await prisma.system_events.delete({ where: { id: row.id } });
    }
  });

  test("success() defaults status to success and triggered_by to system", async () => {
    const eventName = uniqueMarker("event-success");

    SystemEventUtil.success("BACKUP", eventName, 500, { files: 3 });

    const row = await waitFor(() => prisma.system_events.findFirst({ where: { event_name: eventName } }));

    try {
      expect(row.status).toBe("success");
      expect(row.duration_ms).toBe(500);
      expect(row.triggered_by).toBe("system");
      expect(row.details).toBe('{"files":3}');
    } finally {
      await prisma.system_events.delete({ where: { id: row.id } });
    }
  });

  test("failed() sets status to failed with the given message", async () => {
    const eventName = uniqueMarker("event-failed");

    SystemEventUtil.failed("SMTP", eventName, "Connection refused");

    const row = await waitFor(() => prisma.system_events.findFirst({ where: { event_name: eventName } }));

    try {
      expect(row.status).toBe("failed");
      expect(row.message).toBe("Connection refused");
      expect(row.duration_ms).toBe(null);
    } finally {
      await prisma.system_events.delete({ where: { id: row.id } });
    }
  });
});
