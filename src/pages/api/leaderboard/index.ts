import type { NextApiRequest, NextApiResponse } from "next";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.roles,
      COALESCE(a.event_count, 0) AS events_attended,
      COALESCE(l.total_minutes, 0) AS total_minutes
    FROM users u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS event_count
      FROM attendance
      GROUP BY user_id
    ) a ON a.user_id = u.id
    LEFT JOIN (
      SELECT user_id, SUM(duration_minutes) AS total_minutes
      FROM lab_sessions
      WHERE duration_minutes IS NOT NULL
      GROUP BY user_id
    ) l ON l.user_id = u.id
    -- Volunteers have their own points-based ranking at /api/volunteers/leaderboard.
    WHERE u.account_type <> 'volunteer'
    ORDER BY (COALESCE(a.event_count, 0) * 60 + COALESCE(l.total_minutes, 0)) DESC
  `);

  const leaderboard = rows.rows.map((row: Record<string, unknown>, index: number) => ({
    rank: index + 1,
    userId: row.id,
    username: row.username,
    fullName: row.full_name,
    roles: (row.roles ?? []) as string[],
    eventsAttended: Number(row.events_attended),
    totalMinutes: Number(row.total_minutes),
    score: Number(row.events_attended) * 60 + Number(row.total_minutes),
  }));

  res.status(200).json(leaderboard);
}
