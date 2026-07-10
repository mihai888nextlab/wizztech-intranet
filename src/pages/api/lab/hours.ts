import type { NextApiRequest, NextApiResponse } from "next";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { labSessions } from "@/db/schema";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const result = await db.select({
    totalMinutes: sql<number>`COALESCE(SUM(${labSessions.durationMinutes}), 0)`,
    totalSessions: sql<number>`COUNT(*)`,
  }).from(labSessions)
    .where(eq(labSessions.userId, session.userId));

  res.status(200).json(result[0]);
}
