import { describe, expect, test } from "bun:test";
import {
  getRequestLanguage,
  normalizeBackendLanguage,
  translateBackendMessage,
} from "../../../backend/src/utils/response-language";

describe("backend normalizeBackendLanguage", () => {
  test("recognizes TH case-insensitively and trims whitespace", () => {
    expect(normalizeBackendLanguage("TH")).toBe("TH");
    expect(normalizeBackendLanguage("th")).toBe("TH");
    expect(normalizeBackendLanguage(" th ")).toBe("TH");
  });

  test("defaults to EN for anything else", () => {
    expect(normalizeBackendLanguage("EN")).toBe("EN");
    expect(normalizeBackendLanguage("fr")).toBe("EN");
    expect(normalizeBackendLanguage(null)).toBe("EN");
    expect(normalizeBackendLanguage(undefined)).toBe("EN");
    expect(normalizeBackendLanguage("")).toBe("EN");
  });
});

describe("backend translateBackendMessage", () => {
  test("translates known EN messages to TH", () => {
    expect(translateBackendMessage("Unauthorized", "TH")).toBe("ไม่ได้รับอนุญาต");
    expect(translateBackendMessage("User not found", "TH")).toBe("ไม่พบผู้ใช้");
  });

  test("translates known TH messages back to EN", () => {
    expect(translateBackendMessage("ไม่ได้รับอนุญาต", "EN")).toBe("Unauthorized");
  });

  test("returns the original message unchanged when there is no match", () => {
    expect(translateBackendMessage("Some unmapped message", "TH")).toBe("Some unmapped message");
  });

  test("defaults to EN target when language is omitted", () => {
    expect(translateBackendMessage("ไม่ได้รับอนุญาต")).toBe("Unauthorized");
  });

  test("applies dynamic EN -> TH rules with captured values", () => {
    expect(translateBackendMessage("Username already exists", "TH")).toBe(
      "Username ถูกใช้งานแล้ว",
    );
    expect(
      translateBackendMessage("Account temporarily suspended. Please try again in 5 minutes", "TH"),
    ).toBe("บัญชีถูกระงับชั่วคราว กรุณาลองใหม่ใน 5 นาที");
    expect(translateBackendMessage('Role "Admin" not found', "TH")).toBe('ไม่พบ role "Admin"');
  });

  test("applies dynamic TH -> EN rules with captured values", () => {
    expect(
      translateBackendMessage("ไม่สามารถใช้รหัสผ่านซ้ำกับ 5 รหัสล่าสุดได้", "EN"),
    ).toBe("Cannot reuse any of your last 5 passwords");
    expect(translateBackendMessage("รหัสไม่ถูกต้อง เหลืออีก 2 ครั้ง", "EN")).toBe(
      "Invalid code. 2 attempt(s) remaining",
    );
  });

  test("does not apply a dynamic rule meant for the opposite language", () => {
    // This pattern is only registered for from: "TH" -> target TH; asking for EN should not match it.
    expect(translateBackendMessage("Username already exists", "EN")).toBe(
      "Username already exists",
    );
  });
});

describe("backend getRequestLanguage", () => {
  test("reads the language from the x-user-data header", () => {
    const request = new Request("http://localhost", {
      headers: { "x-user-data": JSON.stringify({ language: "TH" }) },
    });

    expect(getRequestLanguage(request)).toBe("TH");
  });

  test("defaults to EN when there is no user header", () => {
    const request = new Request("http://localhost");

    expect(getRequestLanguage(request)).toBe("EN");
  });

  test("defaults to EN when the header is malformed", () => {
    const request = new Request("http://localhost", {
      headers: { "x-user-data": "not-json" },
    });

    expect(getRequestLanguage(request)).toBe("EN");
  });
});
