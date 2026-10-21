import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("kpis", (table) => {
    table.text("id").primary();
    table.text("name").notNullable();
    table.double("value").notNullable();
    table.text("unit").notNullable().defaultTo("");
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("team_members", (table) => {
    table.increments("id").primary();
    table.text("name").notNullable();
    table.text("email").unique();
    table.text("jira_account_id");
    table.text("password_hash");
    table.boolean("active").notNullable().defaultTo(true);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw("CREATE UNIQUE INDEX team_members_name_lower_unique ON team_members (lower(name))");

  await knex.schema.createTable("auth_sessions", (table) => {
    table.increments("id").primary();
    table.text("token_hash").notNullable().unique();
    table
      .integer("member_id")
      .notNullable()
      .references("id")
      .inTable("team_members")
      .onDelete("CASCADE");
    table.text("email").notNullable();
    table.timestamp("expires_at", { useTz: true }).notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index("member_id", "idx_auth_sessions_member");
  });

  await knex.schema.createTable("sprint_task_snapshots", (table) => {
    table.integer("sprint_number").primary();
    table.integer("sprint_id");
    table.text("sprint_name").notNullable();
    table.text("sprint_state").notNullable();
    table.integer("task_count").notNullable();
    table.timestamp("fetched_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text("tasks_json").notNullable();
  });

  await knex.schema.createTable("sprint_metrics_snapshots", (table) => {
    table.integer("sprint_number").primary();
    table.integer("sprint_id");
    table.text("sprint_name").notNullable();
    table.text("sprint_state").notNullable();
    table.integer("metrics_count").notNullable();
    table.timestamp("fetched_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.text("sprint_json").notNullable();
    table.text("metrics_json").notNullable();
  });

  await knex.schema.createTable("retro_sessions", (table) => {
    table.increments("id").primary();
    table.integer("sprint_number").notNullable().unique();
    table.text("status").notNullable().defaultTo("open");
    table
      .integer("created_by")
      .notNullable()
      .references("id")
      .inTable("team_members");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("closed_at", { useTz: true });
  });

  await knex.schema.createTable("retro_participants", (table) => {
    table.integer("session_id").notNullable().references("id").inTable("retro_sessions").onDelete("CASCADE");
    table.integer("member_id").notNullable().references("id").inTable("team_members").onDelete("CASCADE");
    table.timestamp("joined_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(["session_id", "member_id"]);
    table.index("session_id", "idx_retro_participants_session");
  });

  await knex.schema.createTable("retro_cards", (table) => {
    table.increments("id").primary();
    table.integer("session_id").notNullable().references("id").inTable("retro_sessions").onDelete("CASCADE");
    table.text("column_key").notNullable();
    table.text("body").notNullable();
    table.integer("author_id").notNullable().references("id").inTable("team_members");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index("session_id", "idx_retro_cards_session");
  });

  await knex.schema.createTable("retro_card_reactions", (table) => {
    table.integer("card_id").notNullable().references("id").inTable("retro_cards").onDelete("CASCADE");
    table.integer("member_id").notNullable().references("id").inTable("team_members").onDelete("CASCADE");
    table.text("reaction").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.primary(["card_id", "member_id"]);
    table.index("card_id", "idx_retro_card_reactions_card");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("retro_card_reactions");
  await knex.schema.dropTableIfExists("retro_cards");
  await knex.schema.dropTableIfExists("retro_participants");
  await knex.schema.dropTableIfExists("retro_sessions");
  await knex.schema.dropTableIfExists("sprint_metrics_snapshots");
  await knex.schema.dropTableIfExists("sprint_task_snapshots");
  await knex.schema.dropTableIfExists("auth_sessions");
  await knex.schema.dropTableIfExists("team_members");
  await knex.schema.dropTableIfExists("kpis");
}
