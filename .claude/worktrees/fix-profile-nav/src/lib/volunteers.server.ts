import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { events, users, volunteerPoints } from "@/db/schema";
import { rankVolunteers } from "@/lib/volunteers";

/** Every volunteer with their total, ranked — including those on zero. */
export async function volunteerStandings() {
  const rows = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      username: users.username,
      points: sql<number>`COALESCE(SUM(${volunteerPoints.amount}), 0)::int`,
      awards: sql<number>`COUNT(${volunteerPoints.id})::int`,
    })
    .from(users)
    .leftJoin(volunteerPoints, eq(volunteerPoints.userId, users.id))
    .where(eq(users.role, "volunteer"))
    .groupBy(users.id);

  const byId = new Map(rows.map((r) => [r.userId, r]));
  return rankVolunteers(rows).map((standing) => {
    const row = byId.get(standing.userId)!;
    return { ...standing, username: row.username, awards: row.awards };
  });
}

/** A volunteer's awards, newest first, with the event and who gave them. */
export async function pointsHistory(userId: number) {
  const awarder = alias(users, "awarder");
  return db
    .select({
      id: volunteerPoints.id,
      amount: volunteerPoints.amount,
      reason: volunteerPoints.reason,
      createdAt: volunteerPoints.createdAt,
      event: { id: events.id, title: events.title },
      awardedBy: awarder.fullName,
    })
    .from(volunteerPoints)
    .leftJoin(events, eq(volunteerPoints.eventId, events.id))
    .leftJoin(awarder, eq(volunteerPoints.awardedBy, awarder.id))
    .where(eq(volunteerPoints.userId, userId))
    .orderBy(desc(volunteerPoints.createdAt), desc(volunteerPoints.id));
}

/** The user row, only if it belongs to a volunteer — managers can't touch anyone else. */
export async function findVolunteer(id: number) {
  return db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.role, "volunteer")),
  });
}
