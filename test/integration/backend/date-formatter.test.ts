import { describe, expect, test } from "bun:test";
import "../../helpers/db"; // loads DATABASE_URL/ENCRYPTION_SECRET before date-formatter imports prisma/redis config
import { formatSystemDate, formatSystemDateSync } from "../../../backend/src/utils/date-formatter";

describe("backend formatSystemDateSync (pure, hard-coded defaults)", () => {
  test("formats using the DD/MM/YYYY + 24h + Asia/Bangkok defaults", () => {
    // 2024-03-15T10:30:00Z is 2024-03-15 17:30 in Asia/Bangkok (UTC+7).
    expect(formatSystemDateSync(new Date("2024-03-15T10:30:00.000Z"))).toBe("15/03/2024 17:30");
  });

  test("rolls the date over correctly across the UTC+7 offset", () => {
    // 2024-01-01T20:00:00Z is 2024-01-02 03:00 in Asia/Bangkok.
    expect(formatSystemDateSync(new Date("2024-01-01T20:00:00.000Z"))).toBe("02/01/2024 03:00");
  });

  test("defaults to the current time when no date is given", () => {
    expect(formatSystemDateSync()).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });
});

describe("backend formatSystemDate (real DB + regional settings, read-only)", () => {
  // This intentionally does not mutate the shared `timezone`/`date_format`/`time_format`/`year_era`
  // system_config rows (they are live settings, not disposable test fixtures) — just verifies the
  // DB-driven + Redis-unavailable-fallback path runs end-to-end and returns a sane value.
  test("returns a non-empty formatted string for the configured regional settings", async () => {
    const result = await formatSystemDate(new Date("2024-03-15T10:30:00.000Z"));

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("defaults to the current time when no date is given", async () => {
    const result = await formatSystemDate();

    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});
