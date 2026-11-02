import type { Knex } from "knex";

function splitBilingualMarkdown(content: string): { es: string; en: string } {
  const trimmed = content.trim();
  const enHeader = trimmed.search(/^#\s+Monthly 1:1 Summary/im);
  if (enHeader > 0) {
    let es = trimmed.slice(0, enHeader).trim();
    es = es.replace(/\n---\s*$/, "").trim();
    const en = trimmed.slice(enHeader).trim();
    return { es, en };
  }
  return { es: trimmed, en: "" };
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("follow_up_monthly_reports", (table) => {
    table.text("content_md_es").notNullable().defaultTo("");
    table.text("content_md_en").notNullable().defaultTo("");
    table.timestamp("updated_at", { useTz: true });
    table.integer("updated_by").references("id").inTable("team_members").onDelete("SET NULL");
  });

  const rows = await knex("follow_up_monthly_reports").select<{
    id: number;
    content_md: string;
    generated_at: Date | string;
  }[]>("id", "content_md", "generated_at");

  for (const row of rows) {
    const { es, en } = splitBilingualMarkdown(row.content_md ?? "");
    await knex("follow_up_monthly_reports").where({ id: row.id }).update({
      content_md_es: es,
      content_md_en: en,
      updated_at: row.generated_at,
    });
  }

  await knex.schema.alterTable("follow_up_monthly_reports", (table) => {
    table.dropColumn("content_md");
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("follow_up_monthly_reports", (table) => {
    table.text("content_md").notNullable().defaultTo("");
  });

  const rows = await knex("follow_up_monthly_reports").select<{
    id: number;
    content_md_es: string;
    content_md_en: string;
  }[]>("id", "content_md_es", "content_md_en");

  for (const row of rows) {
    const parts = [row.content_md_es?.trim(), row.content_md_en?.trim()].filter(Boolean);
    await knex("follow_up_monthly_reports")
      .where({ id: row.id })
      .update({ content_md: parts.join("\n\n---\n\n") });
  }

  await knex.schema.alterTable("follow_up_monthly_reports", (table) => {
    table.dropColumn("updated_by");
    table.dropColumn("updated_at");
    table.dropColumn("content_md_en");
    table.dropColumn("content_md_es");
  });
}
