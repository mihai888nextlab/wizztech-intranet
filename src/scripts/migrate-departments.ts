/*
  One-shot migration: a volunteer's single `department` becomes a `departments`
  array, because people help on more than one side of the team — whoever films
  the match is often the one writing the post about it.

  Explicit SQL for the same reason as `migrate-roles.ts`: `drizzle-kit push`
  would drop the old column in the same diff that adds the new one, losing the
  values before anything could copy them across.

  Safe to run more than once, and before or after `npm run db:push`.

    npm run db:migrate-departments
*/
import "dotenv/config";

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

async function hasColumn(table: string, column: string) {
  const { rows } = await db.execute(sql`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = ${table} AND column_name = ${column}
  `);
  return rows.length > 0;
}

async function main() {
  console.log("Adding the departments column...");
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS departments varchar(20)[] NOT NULL DEFAULT '{}'
  `);

  if (await hasColumn("users", "department")) {
    console.log("Backfilling it from the old single department...");
    // A volunteer with no department becomes an empty array, not {null}.
    await db.execute(sql`
      UPDATE users
      SET departments = CASE
        WHEN department IS NULL THEN '{}'::varchar(20)[]
        ELSE ARRAY[department]::varchar(20)[]
      END
    `);

    const { rows } = await db.execute(sql`
      SELECT departments, COUNT(*)::int AS count
      FROM users WHERE account_type = 'volunteer'
      GROUP BY departments ORDER BY count DESC
    `);
    for (const row of rows) {
      console.log(`  ${row.count} × ${JSON.stringify(row.departments)}`);
    }

    console.log("Dropping the old column...");
    await db.execute(sql`ALTER TABLE users DROP COLUMN IF EXISTS department`);
  } else {
    console.log("Old `department` column is already gone — nothing to backfill.");
  }

  console.log("Done. `npm run db:push` should now report no changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
