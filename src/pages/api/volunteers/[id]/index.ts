import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword, requireVolunteerManager } from "@/lib/auth";
import { findVolunteer, pointsHistory } from "@/lib/volunteers.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireVolunteerManager(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid volunteer ID" });
  }

  const volunteer = await findVolunteer(id);
  if (!volunteer) {
    return res.status(404).json({ error: "Volunteer not found" });
  }

  if (req.method === "GET") {
    const history = await pointsHistory(id);
    return res.status(200).json({
      userId: volunteer.id,
      username: volunteer.username,
      fullName: volunteer.fullName,
      createdAt: volunteer.createdAt,
      points: history.reduce((sum, award) => sum + award.amount, 0),
      history,
    });
  }

  if (req.method === "PATCH") {
    const { fullName, password } = req.body;
    const updateData: { fullName?: string; passwordHash?: string } = {};

    if (typeof fullName === "string" && fullName.trim()) {
      updateData.fullName = fullName.trim();
    }
    if (password) {
      if (!/^\d{4}$/.test(password)) {
        return res.status(400).json({ error: "PIN must be exactly 4 digits" });
      }
      updateData.passwordHash = await hashPassword(password);
    }
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const [updated] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    return res.status(200).json({
      userId: updated.id,
      username: updated.username,
      fullName: updated.fullName,
    });
  }

  if (req.method === "DELETE") {
    // Their awards and attendance go with them (cascade).
    await db.delete(users).where(eq(users.id, id));
    return res.status(200).json({ success: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
