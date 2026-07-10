import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { labSessions } from "@/db/schema";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const active = await db.query.labSessions.findFirst({
    where: and(
      eq(labSessions.userId, session.userId),
      isNull(labSessions.checkOut)
    ),
  });

  return res.status(200).json({ active: !!active, session: active || null });
}
