import { and, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { attendance, eventExclusions, events } from "@/db/schema";
import type { SignInBlock } from "@/lib/events";

/** How many people are signed in to each of the given events. */
export async function attendeeCounts(eventIds: number[]) {
  if (eventIds.length === 0) return new Map<number, number>();
  const rows = await db
    .select({
      eventId: attendance.eventId,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(attendance)
    .where(inArray(attendance.eventId, eventIds))
    .groupBy(attendance.eventId);
  return new Map(rows.map((r) => [r.eventId, r.count]));
}

export async function attendeeCount(eventId: number) {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(attendance)
    .where(eq(attendance.eventId, eventId));
  return row?.count ?? 0;
}

/** The events whose attendees may not sign in to this one, with their titles. */
export async function exclusionsFor(eventId: number) {
  const blocker = alias(events, "blocker");
  return db
    .select({ id: blocker.id, title: blocker.title })
    .from(eventExclusions)
    .innerJoin(blocker, eq(eventExclusions.blockedByEventId, blocker.id))
    .where(eq(eventExclusions.eventId, eventId))
    .orderBy(blocker.title);
}

/** The same, for several events at once — the list endpoint needs all of them. */
export async function exclusionsByEvent(eventIds: number[]) {
  const grouped = new Map<number, { id: number; title: string }[]>();
  if (eventIds.length === 0) return grouped;

  const blocker = alias(events, "blocker");
  const rows = await db
    .select({
      eventId: eventExclusions.eventId,
      id: blocker.id,
      title: blocker.title,
    })
    .from(eventExclusions)
    .innerJoin(blocker, eq(eventExclusions.blockedByEventId, blocker.id))
    .where(inArray(eventExclusions.eventId, eventIds))
    .orderBy(blocker.title);

  for (const row of rows) {
    const list = grouped.get(row.eventId) ?? [];
    list.push({ id: row.id, title: row.title });
    grouped.set(row.eventId, list);
  }
  return grouped;
}

/**
 * Replaces an event's exclusion rules with exactly this set. Delete-then-insert
 * rather than diffing: the list is a handful of rows and the table holds no
 * other state, so the simpler write is the one that can't drift.
 */
export async function setExclusions(eventId: number, blockedByEventIds: number[]) {
  await db.delete(eventExclusions).where(eq(eventExclusions.eventId, eventId));
  if (blockedByEventIds.length === 0) return;
  await db.insert(eventExclusions).values(
    blockedByEventIds.map((blockedByEventId) => ({ eventId, blockedByEventId }))
  );
}

/** Which of this event's excluded events the person actually attended. */
export async function blockingAttendance(userId: number, eventId: number) {
  const blocker = alias(events, "blocker");
  return db
    .select({ id: blocker.id, title: blocker.title })
    .from(eventExclusions)
    .innerJoin(blocker, eq(eventExclusions.blockedByEventId, blocker.id))
    .innerJoin(
      attendance,
      and(eq(attendance.eventId, blocker.id), eq(attendance.userId, userId))
    )
    .where(eq(eventExclusions.eventId, eventId))
    .orderBy(blocker.title);
}

/**
 * Why this person can't sign in to this event, or null if they can. Used to
 * explain a disabled button, and to say what happened when a sign-in is
 * refused — `signIn` itself does the enforcing.
 */
export async function signInBlock(
  userId: number,
  event: { id: number; capacity: number | null }
): Promise<SignInBlock | null> {
  const blocking = await blockingAttendance(userId, event.id);
  if (blocking.length > 0) {
    return { reason: "excluded", events: blocking.map((e) => e.title) };
  }
  if (event.capacity !== null && (await attendeeCount(event.id)) >= event.capacity) {
    return { reason: "full" };
  }
  return null;
}

/**
 * Signs someone in, but only if both rules allow it — checked inside the
 * INSERT so a sign-in can't be waved through by a check that ran a moment
 * earlier. Returns null when nothing was inserted, which means a rule refused.
 *
 * One caveat worth knowing: Postgres reads this statement against a single
 * snapshot, and the Neon HTTP driver can't open an interactive transaction to
 * lock the event row first (`db.transaction` throws there). So two sign-ins
 * landing in the same instant can both see the last free place and a capped
 * event can end up one over. The window is a single statement wide, and the
 * fix is for a coordinator to sign one person out — worth hardening with a
 * slot column and a unique index if this team ever runs a cap that people
 * race for.
 */
export async function signIn(
  userId: number,
  event: { id: number; capacity: number | null }
) {
  const capacity = event.capacity;
  const { rows } = await db.execute(sql`
    INSERT INTO attendance (user_id, event_id)
    SELECT ${userId}, ${event.id}
    WHERE NOT EXISTS (
      SELECT 1 FROM event_exclusions x
      JOIN attendance a ON a.event_id = x.blocked_by_event_id
      WHERE x.event_id = ${event.id} AND a.user_id = ${userId}
    )
    AND (
      ${capacity}::int IS NULL
      OR (SELECT COUNT(*) FROM attendance WHERE event_id = ${event.id}) < ${capacity}::int
    )
    RETURNING id, user_id AS "userId", event_id AS "eventId", signed_in_at AS "signedInAt"
  `);
  return rows[0] ?? null;
}
