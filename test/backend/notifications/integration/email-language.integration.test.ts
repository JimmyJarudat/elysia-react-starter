import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../../helpers/db";
import {
  getEmailRecipientLanguage,
  localizeMailOptions,
} from "../../../../backend/src/utils/email-language";

// extractEmail()'s regex disallows ":" in the local part (correctly, per RFC 5321), so the raw
// uniqueMarker() (which contains ":") can't be used as an email local part directly.
function uniqueEmail(label: string) {
  return `${uniqueMarker(label).replace(/:/g, ".")}@example.invalid`;
}

describe("backend getEmailRecipientLanguage (real DB)", () => {
  test("returns EN when the recipient has no extractable email", async () => {
    expect(await getEmailRecipientLanguage(undefined)).toBe("EN");
    expect(await getEmailRecipientLanguage("not-an-email")).toBe("EN");
  });

  test("returns EN for a well-formed email that has no matching user", async () => {
    expect(await getEmailRecipientLanguage(uniqueEmail("no-such-user"))).toBe("EN");
  });

  test("resolves the primary recipient from a string, array, or address object", async () => {
    const email = uniqueEmail("multi-shape");

    expect(await getEmailRecipientLanguage(`${email}; second@example.invalid`)).toBe("EN");
    expect(await getEmailRecipientLanguage([{ address: email, name: "Test" }])).toBe("EN");
    expect(await getEmailRecipientLanguage({ address: email, name: "Test" })).toBe("EN");
  });

  test("returns the recipient's stored language when a matching user exists", async () => {
    const email = uniqueEmail("lang-th-user");
    const user = await prisma.users.create({
      data: { username: uniqueMarker("lang-th-user"), email, password: "unused", language: "TH" },
    });

    try {
      expect(await getEmailRecipientLanguage(user.email)).toBe("TH");
      // Lookup is case-insensitive on the email.
      expect(await getEmailRecipientLanguage(user.email.toUpperCase())).toBe("TH");
    } finally {
      await prisma.users.delete({ where: { id: user.id } });
    }
  });

  test("ignores soft-deleted users and falls back to EN", async () => {
    const email = uniqueEmail("lang-deleted-user");
    const user = await prisma.users.create({
      data: {
        username: uniqueMarker("lang-deleted-user"),
        email,
        password: "unused",
        language: "TH",
        is_deleted: true,
      },
    });

    try {
      expect(await getEmailRecipientLanguage(user.email)).toBe("EN");
    } finally {
      await prisma.users.delete({ where: { id: user.id } });
    }
  });
});

describe("backend localizeMailOptions (real DB)", () => {
  test("translates Thai phrases to English for a recipient with no stored language", async () => {
    const result = await localizeMailOptions({
      to: uniqueEmail("localize-en"),
      subject: "รหัสยืนยัน",
      text: "กรุณาอย่าตอบกลับอีเมลฉบับนี้",
      html: '<html lang="th"><body>เข้าสู่ระบบ</body></html>',
    });

    expect(result.subject).toBe("Verification code");
    expect(result.text).toBe("Please do not reply to this email");
    expect(result.html).toBe('<html lang="en"><body>Sign in</body></html>');
  });

  test("leaves the mail untouched for a recipient whose stored language is not EN", async () => {
    const email = uniqueEmail("localize-th-user");
    const user = await prisma.users.create({
      data: { username: uniqueMarker("localize-th-user"), email, password: "unused", language: "TH" },
    });

    try {
      const original = { to: user.email, subject: "รหัสยืนยัน", text: "ข้อความภาษาไทย" };
      const result = await localizeMailOptions(original);

      expect(result).toEqual(original);
    } finally {
      await prisma.users.delete({ where: { id: user.id } });
    }
  });
});
