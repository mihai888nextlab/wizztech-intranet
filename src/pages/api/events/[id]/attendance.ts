import type { NextApiRequest, NextApiResponse } from "next";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendance, events, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { blockMessage } from "@/lib/events";
import { signIn, signInBlock } from "@/lib/events.server";
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
    //
    // `userId` has to stay: the page compares it against the viewer to decide
    // whether to offer Sign in or Sign out. It came for free with the raw row
    // before, and dropping it silently turned the Sign out button back into a
    // Sign in that could only fail.
    const records = await db
      .select({
        id: attendance.id,
        userId: attendance.userId,
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

    // The rules are enforced inside the insert, so a place can't be taken
    // twice by two requests that both passed an earlier check.
    const record = await signIn(session.userId, event);
    if (!record) {
      // Nothing was inserted, so a rule refused. Work out which, to say so.
      const block = await signInBlock(session.userId, event);
      return res.status(409).json({
        error: block ? blockMessage(block) : "Could not sign you in",
        block,
      });
    }

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
