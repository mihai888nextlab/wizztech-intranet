import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

// Imported rather than redeclared: the local copies that used to live here had
// drifted from the real schema (varchar(255) where the table says 200, a
// non-null created_by where the column is nullable), so a seed could write
// rows the app itself would never produce.
import {
  events,
  financeCategories,
  financeSeasons,
  users,
} from "../db/schema";

async function ensureAdmin(db: ReturnType<typeof drizzle>) {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "0000";
  const fullName = process.env.ADMIN_FULLNAME || "Admin User";

  const result = await db.execute(
    sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`
  );

  if (result.rowCount && result.rowCount > 0) {
    console.log(`Admin user "${username}" already exists.`);
    const row = result.rows[0] as { id: number };
    return row.id;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.insert(users).values({
    username,
    fullName,
    passwordHash,
    accountType: "member",
    roles: ["admin"],
    // The seeded admin is the way in on a fresh install, so it keeps the PIN
    // it was given rather than being bounced to /set-pin before anyone exists
    // who could reset it.
    mustChangePin: false,
  }).returning();

  console.log(`Admin user created:`);
  console.log(`  Username: ${user.username}`);
  console.log(`  Full Name: ${user.fullName}`);
  console.log(`  PIN: ${password}`);
  console.log(`  Roles: ${user.roles.join(", ")}`);
  return user.id;
}

async function seedEvents(db: ReturnType<typeof drizzle>, adminId: number) {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  const samples = [
    {
      title: "Build Season Kickoff",
      description: "Official kickoff meeting for the build season. Pizza will be provided!",
      startDate: fmt(nextWeek),
      endDate: fmt(nextWeek),
      startTime: "10:00",
      endTime: "16:00",
      location: "Robotics Lab",
    },
    {
      title: "Weekend Workshop",
      description: "Two-day workshop covering CAD and machining fundamentals.",
      startDate: fmt(nextWeek),
      endDate: fmt(nextMonth),
      startTime: "09:00",
      endTime: "17:00",
      location: "Makerspace",
    },
    {
      title: "Outreach Event – Demo Day",
      description: "Showcase our robot to the community at the local library.",
      startDate: fmt(nextWeek),
      endDate: fmt(nextWeek),
      startTime: "11:00",
      endTime: "15:00",
      location: "Downtown Library",
      // Outreach is where volunteers help, so this is the one that shows up
      // for them — the other two stay team-only.
      forVolunteers: true,
    },
  ];

  for (const evt of samples) {
    const exists = await db.execute(
      sql`SELECT id FROM events WHERE title = ${evt.title} LIMIT 1`
    );
    if (exists.rowCount && exists.rowCount > 0) {
      console.log(`  Event "${evt.title}" already exists, skipping.`);
      continue;
    }
    await db.insert(events).values({
      ...evt,
      description: evt.description ?? null,
      location: evt.location ?? null,
      createdBy: adminId,
    });
    console.log(`  Created event: "${evt.title}"`);
  }
}

/**
 * A season and a starter set of headings, so the finance page opens onto
 * something usable instead of an empty settings tab. Colours are the --chart-N
 * slots, spread so the busiest categories do not land on neighbouring hues.
 */
async function seedFinance(db: ReturnType<typeof drizzle>) {
  const year = new Date().getFullYear();
  // An FTC season runs September to April, so before September the team is
  // still finishing the season that started the previous year.
  const startYear = new Date().getMonth() >= 8 ? year : year - 1;
  const name = `${startYear}-${String(startYear + 1).slice(2)} season`;

  const exists = await db.execute(
    sql`SELECT id FROM finance_seasons LIMIT 1`
  );
  if (exists.rowCount && exists.rowCount > 0) {
    console.log("  Finance seasons already exist, skipping.");
  } else {
    await db.insert(financeSeasons).values({
      name,
      startDate: `${startYear}-09-01`,
      endDate: `${startYear + 1}-04-30`,
      isCurrent: true,
    });
    console.log(`  Created season: "${name}"`);
  }

  const categories = [
    { name: "Sponsorship", kind: "income", colorIndex: 1 },
    { name: "Grants", kind: "income", colorIndex: 3 },
    { name: "Fundraising", kind: "income", colorIndex: 5 },
    { name: "Team fees", kind: "income", colorIndex: 2 },
    { name: "Registration", kind: "expense", colorIndex: 1 },
    { name: "Parts & materials", kind: "expense", colorIndex: 2 },
    { name: "Tools", kind: "expense", colorIndex: 3 },
    { name: "Travel", kind: "expense", colorIndex: 4 },
    { name: "Marketing", kind: "expense", colorIndex: 5 },
    { name: "Other", kind: "expense", colorIndex: 3 },
  ];

  for (const category of categories) {
    const found = await db.execute(
      sql`SELECT id FROM finance_categories WHERE name = ${category.name} AND kind = ${category.kind} LIMIT 1`
    );
    if (found.rowCount && found.rowCount > 0) continue;
    await db.insert(financeCategories).values(category);
    console.log(`  Created category: "${category.name}" (${category.kind})`);
  }
}

async function seed() {
  const connection = neon(process.env.NEON_DATABASE_URL!);
  const db = drizzle(connection);

  const adminId = await ensureAdmin(db);

  console.log("Seeding events...");
  await seedEvents(db, adminId);

  console.log("Seeding finance...");
  await seedFinance(db);

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
