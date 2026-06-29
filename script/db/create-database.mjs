import {
  getDatabaseUrl,
  getMasterConfig,
  getTargetDatabaseName,
  quoteIdentifier,
  sql,
  withPool,
} from "./db-utils.mjs";

async function main() {
  const databaseUrl = getDatabaseUrl();
  const databaseName = getTargetDatabaseName(databaseUrl);

  await withPool(getMasterConfig(databaseUrl), async (pool) => {
    const existing = await pool
      .request()
      .input("databaseName", sql.NVarChar, databaseName)
      .query("select database_id from sys.databases where name = @databaseName");

    if (existing.recordset.length > 0) {
      console.log(`Database already exists: ${databaseName}`);
      return;
    }

    await pool.request().query(`create database ${quoteIdentifier(databaseName)}`);
    console.log(`Database created: ${databaseName}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
