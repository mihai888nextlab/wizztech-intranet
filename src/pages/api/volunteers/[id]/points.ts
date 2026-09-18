import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events, volunteerPoints } from "@/db/schema";
import { requireVolunteerManager } from "@/lib/auth";
import { parseAwardInput } from "@/lib/volunteers";
import { findVolunteer } from "@/lib/volunteers.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireVolunteerManager(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid volunteer ID" });
  }

  if (!(await findVolunteer(id))) {
    return res.status(404).json({ error: "Volunteer not found" });
  }

  const parsed = parseAwardInput(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }
  const { amount, reason, eventId } = parsed.value;

  if (eventId !== null) {
    const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
    if (!event) {
      return res.status(400).json({ error: "Event not found" });
    }
  }

  const [award] = await db.insert(volunteerPoints).values({
    userId: id,
    amount,
    reason,
    eventId,
    awardedBy: session.userId,
  }).returning();

  res.status(201).json(award);
}
