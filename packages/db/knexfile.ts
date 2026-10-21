import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Knex } from "knex";

const packageDir = dirname(fileURLToPath(import.meta.url));

const connection = process.env.DATABASE_URL;
if (!connection) {
  throw new Error("DATABASE_URL is required for Knex");
}

const config: Knex.Config = {
  client: "pg",
  connection,
  pool: { min: 0, max: 10 },
  migrations: {
    directory: join(packageDir, "migrations"),
    extension: "ts",
  },
  seeds: {
    directory: join(packageDir, "seeds"),
    extension: "ts",
  },
};

export default config;
