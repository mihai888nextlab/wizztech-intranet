import type { NextApiRequest, NextApiResponse } from "next";
import { requireVolunteerManager } from "@/lib/auth";
import { sendBadgeQr } from "@/lib/badge.server";
import { ensureBadgeCode, findVolunteer } from "@/lib/volunteers.server";

/** The same QR a volunteer sees, so a coordinator can print the crew's badges. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireVolunteerManager(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid volunteer ID" });
  }

  // findVolunteer refuses anyone who isn't a volunteer, so this can't be used
  // to read a team member's badge.
  const volunteer = await findVolunteer(id);
  if (!volunteer) {
    return res.status(404).json({ error: "Volunteer not found" });
  }

  await sendBadgeQr(req, res, await ensureBadgeCode(id));
}
