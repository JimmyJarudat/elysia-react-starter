import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backendRequire = createRequire(new URL("../../backend/package.json", import.meta.url));
const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, "../..");

function requireDependency(packageName) {
  try {
    return backendRequire(packageName);
  } catch (error) {
    throw new Error(
      `Cannot find "${packageName}". Run "npm install" or "bun install" inside the backend folder first.`,
      { cause: error },
    );
  }
}

export const sql = requireDependency("mssql");

export function loadEnv() {
  const dotenv = requireDependency("dotenv");
  const envFiles = [resolve(rootDir, ".env"), resolve(rootDir, "backend/.env")];
  const envPath = envFiles.find((filePath) => existsSync(filePath));

  if (envPath) {
    dotenv.config({ path: envPath, quiet: true });
    return envPath;
  }

  dotenv.config({ quiet: true });
  return null;
}

export function getDatabaseUrl() {
  loadEnv();

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Add it to .env or backend/.env first.");
  }

  return databaseUrl;
}

function parseBoolean(value, fallback) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes"].includes(String(value).toLowerCase());
}

function parseSemicolonSqlServerUrl(databaseUrl) {
  const prefix = "sqlserver://";

  if (!databaseUrl.toLowerCase().startsWith(prefix)) {
    return null;
  }

  const value = databaseUrl.slice(prefix.length);
  const [serverPart, ...settingParts] = value.split(";");
  const settings = new Map();

  for (const part of settingParts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = part.slice(0, separatorIndex).trim().toLowerCase();
    const settingValue = part.slice(separatorIndex + 1).trim();
    settings.set(key, settingValue);
  }

  const lastColonIndex = serverPart.lastIndexOf(":");
  const hasPort = lastColonIndex > -1 && /^\d+$/.test(serverPart.slice(lastColonIndex + 1));
  const server = hasPort ? serverPart.slice(0, lastColonIndex) : serverPart;
  const port = hasPort ? Number(serverPart.slice(lastColonIndex + 1)) : undefined;

  return {
    server,
    port,
    database: settings.get("database"),
    user: settings.get("user"),
    password: settings.get("password"),
    encrypt: parseBoolean(settings.get("encrypt"), false),
    trustServerCertificate: parseBoolean(settings.get("trustservercertificate"), true),
  };
}

function parseStandardUrl(databaseUrl) {
  const url = new URL(databaseUrl);

  return {
    server: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    encrypt: parseBoolean(url.searchParams.get("encrypt"), false),
    trustServerCertificate: parseBoolean(url.searchParams.get("trustServerCertificate"), true),
  };
}

export function getSqlServerConfig(databaseUrl = getDatabaseUrl(), overrides = {}) {
  const parsed = parseSemicolonSqlServerUrl(databaseUrl) ?? parseStandardUrl(databaseUrl);
  const database = overrides.database ?? parsed.database;

  if (!parsed.server) {
    throw new Error("DATABASE_URL must include a SQL Server host.");
  }

  if (!database) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  if (!parsed.user) {
    throw new Error("DATABASE_URL must include a user.");
  }

  return {
    server: parsed.server,
    port: parsed.port,
    database,
    user: parsed.user,
    password: parsed.password ?? "",
    connectionTimeout: 5000,
    requestTimeout: 30000,
    options: {
      encrypt: parsed.encrypt,
      trustServerCertificate: parsed.trustServerCertificate,
    },
  };
}

export function getTargetDatabaseName(databaseUrl = getDatabaseUrl()) {
  const { database } = getSqlServerConfig(databaseUrl);

  if (["master", "model", "msdb", "tempdb"].includes(database.toLowerCase())) {
    throw new Error(`Refusing to manage SQL Server system database "${database}".`);
  }

  return database;
}

export function quoteIdentifier(identifier) {
  return `[${identifier.replaceAll("]", "]]")}]`;
}

export function getMasterConfig(databaseUrl = getDatabaseUrl()) {
  return getSqlServerConfig(databaseUrl, { database: "master" });
}

export async function withPool(config, callback) {
  const pool = new sql.ConnectionPool(config);
  await pool.connect();

  try {
    return await callback(pool);
  } finally {
    await pool.close();
  }
}
