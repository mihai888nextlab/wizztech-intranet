import type { NextApiRequest, NextApiResponse } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/db/schema";
import { getSession, requireOrganizer } from "@/lib/auth";
import { isVolunteer } from "@/lib/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    // Volunteers only see what was opened to them; the team sees everything.
    // An undefined `where` is a no-op in drizzle, so this needs no branch.
    const allEvents = await db
      .select()
      .from(events)
      .where(isVolunteer(session.accountType) ? eq(events.forVolunteers, true) : undefined)
      .orderBy(desc(events.startDate));
    return res.status(200).json(allEvents);
  }

  if (req.method === "POST") {
    if (!(await requireOrganizer(req, res))) {
      return res.status(403).json({ error: "Only admins and organizers can create events" });
    }

    const { title, description, startDate, endDate, startTime, endTime, location, forVolunteers } = req.body;
    if (!title || !startDate || !endDate || !startTime || !endTime) {
      return res.status(400).json({ error: "Title, start date, end date, start time, and end time are required" });
    }
    // ISO dates compare correctly as strings, which is also how the Events
    // page splits upcoming from past.
    if (endDate < startDate) {
      return res.status(400).json({ error: "The end date can't be before the start date" });
    }

    const [event] = await db.insert(events).values({
      title,
      description,
      startDate,
      endDate,
      startTime,
      endTime,
      location,
      forVolunteers: forVolunteers === true,
      createdBy: session.userId,
    }).returning();

    return res.status(201).json(event);
  }

  res.status(405).json({ error: "Method not allowed" });
}
