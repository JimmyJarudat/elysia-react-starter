import { describe, expect, test } from "bun:test";
import { formatLocation } from "../../../../backend/src/utils/format-location";

describe("backend formatLocation", () => {
  test("returns null for empty values and preserves sentinel values", () => {
    expect(formatLocation(null)).toBe(null);
    expect(formatLocation("private network")).toBe("private network");
    expect(formatLocation("geolocation unavailable")).toBe("geolocation unavailable");
  });

  test("formats JSON location values", () => {
    expect(formatLocation('{"city":"Bangkok","country":"Thailand"}')).toBe("Bangkok, Thailand");
    expect(formatLocation('{"region":"Chiang Mai","country_code":"TH"}')).toBe("Chiang Mai, TH");
  });

  test("falls back to the original value when it cannot format", () => {
    expect(formatLocation("not-json")).toBe("not-json");
    expect(formatLocation("[1,2,3]")).toBe("[1,2,3]");
    expect(formatLocation('{"unknown":true}')).toBe('{"unknown":true}');
  });
});
