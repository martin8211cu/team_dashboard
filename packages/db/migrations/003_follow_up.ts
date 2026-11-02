import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("follow_up_sessions", (table) => {
    table.increments("id").primary();
    table
      .integer("member_id")
      .notNullable()
      .references("id")
      .inTable("team_members")
      .onDelete("CASCADE");
    table.text("period").notNullable(); // YYYY-MM
    table.text("status").notNullable().defaultTo("draft"); // draft | completed
    table.text("overall_status"); // excelente | bien | neutral | preocupado | riesgo
    table.timestamp("meeting_date", { useTz: true });
    table.text("tl_feedback").notNullable().defaultTo("");
    table.text("closing_answer").notNullable().defaultTo("");
    table
      .integer("created_by")
      .notNullable()
      .references("id")
      .inTable("team_members");
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("completed_at", { useTz: true });
    table.unique(["member_id", "period"]);
    table.index("period", "idx_follow_up_sessions_period");
    table.index("member_id", "idx_follow_up_sessions_member");
  });

  await knex.schema.createTable("follow_up_answers", (table) => {
    table.increments("id").primary();
    table
      .integer("session_id")
      .notNullable()
      .references("id")
      .inTable("follow_up_sessions")
      .onDelete("CASCADE");
    table.text("section_key").notNullable();
    table.text("question_key").notNullable();
    table.text("answer_text").notNullable().defaultTo("");
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.unique(["session_id", "question_key"]);
    table.index("session_id", "idx_follow_up_answers_session");
  });

  await knex.schema.createTable("follow_up_evaluations", (table) => {
    table
      .integer("session_id")
      .primary()
      .references("id")
      .inTable("follow_up_sessions")
      .onDelete("CASCADE");
    table.integer("calidad_tecnica").notNullable();
    table.integer("cumplimiento").notNullable();
    table.integer("comunicacion").notNullable();
    table.integer("colaboracion").notNullable();
    table.integer("autonomia").notNullable();
    table.integer("proactividad").notNullable();
    table.integer("aprendizaje").notNullable();
    table.text("tendencia").notNullable().defaultTo("stable"); // up | down | stable
    table.text("observaciones").notNullable().defaultTo("");
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.createTable("follow_up_agreements", (table) => {
    table.increments("id").primary();
    table
      .integer("session_id")
      .notNullable()
      .references("id")
      .inTable("follow_up_sessions")
      .onDelete("CASCADE");
    table.text("description").notNullable();
    table.integer("owner_member_id").references("id").inTable("team_members").onDelete("SET NULL");
    table.timestamp("due_date", { useTz: true });
    table.text("status").notNullable().defaultTo("open"); // open | in_progress | done | cancelled
    table.text("notes").notNullable().defaultTo("");
    table.integer("sort_order").notNullable().defaultTo(0);
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp("updated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.index("session_id", "idx_follow_up_agreements_session");
  });

  await knex.schema.createTable("follow_up_monthly_reports", (table) => {
    table.increments("id").primary();
    table.text("period").notNullable().unique();
    table.text("content_md").notNullable();
    table.text("model").notNullable();
    table
      .integer("generated_by")
      .notNullable()
      .references("id")
      .inTable("team_members");
    table.timestamp("generated_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("follow_up_monthly_reports");
  await knex.schema.dropTableIfExists("follow_up_agreements");
  await knex.schema.dropTableIfExists("follow_up_evaluations");
  await knex.schema.dropTableIfExists("follow_up_answers");
  await knex.schema.dropTableIfExists("follow_up_sessions");
}
