import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { pgTable, serial, varchar, timestamp } from "drizzle-orm/pg-core";

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

async function seed() {
  const connection = neon(process.env.DATABASE_URL!);
  const db = drizzle(connection);

  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "0000";
  const fullName = process.env.ADMIN_FULLNAME || "Admin User";

  const result = await db.execute(
    sql`SELECT id FROM users WHERE username = ${username} LIMIT 1`
  );

  if (result.rowCount && result.rowCount > 0) {
    console.log(`Skipping: admin user "${username}" already exists.`);
    return;
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
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
