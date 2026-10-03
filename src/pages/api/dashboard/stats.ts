import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, events, attendance, labSessions } from "@/db/schema";
import { currentRoles, getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  // Fresh from the database, not the cookie, so a role change applies at once.
  const roles = await currentRoles(session);

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
    .where(sql`end_date >= CURRENT_DATE`)
    .orderBy(events.startDate)
    .limit(5);

  if (isAdmin(roles)) {
    // Roles are an array now, so a plain GROUP BY would count combinations
    // ("organizer + coordinator") rather than roles. Unnesting counts the
    // people holding each job, and someone with two jobs is counted in both.
    const { rows: roleRows } = await db.execute(sql`
      SELECT unnest(roles) AS role, COUNT(*)::int AS count
      FROM users GROUP BY 1 ORDER BY count DESC, role
    `);
    // Plain members hold no roles at all, so they'd be invisible above.
    const { rows: typeRows } = await db.execute(sql`
      SELECT account_type, COUNT(*)::int AS count FROM users GROUP BY 1
    `);
    const countOf = (type: string) =>
      Number(typeRows.find((r) => r.account_type === type)?.count ?? 0);

    return res.status(200).json({
      totalUsers: Number(totalUsers[0].count),
      memberCount: countOf("member"),
      volunteerCount: countOf("volunteer"),
      userRoleCounts: roleRows,
      totalEvents: Number(totalEvents[0].count),
      totalAttendance: Number(totalAttendance[0].count),
      totalLabHours: Math.round(Number(totalLabMinutes[0].total) / 60),
      activeLabSessions: Number(activeLabSessions[0].count),
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
