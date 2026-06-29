import { describe, expect, test } from "bun:test";
import {
  generateVerificationCode,
  isValidEmail,
} from "../../../backend/src/utils/VerificationCode";

describe("backend verification helpers", () => {
  test("generates a six digit numeric code by default", () => {
    const code = generateVerificationCode();

    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);
  });

  test("generates custom length alphanumeric codes", () => {
    const code = generateVerificationCode(10);

    expect(code).toHaveLength(10);
    expect(/^[0-9A-Z]{10}$/.test(code)).toBe(true);
  });

  test("validates common email address shapes", () => {
    expect(isValidEmail("admin@example.com")).toBe(true);
    expect(isValidEmail("first.last+tag@example.co.th")).toBe(true);
    expect(isValidEmail("missing-at.example.com")).toBe(false);
    expect(isValidEmail("missing-domain@")).toBe(false);
    expect(isValidEmail("has space@example.com")).toBe(false);
  });
});
