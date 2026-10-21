import type { Knex } from "knex";

function adminDisplayName(email: string): string {
  const local = email.split("@")[0] ?? "admin";
  return (
    local
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Admin"
  );
}

async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

export async function seed(knex: Knex): Promise<void> {
  const adminEmail = process.env.AUTH_ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    console.warn("AUTH_ADMIN_EMAIL not set; skipping admin member seed");
    return;
  }

  const password = process.env.AUTH_DEFAULT_PASSWORD;
  if (password == null || password.length === 0) {
    throw new Error(
      "AUTH_DEFAULT_PASSWORD is required for admin seed (set it in .env at the project root)",
    );
  }

  const name = adminDisplayName(adminEmail);
  const passwordHash = await hashPassword(password);

  const byEmail = await knex("team_members").where({ email: adminEmail }).first<{
    id: number;
    password_hash: string | null;
  }>();

  if (byEmail) {
    await knex("team_members")
      .where({ id: byEmail.id })
      .update({
        active: true,
        password_hash: byEmail.password_hash || passwordHash,
      });
    console.log(`Admin member already exists (id ${byEmail.id}); ensured active and password`);
    return;
  }

  const byName = await knex("team_members")
    .whereRaw("lower(name) = lower(?)", [name])
    .first<{ id: number; password_hash: string | null }>();

  if (byName) {
    await knex("team_members").where({ id: byName.id }).update({
      email: adminEmail,
      active: true,
      password_hash: byName.password_hash || passwordHash,
    });
    console.log(`Linked admin email to existing member (id ${byName.id})`);
    return;
  }

  await knex("team_members").insert({
    name,
    email: adminEmail,
    active: true,
    password_hash: passwordHash,
  });
  console.log(`Created admin member (${adminEmail})`);
}
