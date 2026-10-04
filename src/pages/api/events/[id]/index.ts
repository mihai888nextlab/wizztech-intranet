import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/db/schema";
import { getSession, requireOrganizer } from "@/lib/auth";
import { parseEventRules } from "@/lib/events";
import {
  attendeeCount,
  exclusionsFor,
  setExclusions,
  signInBlock,
} from "@/lib/events.server";
import { isVolunteer } from "@/lib/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid event ID" });
  }

  if (req.method === "GET") {
    const event = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!event) return res.status(404).json({ error: "Event not found" });
    // A team event a volunteer was never shown shouldn't become visible just
    // because they guessed the id — so it reads as missing, not as forbidden.
    if (isVolunteer(session.accountType) && !event.forVolunteers) {
      return res.status(404).json({ error: "Event not found" });
    }

    // The page needs the rules and where the viewer stands against them, so
    // the sign-in button can explain itself instead of just failing.
    const [count, exclusions, block] = await Promise.all([
      attendeeCount(id),
      exclusionsFor(id),
      signInBlock(session.userId, event),
    ]);

    return res.status(200).json({
      ...event,
      attendeeCount: count,
      exclusions,
      signInBlock: block,
    });
  }

  if (!(await requireOrganizer(req, res))) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (req.method === "PATCH") {
    const { title, description, startDate, endDate, startTime, endTime, location, forVolunteers } = req.body;
    // null is meaningful here: it's how a cleared location or description
    // empties the column instead of storing a blank string.
    const updateData: Record<string, string | number | boolean | null> = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (location !== undefined) updateData.location = location;
    if (forVolunteers !== undefined) updateData.forVolunteers = forVolunteers === true;

    const rules = parseEventRules(req.body, id);
    if (!rules.ok) {
      return res.status(400).json({ error: rules.error });
    }
    if (req.body?.capacity !== undefined) updateData.capacity = rules.value.capacity;

    // The exclusion rules live in their own table, so changing only those is
    // still a change — counting columns alone would call it an empty request.
    const settingExclusions = req.body?.exclusionEventIds !== undefined;
    if (Object.keys(updateData).length === 0 && !settingExclusions) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const existing = await db.query.events.findFirst({ where: eq(events.id, id) });
    if (!existing) return res.status(404).json({ error: "Event not found" });

    // Checked against the state the row would end up in, not just what was
    // sent: moving the start date past an untouched end date is the easy way
    // to invert an event, and nothing downstream expects that.
    const resultingStart = (updateData.startDate as string) ?? existing.startDate;
    const resultingEnd = (updateData.endDate as string) ?? existing.endDate;
    if (resultingEnd < resultingStart) {
      return res.status(400).json({ error: "The end date can't be before the start date" });
    }

    // Drizzle refuses an empty `set`, so skip it when only rules changed.
    const updated =
      Object.keys(updateData).length > 0
        ? (
            await db.update(events)
              .set(updateData)
              .where(eq(events.id, id))
              .returning()
          )[0]
        : existing;

    if (settingExclusions) {
      await setExclusions(id, rules.value.exclusionIds);
    }

    return res.status(200).json({
      ...updated,
      attendeeCount: await attendeeCount(id),
      exclusions: await exclusionsFor(id),
    });
  }

  if (req.method === "DELETE") {
    await db.delete(events).where(eq(events.id, id));
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
