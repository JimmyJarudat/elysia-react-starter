import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker, waitFor } from "../../helpers/db";
import { ActivityLogUtil } from "../../../backend/src/utils/activity-log";

describe("backend ActivityLogUtil (real DB)", () => {
  test("writes an activity log row with the given fields", async () => {
    const username = uniqueMarker("activity");

    ActivityLogUtil.log({
      username,
      action: "UPDATE",
      resourceType: "users",
      resourceId: 42,
      description: "Updated profile",
      ipAddress: "203.0.113.10",
      status: "success",
      metadata: { field: "email" },
    });

    const row = await waitFor(() => prisma.activity_logs.findFirst({ where: { username } }));

    try {
      expect(row.action).toBe("UPDATE");
      expect(row.resource_type).toBe("users");
      expect(row.resource_id).toBe("42");
      expect(row.description).toBe("Updated profile");
      expect(row.ip_address).toBe("203.0.113.10");
      expect(row.status).toBe("success");
      expect(row.metadata).toBe('{"field":"email"}');
      expect(row.user_id).toBe(null);
    } finally {
      await prisma.activity_logs.delete({ where: { id: row.id } });
    }
  });

  test("defaults status to success and tolerates missing optional fields", async () => {
    const username = uniqueMarker("activity-defaults");

    ActivityLogUtil.log({
      username,
      action: "VIEW",
      resourceType: "reports",
    });

    const row = await waitFor(() => prisma.activity_logs.findFirst({ where: { username } }));

    try {
      expect(row.status).toBe("success");
      expect(row.resource_id).toBe(null);
      expect(row.description).toBe(null);
      expect(row.metadata).toBe(null);
    } finally {
      await prisma.activity_logs.delete({ where: { id: row.id } });
    }
  });
});
