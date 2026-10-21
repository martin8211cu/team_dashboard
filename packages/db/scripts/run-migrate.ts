import knex from "knex";
import { ensureDatabaseExists } from "../src/ensureDatabase";
import config from "../knexfile";

try {
  const connection = process.env.DATABASE_URL;
  if (!connection) {
    throw new Error("DATABASE_URL is required");
  }

  await ensureDatabaseExists(connection);

  const db = knex(config);
  try {
    const [batch, log] = await db.migrate.latest();
    if (log.length === 0) {
      console.log("Already up to date");
    } else {
      console.log(`Batch ${batch} run: ${log.length} migration(s)`);
      for (const name of log) {
        console.log(`  ${name}`);
      }
    }
  } finally {
    await db.destroy();
  }
} catch (err) {
  console.error("[migrate] failed:", err);
  process.exit(1);
}
