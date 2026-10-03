import { randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { events, users, volunteerPoints } from "@/db/schema";
import {
  OVERALL_BOARD,
  rankVolunteers,
  VOLUNTEER_DEPARTMENTS,
  type LeaderboardBoard,
  type VolunteerDepartment,
} from "@/lib/volunteers";

/**
 * One board's standings, ranked. `overall` sums every award a volunteer holds;
 * a department sums only the awards earned in it.
 *
 * Who appears on a department board is deliberately wider than "has points in
 * it": everyone assigned to that department is listed, even on zero, so a
 * coordinator can see who hasn't been credited yet — and so is anyone who
 * earned points there without being on the team, since an award may be given
 * outside a volunteer's own departments.
 */
export async function volunteerStandings(board: LeaderboardBoard = OVERALL_BOARD) {
  const department = board === OVERALL_BOARD ? null : board;

  // The join is narrowed rather than the result, so a volunteer with points in
  // another department still shows on this board as a zero rather than
  // carrying their Engineering total onto the Media board.
  const pointsJoin = department
    ? and(
        eq(volunteerPoints.userId, users.id),
        eq(volunteerPoints.department, department)
      )
    : eq(volunteerPoints.userId, users.id);

  const rows = await db
    .select({
      userId: users.id,
      fullName: users.fullName,
      username: users.username,
      departments: users.departments,
      points: sql<number>`COALESCE(SUM(${volunteerPoints.amount}), 0)::int`,
      awards: sql<number>`COUNT(${volunteerPoints.id})::int`,
    })
    .from(users)
    .leftJoin(volunteerPoints, pointsJoin)
    .where(eq(users.accountType, "volunteer"))
    .groupBy(users.id);

  const eligible = department
    ? rows.filter(
        (row) => row.departments.includes(department) || row.awards > 0
      )
    : rows;

  const byId = new Map(eligible.map((r) => [r.userId, r]));
  return rankVolunteers(eligible).map((standing) => {
    const row = byId.get(standing.userId)!;
    return {
      ...standing,
      username: row.username,
      departments: row.departments,
      awards: row.awards,
    };
  });
}

/**
 * One volunteer's total per department, every department present even on zero,
 * so their own page can show the split rather than one opaque number.
 */
export async function departmentTotals(userId: number) {
  const rows = await db
    .select({
      department: volunteerPoints.department,
      points: sql<number>`COALESCE(SUM(${volunteerPoints.amount}), 0)::int`,
      awards: sql<number>`COUNT(${volunteerPoints.id})::int`,
    })
    .from(volunteerPoints)
    .where(eq(volunteerPoints.userId, userId))
    .groupBy(volunteerPoints.department);

  const byDepartment = new Map(rows.map((r) => [r.department, r]));
  return VOLUNTEER_DEPARTMENTS.map((department) => ({
    department,
    points: byDepartment.get(department)?.points ?? 0,
    awards: byDepartment.get(department)?.awards ?? 0,
  }));
}

/**
 * Where one volunteer sits on each department board, so their own page can say
 * "3rd of 28 in Engineering" without fetching five whole leaderboards.
 */
export async function departmentRanks(userId: number) {
  const entries = await Promise.all(
    VOLUNTEER_DEPARTMENTS.map(async (department) => {
      const standings = await volunteerStandings(department);
      const mine = standings.find((s) => s.userId === userId);
      return [
        department,
        { rank: mine?.rank ?? null, total: standings.length },
      ] as const;
    })
  );
  return Object.fromEntries(entries) as Record<
    VolunteerDepartment,
    { rank: number | null; total: number }
  >;
}

/** A volunteer's awards, newest first, with the event and who gave them. */
export async function pointsHistory(userId: number) {
  const awarder = alias(users, "awarder");
  return db
    .select({
      id: volunteerPoints.id,
      amount: volunteerPoints.amount,
      reason: volunteerPoints.reason,
      department: volunteerPoints.department,
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
    where: and(eq(users.id, id), eq(users.accountType, "volunteer")),
  });
}

/**
 * The volunteer's badge token, generating it on first use. Doing it lazily
 * means volunteers who existed before badges did need no backfill, and a token
 * is never minted for an account that never looks at its badge.
 *
 * 12 random bytes is far more than a QR needs to be unguessable, and base64url
 * keeps it safe to drop straight into the URL the code encodes.
 */
export async function ensureBadgeCode(userId: number): Promise<string> {
  const existing = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { badgeCode: true },
  });
  if (existing?.badgeCode) return existing.badgeCode;

  const badgeCode = newBadgeCode();
  const [updated] = await db
    .update(users)
    .set({ badgeCode })
    .where(eq(users.id, userId))
    .returning({ badgeCode: users.badgeCode });
  return updated.badgeCode!;
}

export function newBadgeCode() {
  return randomBytes(12).toString("base64url");
}
