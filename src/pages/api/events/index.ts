import type { NextApiRequest, NextApiResponse } from "next";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/db/schema";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const allEvents = await db.select().from(events).orderBy(desc(events.date));
    return res.status(200).json(allEvents);
  }

  if (req.method === "POST") {
    if (session.role !== "admin" && session.role !== "organizer") {
      return res.status(403).json({ error: "Only admins and organizers can create events" });
    }

    const { title, description, date, startTime, endTime, location } = req.body;
    if (!title || !date || !startTime || !endTime) {
      return res.status(400).json({ error: "Title, date, start time, and end time are required" });
    }

    const [event] = await db.insert(events).values({
      title,
      description,
      date,
      startTime,
      endTime,
      location,
      createdBy: session.userId,
    }).returning();

    return res.status(201).json(event);
  }

  res.status(405).json({ error: "Method not allowed" });
}
