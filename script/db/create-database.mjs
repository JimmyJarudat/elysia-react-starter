import "dotenv/config";
import pg from "pg";

const { Client } = pg;

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Add it to your .env file first.");
  }

  return new URL(databaseUrl);
}

function getTargetDatabaseName(url) {
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));

  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name, for example /learnova_db.");
  }

  if (databaseName === "postgres") {
    throw new Error("Refusing to create the maintenance database named postgres.");
  }

  return databaseName;
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function getMaintenanceUrl(url) {
  const maintenanceUrl = new URL(url.toString());
  maintenanceUrl.pathname = "/postgres";
  maintenanceUrl.search = "";
  return maintenanceUrl.toString();
}

async function main() {
  const targetUrl = getDatabaseUrl();
  const databaseName = getTargetDatabaseName(targetUrl);
  const client = new Client({
    connectionString: getMaintenanceUrl(targetUrl),
    connectionTimeoutMillis: 5000,
  });

  await client.connect();

  try {
    const existing = await client.query(
      "select 1 from pg_database where datname = $1",
      [databaseName],
    );

    if (existing.rowCount > 0) {
      console.log(`Database already exists: ${databaseName}`);
      return;
    }

    await client.query(`create database ${quoteIdentifier(databaseName)}`);
    console.log(`Database created: ${databaseName}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
