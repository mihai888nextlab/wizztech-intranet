/*
  One-shot migration: every points award now names the department it was
  earned in, so the leaderboard can be split by team.

  The column is NOT NULL, and there is no honest default for an award that
  already exists — nobody can say after the fact which team a point was for.
  So the script refuses to guess: if it finds awards without a department it
  stops and tells you how many, leaving the column nullable until you decide.

    npm run db:migrate-point-departments
*/
import "dotenv/config";

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

async function main() {
  const { rows: existing } = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'volunteer_points' AND column_name = 'department'
  `);

  if (existing.length === 0) {
    console.log("Adding the department column...");
    await db.execute(sql`
      ALTER TABLE volunteer_points ADD COLUMN department varchar(20)
    `);
  }

  const { rows } = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM volunteer_points WHERE department IS NULL
  `);
  const unassigned = Number(rows[0].n);

  if (unassigned > 0) {
    console.error(
      `\n${unassigned} award(s) have no department, and guessing one would ` +
        `invent history.\n\nAssign them yourself, then run this again. For ` +
        `example, to put every existing award on one board:\n\n` +
        `  UPDATE volunteer_points SET department = 'engineering' WHERE department IS NULL;\n`
    );
    process.exit(1);
  }

  console.log("Every award has a department — enforcing NOT NULL...");
  await db.execute(sql`
    ALTER TABLE volunteer_points ALTER COLUMN department SET NOT NULL
  `);

  const { rows: counts } = await db.execute(sql`
    SELECT department, COUNT(*)::int AS count
    FROM volunteer_points GROUP BY department ORDER BY count DESC
  `);
  for (const row of counts) {
    console.log(`  ${row.count} × ${row.department}`);
  }

  console.log("Done. `npm run db:push` should now report no changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
