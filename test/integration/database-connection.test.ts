import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url));
const sql = backendRequire("mssql");
const dotenv = backendRequire("dotenv");

function loadEnv() {
  const envPath = [resolve(process.cwd(), ".env"), resolve(process.cwd(), "backend/.env")].find((filePath) =>
    existsSync(filePath),
  );

  dotenv.config(envPath ? { path: envPath, quiet: true } : { quiet: true });
}

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function parseSqlServerUrl(databaseUrl: string) {
  const prefix = "sqlserver://";

  if (!databaseUrl.toLowerCase().startsWith(prefix)) {
    throw new Error("DATABASE_URL must use the sqlserver:// scheme.");
  }

  const value = databaseUrl.slice(prefix.length);
  const [serverPart, ...settingParts] = value.split(";");
  const settings = new Map<string, string>();

  for (const part of settingParts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    settings.set(part.slice(0, separatorIndex).trim().toLowerCase(), part.slice(separatorIndex + 1).trim());
  }

  const lastColonIndex = serverPart.lastIndexOf(":");
  const hasPort = lastColonIndex > -1 && /^\d+$/.test(serverPart.slice(lastColonIndex + 1));

  return {
    server: hasPort ? serverPart.slice(0, lastColonIndex) : serverPart,
    port: hasPort ? Number(serverPart.slice(lastColonIndex + 1)) : undefined,
    database: settings.get("database"),
    user: settings.get("user"),
    password: settings.get("password") ?? "",
    options: {
      encrypt: parseBoolean(settings.get("encrypt"), false),
      trustServerCertificate: parseBoolean(settings.get("trustservercertificate"), true),
    },
    connectionTimeout: 5000,
    requestTimeout: 30000,
  };
}

describe("database connection", () => {
  test("connects to the configured SQL Server database", async () => {
    loadEnv();

    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is missing. Add it to .env or backend/.env first.");
    }

    const config = parseSqlServerUrl(databaseUrl);
    const pool = new sql.ConnectionPool(config);

    await pool.connect();

    try {
      const result = (await pool.request().query(
        "select db_name() as database_name, suser_sname() as [user]",
      )) as { recordset: Array<{ database_name: string; user: string }> };
      const row = result.recordset[0];

      expect(row?.database_name).toBeTruthy();
      expect(row?.user).toBeTruthy();
    } finally {
      await pool.close();
    }
  });
});
