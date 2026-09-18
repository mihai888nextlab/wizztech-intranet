import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/auth";
import { pointsHistory, volunteerStandings } from "@/lib/volunteers.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const [standings, history] = await Promise.all([
    volunteerStandings(),
    pointsHistory(session.userId),
  ]);
  const mine = standings.find((s) => s.userId === session.userId);

  res.status(200).json({
    points: history.reduce((sum, award) => sum + award.amount, 0),
    rank: mine?.rank ?? null,
    total: standings.length,
    // Who gave the points is between the managers; the reason is what matters here.
    history: history.map(({ id, amount, reason, createdAt, event }) => ({
      id,
      amount,
      reason,
      createdAt,
      event,
    })),
  });
}
