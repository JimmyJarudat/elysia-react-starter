import { describe, expect, test } from "bun:test";
import { enUS } from "date-fns/locale";
import {
  formatThaiDate,
  formatThaiDateTime,
  formatTimeDistance,
  getUserTimezone,
  setUserTimezone,
} from "../../../frontend/src/utils/dateUtils";

describe("frontend date utils", () => {
  test("stores and returns the selected user timezone", () => {
    const original = getUserTimezone();

    setUserTimezone("Asia/Bangkok");
    expect(getUserTimezone()).toBe("Asia/Bangkok");

    setUserTimezone(original);
  });

  test("formats date time in Thai Buddhist year", () => {
    expect(formatThaiDateTime("2026-06-29T08:05:00")).toBe("29/06/2569 08:05");
    expect(formatThaiDateTime(null)).toBe("-");
  });

  test("formats Thai dates and date ranges", () => {
    expect(formatThaiDate("2026-06-29", "dd/MM/yyyy", { timezone: "UTC" })).toBe("29/06/2569");
    expect(formatThaiDate("2026-06-01_2026-06-03", "dd/MM/yyyy", { timezone: "UTC" })).toBe(
      "01/06/2569 ถึง 03/06/2569",
    );
  });

  test("formats distance with fallback for empty values", () => {
    expect(formatTimeDistance(null)).toBe("-");
    expect(formatTimeDistance("2026-06-29T00:00:00Z", "2026-06-30T00:00:00Z", {
      addSuffix: false,
      locale: enUS,
    })).toContain("day");
  });
});
