import type { Knex } from "knex";
import { seedFollowUpNotesFromEvaluacionRh } from "./lib/followUpNotesImport";

/**
 * Seeds historical monthly 1:1 sessions from evaluacion-rh/notas.
 * Idempotent: re-running upserts by (member_id, period).
 * Skips quietly if the notes folder is not present.
 */
export async function seed(knex: Knex): Promise<void> {
  await seedFollowUpNotesFromEvaluacionRh(knex);
}
