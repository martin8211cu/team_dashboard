import knex from "knex";
import config from "../knexfile";

const db = knex(config);

try {
  const log = await db.seed.run();
  const files = log.flat();
  if (files.length === 0) {
    console.log("No seed files ran");
  } else {
    console.log(`Ran ${files.length} seed(s)`);
    for (const name of files) {
      console.log(`  ${name}`);
    }
  }
} finally {
  await db.destroy();
}
