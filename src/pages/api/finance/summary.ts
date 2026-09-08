import type { NextApiRequest, NextApiResponse } from "next";

import { getSession } from "@/lib/auth";
import { seasonSummary } from "@/lib/finance.server";

/** Totals and chart series for one season. Readable by the whole team. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const seasonId = parseInt(req.query.seasonId as string, 10);
  if (isNaN(seasonId)) {
    return res.status(400).json({ error: "A season is required" });
  }

  return res.status(200).json(await seasonSummary(seasonId));
}
