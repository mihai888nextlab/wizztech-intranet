import type { NextApiRequest, NextApiResponse } from "next";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { attendance, events } from "@/db/schema";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const records = await db.select({
    id: attendance.id,
    eventId: attendance.eventId,
    signedInAt: attendance.signedInAt,
    event: {
      id: events.id,
      title: events.title,
      startDate: events.startDate,
      endDate: events.endDate,
      startTime: events.startTime,
      endTime: events.endTime,
    },
  })
    .from(attendance)
    .leftJoin(events, eq(attendance.eventId, events.id))
    .where(eq(attendance.userId, session.userId))
    .orderBy(desc(attendance.signedInAt));

  return res.status(200).json(records);
}
