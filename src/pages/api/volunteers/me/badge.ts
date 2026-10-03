import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { isVolunteer } from "@/lib/roles";
import { ensureBadgeCode, pointsHistory, volunteerStandings } from "@/lib/volunteers.server";

/**
 * Everything the badge card prints. The badge code itself stays out of the
 * response — the page draws it through /api/volunteers/me/qr, so the token
 * never sits in a JSON payload or a client-side store.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAuth(req, res);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isVolunteer(session.accountType)) {
    return res.status(403).json({ error: "Not a volunteer account" });
  }

  // Minting the code here is what makes it lazy: volunteers who predate badges
  // get one the first time they open the page, with no backfill script.
  const [standings, history, me] = await Promise.all([
    volunteerStandings(),
    pointsHistory(session.userId),
    db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: { fullName: true, departments: true },
    }),
    ensureBadgeCode(session.userId),
  ]);

  const mine = standings.find((s) => s.userId === session.userId);

  res.status(200).json({
    // Fresh from the row, so a coordinator renaming them or setting their
    // departments show up without them signing out.
    fullName: me?.fullName ?? session.fullName,
    username: session.username,
    departments: me?.departments ?? [],
    points: history.reduce((sum, award) => sum + award.amount, 0),
    rank: mine?.rank ?? null,
    total: standings.length,
  });
}
