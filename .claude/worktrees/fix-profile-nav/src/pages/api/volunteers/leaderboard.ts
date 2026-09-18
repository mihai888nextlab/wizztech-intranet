import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/auth";
import { volunteerStandings } from "@/lib/volunteers.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Names and points only: volunteers can see this, and usernames are logins.
  const standings = await volunteerStandings();
  res.status(200).json(standings.map(({ userId, fullName, points, rank }) => ({
    userId,
    fullName,
    points,
    rank,
  })));
}
