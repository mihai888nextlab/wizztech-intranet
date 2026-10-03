import type { NextApiRequest, NextApiResponse } from "next";
import { requireAuth } from "@/lib/auth";
import { isVolunteer } from "@/lib/roles";
import { sendBadgeQr } from "@/lib/badge.server";
import { ensureBadgeCode } from "@/lib/volunteers.server";

/** A volunteer's own badge QR. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAuth(req, res);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isVolunteer(session.accountType)) {
    return res.status(403).json({ error: "Not a volunteer account" });
  }

  await sendBadgeQr(req, res, await ensureBadgeCode(session.userId));
}
