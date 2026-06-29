import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker, waitFor } from "../../../helpers/db";
import { AuditLogUtil, getChangedFields } from "../../../../backend/src/utils/audit-log";

describe("backend getChangedFields", () => {
  test("returns keys whose serialized value differs between before/after", () => {
    expect(
      getChangedFields({ name: "a", age: 10, status: "active" }, { name: "a", age: 11, status: "inactive" }),
    ).toEqual(expect.arrayContaining(["age", "status"]));
  });

  test("returns an empty array when nothing changed", () => {
    expect(getChangedFields({ name: "a" }, { name: "a" })).toEqual([]);
  });

  test("includes keys that only exist on one side", () => {
    expect(getChangedFields({ a: 1 }, { a: 1, b: 2 })).toEqual(["b"]);
  });
});

describe("backend AuditLogUtil (real DB)", () => {
  test("auto-computes changed_fields from before/after data", async () => {
    const username = uniqueMarker("audit-auto");
    const recordId = uniqueMarker("record");

    AuditLogUtil.log({
      username,
      action: "UPDATE",
      tableName: "users",
      recordId,
      beforeData: { status: "active", email: "old@example.com" },
      afterData: { status: "suspended", email: "old@example.com" },
    });

    const row = await waitFor(() => prisma.audit_logs.findFirst({ where: { username } }));

    try {
      expect(row.action).toBe("UPDATE");
      expect(row.table_name).toBe("users");
      expect(row.record_id).toBe(recordId);
      expect(row.changed_fields).toBe("status");
      expect(row.before_data).toBe('{"status":"active","email":"old@example.com"}');
      expect(row.after_data).toBe('{"status":"suspended","email":"old@example.com"}');
    } finally {
      await prisma.audit_logs.delete({ where: { id: row.id } });
    }
  });

  test("respects an explicit changedFields override", async () => {
    const username = uniqueMarker("audit-explicit");
    const recordId = uniqueMarker("record");

    AuditLogUtil.log({
      username,
      action: "CREATE",
      tableName: "roles",
      recordId,
      changedFields: ["name", "priority"],
    });

    const row = await waitFor(() => prisma.audit_logs.findFirst({ where: { username } }));

    try {
      expect(row.changed_fields).toBe("name,priority");
      expect(row.before_data).toBe(null);
      expect(row.after_data).toBe(null);
    } finally {
      await prisma.audit_logs.delete({ where: { id: row.id } });
    }
  });

  test("stores null changed_fields when there is nothing to compare", async () => {
    const username = uniqueMarker("audit-empty");
    const recordId = uniqueMarker("record");

    AuditLogUtil.log({
      username,
      action: "DELETE",
      tableName: "sessions",
      recordId,
    });

    const row = await waitFor(() => prisma.audit_logs.findFirst({ where: { username } }));

    try {
      expect(row.changed_fields).toBe(null);
    } finally {
      await prisma.audit_logs.delete({ where: { id: row.id } });
    }
  });
});
