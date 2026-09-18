import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { volunteerPoints } from "@/db/schema";
import { requireVolunteerManager } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireVolunteerManager(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid award ID" });
  }

  const [deleted] = await db.delete(volunteerPoints)
    .where(eq(volunteerPoints.id, id))
    .returning();
  if (!deleted) {
    return res.status(404).json({ error: "Award not found" });
  }

  res.status(200).json({ success: true });
}
