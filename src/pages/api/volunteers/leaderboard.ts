import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/auth";
import { isLeaderboardBoard, OVERALL_BOARD } from "@/lib/volunteers";
import { volunteerStandings } from "@/lib/volunteers.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // ?board=overall, or one of the four departments.
  const board = req.query.board ?? OVERALL_BOARD;
  if (!isLeaderboardBoard(board)) {
    return res.status(400).json({ error: "Unknown leaderboard" });
  }

  // Names and points only: volunteers can see this, and usernames are logins.
  const standings = await volunteerStandings(board);
  res.status(200).json(standings.map(({ userId, fullName, points, rank }) => ({
    userId,
    fullName,
    points,
    rank,
  })));
}
