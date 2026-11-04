import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("follow_up_self_evaluations", (table) => {
    table.increments("id").primary();
    table
      .integer("member_id")
      .notNullable()
      .references("id")
      .inTable("team_members")
      .onDelete("CASCADE");
    table.text("period").notNullable();
    table.integer("calidad_tecnica").notNullable();
    table.integer("cumplimiento").notNullable();
    table.integer("comunicacion").notNullable();
    table.integer("colaboracion").notNullable();
    table.integer("autonomia").notNullable();
    table.integer("proactividad").notNullable();
    table.integer("aprendizaje").notNullable();
    table.text("tendencia").notNullable().defaultTo("stable");
    table.text("observaciones").notNullable().defaultTo("");
    table.timestamp("submitted_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["member_id", "period"]);
    table.index("period", "idx_follow_up_self_evaluations_period");
    table.index("member_id", "idx_follow_up_self_evaluations_member");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("follow_up_self_evaluations");
}
