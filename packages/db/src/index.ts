import knex, { type Knex } from "knex";

let instance: Knex | null = null;

function createKnex(): Knex {
  const connection = process.env.DATABASE_URL;
  if (!connection) {
    throw new Error("DATABASE_URL is required");
  }

  return knex({
    client: "pg",
    connection,
    pool: { min: 0, max: 10 },
  });
}

export function getDb(): Knex {
  if (!instance) {
    instance = createKnex();
  }
  return instance;
}

export async function closeDb(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}

export type { Knex };
