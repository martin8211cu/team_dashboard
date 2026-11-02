import { access } from "node:fs/promises";
import {
  EVALUACION_RH_NOTES_DIR,
  buildFollowUpNotesFixturesFromDir,
  writeFollowUpNotesFixture,
} from "../seeds/lib/followUpNotesImport";

try {
  await access(EVALUACION_RH_NOTES_DIR);
} catch {
  console.error(
    `Missing notes dir: ${EVALUACION_RH_NOTES_DIR}\nKeep evaluacion-rh/ local (gitignored) and re-run.`,
  );
  process.exit(1);
}

const sessions = await buildFollowUpNotesFixturesFromDir(EVALUACION_RH_NOTES_DIR);
if (sessions.length === 0) {
  console.error("No sessions parsed from notes; fixture not written");
  process.exit(1);
}

const out = await writeFollowUpNotesFixture(sessions, "evaluacion-rh/notas");
console.log(`Wrote ${sessions.length} session(s) → ${out}`);
