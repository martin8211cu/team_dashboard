import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("retro_sessions", (table) => {
    table
      .integer("writing_timer_seconds_left")
      .notNullable()
      .defaultTo(180);
    table.timestamp("writing_timer_started_at", { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("retro_sessions", (table) => {
    table.dropColumn("writing_timer_started_at");
    table.dropColumn("writing_timer_seconds_left");
  });
}
