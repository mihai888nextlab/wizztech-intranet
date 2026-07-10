import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, events, attendance, labSessions } from "@/db/schema";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const totalUsers = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
  const totalEvents = await db.select({ count: sql<number>`COUNT(*)` }).from(events);
  const totalAttendance = await db.select({ count: sql<number>`COUNT(*)` }).from(attendance);
  const totalLabMinutes = await db.select({
    total: sql<number>`COALESCE(SUM(${labSessions.durationMinutes}), 0)`,
  }).from(labSessions);
  const activeLabSessions = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(labSessions).where(sql`check_out IS NULL`);

  const upcomingEvents = await db.select()
    .from(events)
    .where(sql`date >= CURRENT_DATE`)
    .orderBy(events.date)
    .limit(5);

  if (session.role === "admin") {
    const userRoleCounts = await db.select({
      role: users.role,
      count: sql<number>`COUNT(*)`,
    }).from(users).groupBy(users.role);

    return res.status(200).json({
      totalUsers: Number(totalUsers[0].count),
      totalEvents: Number(totalEvents[0].count),
      totalAttendance: Number(totalAttendance[0].count),
      totalLabHours: Math.round(Number(totalLabMinutes[0].total) / 60),
      activeLabSessions: Number(activeLabSessions[0].count),
      userRoleCounts,
      upcomingEvents,
    });
  }

  return res.status(200).json({
    totalEvents: Number(totalEvents[0].count),
    totalAttendance: Number(totalAttendance[0].count),
    totalLabHours: Math.round(Number(totalLabMinutes[0].total) / 60),
    activeLabSessions: Number(activeLabSessions[0].count),
    upcomingEvents,
  });
}
