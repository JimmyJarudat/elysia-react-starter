import {
  getDatabaseUrl,
  getSqlServerConfig,
  withPool,
} from "./db-utils.mjs";

async function main() {
  const databaseUrl = getDatabaseUrl();

  await withPool(getSqlServerConfig(databaseUrl), async (pool) => {
    const result = await pool.request().query(
      "select db_name() as database_name, suser_sname() as [user], sysdatetimeoffset() as connected_at",
    );
    const row = result.recordset[0];

    console.log(`Connected to database: ${row.database_name}`);
    console.log(`Connected as user: ${row.user}`);
    console.log(`Connected at: ${row.connected_at.toISOString()}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
