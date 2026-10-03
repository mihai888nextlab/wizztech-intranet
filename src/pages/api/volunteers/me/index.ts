import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { isVolunteer } from "@/lib/roles";
import { parseDepartments } from "@/lib/volunteers";
import {
  departmentRanks,
  departmentTotals,
  pointsHistory,
  volunteerStandings,
} from "@/lib/volunteers.server";

/**
 * A volunteer's own points, and the one field they may edit about themselves.
 * GET keeps the shape /points has always relied on.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAuth(req, res);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const [standings, history, byDepartment, ranks] = await Promise.all([
      volunteerStandings(),
      pointsHistory(session.userId),
      departmentTotals(session.userId),
      departmentRanks(session.userId),
    ]);
    const mine = standings.find((s) => s.userId === session.userId);

    return res.status(200).json({
      points: history.reduce((sum, award) => sum + award.amount, 0),
      rank: mine?.rank ?? null,
      total: standings.length,
      // The split, so a volunteer can see which team they're earning in.
      byDepartment: byDepartment.map((row) => ({
        ...row,
        rank: ranks[row.department].rank,
        total: ranks[row.department].total,
      })),
      // Who gave the points is between the managers; the reason is what matters here.
      history: history.map(({ id, amount, reason, department, createdAt, event }) => ({
        id,
        amount,
        reason,
        department,
        createdAt,
        event,
      })),
    });
  }

  if (req.method === "PATCH") {
    // Only volunteers have departments, so only they have anything to patch.
    if (!isVolunteer(session.accountType)) {
      return res.status(403).json({ error: "Not a volunteer account" });
    }

    const departments = parseDepartments(req.body?.departments);
    if (departments === null) {
      return res.status(400).json({ error: "Invalid departments" });
    }

    const [updated] = await db
      .update(users)
      .set({ departments })
      .where(eq(users.id, session.userId))
      .returning({ departments: users.departments });

    return res.status(200).json({ departments: updated.departments });
  }

  res.status(405).json({ error: "Method not allowed" });
}
