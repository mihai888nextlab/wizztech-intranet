/*
  One-shot migration: events gain an optional participant limit, and a table of
  "attendees of that event can't come to this one" rules.

  Purely additive — every existing event keeps no limit and no rules, which is
  how they have always behaved — so unlike the roles and department splits
  there is nothing to back-fill and nothing to lose. It is still explicit SQL
  rather than `drizzle-kit push` so the change is written down somewhere.

    npm run db:migrate-event-rules
*/
import "dotenv/config";

import { sql } from "drizzle-orm";
import { db } from "../lib/db";

async function main() {
  console.log("Adding the participant limit...");
  // No default: null is the limit-free case, and that is what every event
  // already is.
  await db.execute(sql`
    ALTER TABLE events ADD COLUMN IF NOT EXISTS capacity integer
  `);

  console.log("Creating the exclusion rules table...");
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS event_exclusions (
      id serial PRIMARY KEY,
      event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      blocked_by_event_id integer NOT NULL REFERENCES events(id) ON DELETE CASCADE
    )
  `);
  // One rule per pair; ticking the same event twice is the same rule.
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS event_exclusion_unique
      ON event_exclusions (event_id, blocked_by_event_id)
  `);

  const { rows } = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM events) AS events,
      (SELECT COUNT(*)::int FROM events WHERE capacity IS NOT NULL) AS capped,
      (SELECT COUNT(*)::int FROM event_exclusions) AS rules
  `);
  const { events, capped, rules } = rows[0];
  console.log(`  ${events} event(s): ${capped} with a limit, ${rules} exclusion rule(s)`);

  console.log("Done. `npm run db:push` should now report no changes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
