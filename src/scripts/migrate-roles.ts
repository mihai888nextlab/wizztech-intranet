/*
  One-shot migration: splits the old single `users.role` column into
  `account_type` + a `roles` array, and adds the volunteer badge columns.

  This exists as explicit SQL rather than a `drizzle-kit push` because push
  works out the diff from the schema file alone: it would drop `role` in the
  same breath as it added `roles`, and the old values would be gone before
  anything could read them. There is no `drizzle/` migration history in this
  repo to put an ordered migration in, so the script is the record.

  Safe to run more than once — every statement checks first — and safe to run
  before or after `npm run db:push`.

    npx tsx src/scripts/migrate-roles.ts
*/
// Side-effect import, and first: `db` reads the connection string when its
// module is evaluated, and imports are hoisted above any call we could make.
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
  console.log("Adding the new columns...");
  await db.execute(sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS account_type varchar(20) NOT NULL DEFAULT 'member',
      ADD COLUMN IF NOT EXISTS roles varchar(30)[] NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS must_change_pin boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS department varchar(20),
      ADD COLUMN IF NOT EXISTS badge_code varchar(32)
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_badge_code_unique ON users (badge_code)
  `);
  await db.execute(sql`
    ALTER TABLE events
      ADD COLUMN IF NOT EXISTS for_volunteers boolean NOT NULL DEFAULT false
  `);

  // The backfill only has something to read the first time through.
  if (await hasColumn("users", "role")) {
    console.log("Backfilling account_type and roles from the old columns...");
    await db.execute(sql`
      UPDATE users SET account_type =
        CASE WHEN role = 'volunteer' THEN 'volunteer' ELSE 'member' END
    `);
    // "volunteer" was an account type, not a job, so it contributes no role.
    // The old volunteer-manager flag becomes the "coordinator" role.
    await db.execute(sql`
      UPDATE users SET roles = (
        SELECT COALESCE(ARRAY_AGG(r), '{}')
        FROM (
          SELECT 'admin'::varchar(30) AS r WHERE role = 'admin'
          UNION ALL
          SELECT 'organizer'::varchar(30) WHERE role = 'organizer'
          UNION ALL
          SELECT 'finance'::varchar(30) WHERE role = 'finance'
          UNION ALL
          SELECT 'coordinator'::varchar(30) WHERE is_volunteer_manager
        ) held
      )
    `);

    const { rows } = await db.execute(sql`
      SELECT account_type, roles, COUNT(*)::int AS count
      FROM users GROUP BY account_type, roles ORDER BY count DESC
    `);
    for (const row of rows) {
      console.log(`  ${row.count} × ${row.account_type} ${JSON.stringify(row.roles)}`);
    }

    console.log("Dropping the old columns...");
    await db.execute(sql`
      ALTER TABLE users
        DROP COLUMN IF EXISTS role,
        DROP COLUMN IF EXISTS is_volunteer_manager
    `);
  } else {
    console.log("Old `role` column is already gone — nothing to backfill.");
  }

  console.log("Done. `npm run db:push` should now report no changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
