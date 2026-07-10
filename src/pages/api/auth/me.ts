import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);

  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  res.status(200).json({
    userId: session.userId,
    username: session.username,
    fullName: session.fullName,
    role: session.role,
  });
}
