import "dotenv/config";
import pg from "pg";

const { Client } = pg;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing. Add it to your .env file first.");
  }

  const client = new Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5000,
  });

  await client.connect();

  try {
    const result = await client.query(
      "select current_database() as database, current_user as user, now() as connected_at",
    );
    const row = result.rows[0];

    console.log(`Connected to database: ${row.database}`);
    console.log(`Connected as user: ${row.user}`);
    console.log(`Connected at: ${row.connected_at.toISOString()}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
