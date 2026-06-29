import { describe, expect, test } from "bun:test";
import { buildLogOrderBy, normalizeLogSortOrder } from "../../../../backend/src/modules/logs/log-sort";

describe("backend normalizeLogSortOrder", () => {
  test("only \"asc\" passes through; everything else defaults to desc", () => {
    expect(normalizeLogSortOrder("asc")).toBe("asc");
    expect(normalizeLogSortOrder("desc")).toBe("desc");
    expect(normalizeLogSortOrder("invalid")).toBe("desc");
    expect(normalizeLogSortOrder(undefined)).toBe("desc");
  });
});

describe("backend buildLogOrderBy", () => {
  const fields = { date: "timestamp", user: "username" } as const;

  test("maps a known sortBy field and appends an id desc tiebreaker", () => {
    expect(buildLogOrderBy("user", "asc", fields, "date")).toEqual([
      { username: "asc" },
      { id: "desc" },
    ]);
  });

  test("falls back to the default field when sortBy is unknown or missing", () => {
    expect(buildLogOrderBy("not-a-field", "asc", fields, "date")).toEqual([
      { timestamp: "asc" },
      { id: "desc" },
    ]);
    expect(buildLogOrderBy(undefined, "asc", fields, "user")).toEqual([
      { username: "asc" },
      { id: "desc" },
    ]);
  });

  test("defaults sortOrder to desc when omitted or invalid", () => {
    expect(buildLogOrderBy("date", undefined, fields, "date")).toEqual([
      { timestamp: "desc" },
      { id: "desc" },
    ]);
  });
});
