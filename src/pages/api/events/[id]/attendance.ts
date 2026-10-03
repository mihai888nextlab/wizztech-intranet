import type { NextApiRequest, NextApiResponse } from "next";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendance, events, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { isVolunteer } from "@/lib/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const eventId = parseInt(req.query.id as string, 10);
  if (isNaN(eventId)) {
    return res.status(400).json({ error: "Invalid event ID" });
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) {
    return res.status(404).json({ error: "Event not found" });
  }
  // Matches the event route: an event a volunteer can't see, they can't sign
  // in to or read the attendee list of either.
  if (isVolunteer(session.accountType) && !event.forVolunteers) {
    return res.status(404).json({ error: "Event not found" });
  }

  if (req.method === "GET") {
    // Name the columns. `with: { user: true }` handed every signed-in viewer
    // the whole user row — password hash, roles and badge code included.
    const records = await db
      .select({
        id: attendance.id,
        signedInAt: attendance.signedInAt,
        user: {
          id: users.id,
          username: users.username,
          fullName: users.fullName,
        },
      })
      .from(attendance)
      .innerJoin(users, eq(attendance.userId, users.id))
      .where(eq(attendance.eventId, eventId));
    return res.status(200).json(records);
  }

  if (req.method === "POST") {
    const existing = await db.query.attendance.findFirst({
      where: and(
        eq(attendance.userId, session.userId),
        eq(attendance.eventId, eventId)
      ),
    });

    if (existing) {
      return res.status(409).json({ error: "Already signed in for this event" });
    }

    const [record] = await db.insert(attendance).values({
      userId: session.userId,
      eventId,
    }).returning();

    return res.status(201).json(record);
  }

  if (req.method === "DELETE") {
    await db.delete(attendance).where(
      and(
        eq(attendance.userId, session.userId),
        eq(attendance.eventId, eventId)
      )
    );
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
