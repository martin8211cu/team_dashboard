/**
 * Reset a member password (local recovery). Usage:
 *   bun --env-file=.env run packages/db/scripts/reset-member-password.ts [email]
 * Defaults to AUTH_ADMIN_EMAIL and AUTH_DEFAULT_PASSWORD from .env.
 */
import knex from "knex";
import config from "../knexfile";

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
}

const emailArg = process.argv[2]?.trim().toLowerCase();
const email = emailArg || process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.AUTH_DEFAULT_PASSWORD;

if (!email) {
  console.error("Provide member email or set AUTH_ADMIN_EMAIL in .env");
  process.exit(1);
}
if (password == null || password.length === 0) {
  console.error("Set AUTH_DEFAULT_PASSWORD in .env");
  process.exit(1);
}

const db = knex(config);
try {
  const row = await db("team_members").where({ email }).first<{ id: number; name: string }>();
  if (!row) {
    console.error(`No member with email ${email}`);
    process.exit(1);
  }
  const passwordHash = await hashPassword(password);
  await db("team_members").where({ id: row.id }).update({ password_hash: passwordHash, active: true });
  console.log(`Password reset for ${row.name} (${email})`);
} finally {
  await db.destroy();
}
