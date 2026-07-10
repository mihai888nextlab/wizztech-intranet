import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAuth(req, res, ["admin"]);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  if (req.method === "DELETE") {
    await db.delete(users).where(eq(users.id, id));
    return res.status(200).json({ success: true });
  }

  if (req.method === "PATCH") {
    const { fullName, role } = req.body;
    const validRoles = ["admin", "organizer", "volunteer", "member"];

    const updateData: Record<string, string> = {};
    if (fullName) updateData.fullName = fullName;
    if (role && validRoles.includes(role)) updateData.role = role;

    const [updated] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName,
      role: updated.role,
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
