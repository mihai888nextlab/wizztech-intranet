import type { NextApiRequest, NextApiResponse } from "next";
import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { labSessions } from "@/db/schema";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const sessions = await db.select()
      .from(labSessions)
      .where(eq(labSessions.userId, session.userId))
      .orderBy(desc(labSessions.checkIn));
    return res.status(200).json(sessions);
  }

  if (req.method === "POST") {
    const { action, note, checkIn, checkOut, durationMinutes } = req.body;

    if (action === "check_in") {
      const active = await db.query.labSessions.findFirst({
        where: and(
          eq(labSessions.userId, session.userId),
          isNull(labSessions.checkOut)
        ),
      });
      if (active) {
        return res.status(409).json({ error: "You already have an active session. Check out first." });
      }

      const [sessionRecord] = await db.insert(labSessions).values({
        userId: session.userId,
        note: note || null,
      }).returning();

      return res.status(201).json(sessionRecord);
    }

    if (action === "check_out") {
      const active = await db.query.labSessions.findFirst({
        where: and(
          eq(labSessions.userId, session.userId),
          isNull(labSessions.checkOut)
        ),
      });
      if (!active) {
        return res.status(404).json({ error: "No active session found" });
      }

      const now = new Date();
      const duration = Math.round((now.getTime() - new Date(active.checkIn).getTime()) / 60000);

      const [updated] = await db.update(labSessions)
        .set({
          checkOut: now,
          durationMinutes: duration,
          note: note || active.note,
        })
        .where(eq(labSessions.id, active.id))
        .returning();

      return res.status(200).json(updated);
    }

    if (action === "manual") {
      if (!checkIn || !checkOut) {
        return res.status(400).json({ error: "Check-in and check-out times are required for manual entry" });
      }
      const calculatedDuration = durationMinutes || Math.round(
        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000
      );

      const [sessionRecord] = await db.insert(labSessions).values({
        userId: session.userId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        durationMinutes: calculatedDuration,
        note: note || null,
      }).returning();

      return res.status(201).json(sessionRecord);
    }

    return res.status(400).json({ error: "Invalid action. Use check_in, check_out, or manual." });
  }

  res.status(405).json({ error: "Method not allowed" });
}
