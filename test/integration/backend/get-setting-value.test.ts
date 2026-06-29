import { describe, expect, test } from "bun:test";
import prisma, { uniqueMarker } from "../../helpers/db";
import {
  getSecretSettingValue,
  getSettingValue,
  upsertSettingValue,
} from "../../../backend/src/utils/get-setting-value";
import { encryptText } from "../../../backend/src/utils/encryption";

async function withSetting(
  data: { id: string; value: string; data_type?: string; is_active?: boolean; is_encrypted?: boolean },
  run: () => Promise<void>,
) {
  await prisma.system_config.create({
    data: {
      id: data.id,
      value: data.value,
      display_name: data.id,
      description: "unit test setting",
      category: "TEST",
      data_type: data.data_type ?? "STRING",
      is_active: data.is_active ?? true,
      is_encrypted: data.is_encrypted ?? false,
    },
  });

  try {
    await run();
  } finally {
    await prisma.system_config.delete({ where: { id: data.id } });
  }
}

describe("backend getSettingValue (real DB)", () => {
  test("returns the default when the setting does not exist", async () => {
    expect(await getSettingValue(uniqueMarker("missing-setting"), "fallback")).toBe("fallback");
  });

  test("returns the default when the setting is inactive", async () => {
    const id = uniqueMarker("inactive-setting");

    await withSetting({ id, value: "anything", is_active: false }, async () => {
      expect(await getSettingValue(id, "fallback")).toBe("fallback");
    });
  });

  test("parses NUMBER settings, falling back on invalid numbers", async () => {
    const id = uniqueMarker("number-setting");

    await withSetting({ id, value: "42", data_type: "NUMBER" }, async () => {
      expect(await getSettingValue(id, 0)).toBe(42);
    });

    const invalidId = uniqueMarker("number-setting-invalid");
    await withSetting({ id: invalidId, value: "not-a-number", data_type: "NUMBER" }, async () => {
      expect(await getSettingValue(invalidId, 7)).toBe(7);
    });
  });

  test("parses BOOLEAN settings case-insensitively", async () => {
    const id = uniqueMarker("bool-setting");

    await withSetting({ id, value: "TRUE", data_type: "BOOLEAN" }, async () => {
      expect(await getSettingValue(id, false)).toBe(true);
    });
  });

  test("parses JSON settings, falling back on invalid JSON", async () => {
    const id = uniqueMarker("json-setting");

    await withSetting({ id, value: '{"a":1}', data_type: "JSON" }, async () => {
      // getSettingValue's defaultValue type is narrower (string | number | boolean) than what
      // JSON-typed settings actually return/fall back to at runtime — cast to match real usage.
      expect(await getSettingValue(id, {} as unknown as string)).toEqual({ a: 1 });
    });

    const invalidId = uniqueMarker("json-setting-invalid");
    await withSetting({ id: invalidId, value: "not-json", data_type: "JSON" }, async () => {
      expect(await getSettingValue(invalidId, { default: true } as unknown as string)).toEqual({ default: true });
    });
  });

  test("returns the raw string for STRING (default) settings", async () => {
    const id = uniqueMarker("string-setting");

    await withSetting({ id, value: "hello" }, async () => {
      expect(await getSettingValue(id, "fallback")).toBe("hello");
    });
  });
});

describe("backend getSecretSettingValue (real DB)", () => {
  test("returns an empty string when the setting is missing", async () => {
    expect(await getSecretSettingValue(uniqueMarker("missing-secret"))).toBe("");
  });

  test("returns the raw value when not encrypted", async () => {
    const id = uniqueMarker("plain-secret");

    await withSetting({ id, value: "plain-value", is_encrypted: false }, async () => {
      expect(await getSecretSettingValue(id)).toBe("plain-value");
    });
  });

  test("decrypts the value when marked as encrypted", async () => {
    const id = uniqueMarker("encrypted-secret");

    await withSetting({ id, value: encryptText("super-secret"), is_encrypted: true }, async () => {
      expect(await getSecretSettingValue(id)).toBe("super-secret");
    });
  });

  test("returns an empty string when the encrypted value cannot be decrypted", async () => {
    const id = uniqueMarker("broken-secret");

    await withSetting({ id, value: "not-valid-ciphertext", is_encrypted: true }, async () => {
      expect(await getSecretSettingValue(id)).toBe("");
    });
  });
});

describe("backend upsertSettingValue (real DB)", () => {
  test("creates a new setting row", async () => {
    const id = uniqueMarker("upsert-create");

    try {
      await upsertSettingValue(id, "initial", "Initial", "desc", "TEST", "STRING", false);

      const row = await prisma.system_config.findUnique({ where: { id } });
      expect(row?.value).toBe("initial");
      expect(row?.data_type).toBe("STRING");
      expect(row?.is_encrypted).toBe(false);
    } finally {
      await prisma.system_config.delete({ where: { id } }).catch(() => {});
    }
  });

  test("updates an existing setting row in place", async () => {
    const id = uniqueMarker("upsert-update");

    try {
      await upsertSettingValue(id, "v1", "Name", "desc", "TEST", "NUMBER", false);
      await upsertSettingValue(id, "v2", "Name", "desc", "TEST", "NUMBER", false);

      const row = await prisma.system_config.findUnique({ where: { id } });
      expect(row?.value).toBe("v2");
    } finally {
      await prisma.system_config.delete({ where: { id } }).catch(() => {});
    }
  });
});
