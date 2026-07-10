import { pgTable, serial, varchar, text, timestamp, time, date, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 50 }).unique().notNull(),
  fullName: varchar("full_name", { length: 100 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  location: varchar("location", { length: 200 }),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  signedInAt: timestamp("signed_in_at").defaultNow().notNull(),
}, (table) => ({
  userEventUnique: uniqueIndex("user_event_unique").on(table.userId, table.eventId),
}));

export const labSessions = pgTable("lab_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  checkIn: timestamp("check_in").defaultNow().notNull(),
  checkOut: timestamp("check_out"),
  durationMinutes: integer("duration_minutes"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  attendance: many(attendance),
  labSessions: many(labSessions),
  createdEvents: many(events),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, { fields: [events.createdBy], references: [users.id] }),
  attendance: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  user: one(users, { fields: [attendance.userId], references: [users.id] }),
  event: one(events, { fields: [attendance.eventId], references: [events.id] }),
}));

export const labSessionsRelations = relations(labSessions, ({ one }) => ({
  user: one(users, { fields: [labSessions.userId], references: [users.id] }),
}));
