import {
  getDatabaseUrl,
  getMasterConfig,
  getTargetDatabaseName,
  quoteIdentifier,
  sql,
  withPool,
} from "./db-utils.mjs";

function assertResetConfirmed(databaseName) {
  const confirmed = process.argv.includes("--force") || process.env.CONFIRM_DB_RESET === databaseName;

  if (!confirmed) {
    throw new Error(
      `Reset will drop "${databaseName}". Re-run with --force or set CONFIRM_DB_RESET=${databaseName}.`,
    );
  }
}

async function main() {
  const databaseUrl = getDatabaseUrl();
  const databaseName = getTargetDatabaseName(databaseUrl);

  assertResetConfirmed(databaseName);

  await withPool(getMasterConfig(databaseUrl), async (pool) => {
    const existing = await pool
      .request()
      .input("databaseName", sql.NVarChar, databaseName)
      .query("select database_id from sys.databases where name = @databaseName");

    if (existing.recordset.length > 0) {
      const databaseIdentifier = quoteIdentifier(databaseName);

      await pool.request().query(`
        alter database ${databaseIdentifier} set single_user with rollback immediate;
        drop database ${databaseIdentifier};
      `);
      console.log(`Database dropped: ${databaseName}`);
    } else {
      console.log(`Database did not exist: ${databaseName}`);
    }

    await pool.request().query(`create database ${quoteIdentifier(databaseName)}`);
    console.log(`Database created: ${databaseName}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
