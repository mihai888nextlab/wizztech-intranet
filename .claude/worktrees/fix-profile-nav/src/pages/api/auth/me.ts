import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);

  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  // Read fresh so granting the volunteer manager permission shows up without
  // signing out. The role itself still comes from the session, as it always has.
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { isVolunteerManager: true },
  });

  res.status(200).json({
    userId: session.userId,
    username: session.username,
    fullName: session.fullName,
    role: session.role,
    isVolunteerManager: user?.isVolunteerManager ?? false,
  });
}
