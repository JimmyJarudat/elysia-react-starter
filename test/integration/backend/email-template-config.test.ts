import { describe, expect, test } from "bun:test";
import "../../helpers/db"; // loads DATABASE_URL before email-template-config imports prisma config
import { getEmailTemplateConfig } from "../../../backend/src/utils/email-template-config";

// This intentionally does not mutate the shared `email_app_name`/`email_app_url` system_config
// rows (they are live settings, not disposable test fixtures) — just verifies the DB-driven
// config read returns a sane, non-empty value end-to-end.
describe("backend getEmailTemplateConfig (real DB, read-only)", () => {
  test("returns a non-empty appName and a normalized appUrl", async () => {
    const config = await getEmailTemplateConfig();

    expect(config.appName.length).toBeGreaterThan(0);
    expect(config.appUrl.length).toBeGreaterThan(0);
    expect(config.appUrl.endsWith("/")).toBe(false);
  });
});
