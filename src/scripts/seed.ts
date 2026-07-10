import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { pgTable, serial, varchar, timestamp, date, time, text } from "drizzle-orm/pg-core";

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  location: varchar("location", { length: 255 }),
  createdBy: serial("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
    role: "admin",
  }).returning();

  console.log(`Admin user created:`);
  console.log(`  Username: ${user.username}`);
  console.log(`  Full Name: ${user.fullName}`);
  console.log(`  PIN: ${password}`);
  console.log(`  Role: ${user.role}`);
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

async function seed() {
  const connection = neon(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  const adminId = await ensureAdmin(db);

  console.log("Seeding events...");
  await seedEvents(db, adminId);

  console.log("Seed complete.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
