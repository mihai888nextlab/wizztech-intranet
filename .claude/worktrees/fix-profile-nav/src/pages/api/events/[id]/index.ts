import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { events } from "@/db/schema";
import { getSession } from "@/lib/auth";

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
    return res.status(200).json(event);
  }

  if (session.role !== "admin" && session.role !== "organizer") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (req.method === "PATCH") {
    const { title, description, startDate, endDate, startTime, endTime, location } = req.body;
    const updateData: Record<string, string> = {};
    if (title) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;
    if (startTime) updateData.startTime = startTime;
    if (endTime) updateData.endTime = endTime;
    if (location !== undefined) updateData.location = location;

    const [updated] = await db.update(events)
      .set(updateData)
      .where(eq(events.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Event not found" });
    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    await db.delete(events).where(eq(events.id, id));
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
