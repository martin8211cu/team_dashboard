import type { Knex } from "knex";
import { seedFollowUpNotesFromFixture } from "./lib/followUpNotesImport";

/**
 * Seeds historical monthly 1:1 sessions from the committed fixture
 * `seeds/data/follow_up_notes.json` (not from evaluacion-rh/).
 * Idempotent: re-running upserts by (member_id, period).
 *
 * Regenerate the fixture when local notes change:
 *   bun run --filter @team-dashboard/db seed:export-follow-up-notes
 */
export async function seed(knex: Knex): Promise<void> {
  await seedFollowUpNotesFromFixture(knex);
}
