import type { Knex } from "knex";

export async function seed(knex: Knex): Promise<void> {
  await knex("kpis")
    .insert([
      { id: "velocity", name: "Velocity", value: 42, unit: "pts/sprint" },
      { id: "cycle-time", name: "Cycle Time", value: 3.2, unit: "days" },
      { id: "open-prs", name: "Open PRs", value: 7, unit: "count" },
    ])
    .onConflict("id")
    .ignore();
}
