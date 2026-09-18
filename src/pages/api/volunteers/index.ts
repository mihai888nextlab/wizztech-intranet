import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword, requireVolunteerManager } from "@/lib/auth";
import { volunteerStandings } from "@/lib/volunteers.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireVolunteerManager(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    return res.status(200).json(await volunteerStandings());
  }

  if (req.method === "POST") {
    const { username, fullName, password } = req.body;

    if (!username?.trim() || !fullName?.trim() || !password) {
      return res.status(400).json({ error: "Username, full name, and PIN are required" });
    }

    if (!/^\d{4}$/.test(password)) {
      return res.status(400).json({ error: "PIN must be exactly 4 digits" });
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.username, username.trim()),
    });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Always a volunteer: this route can't be used to mint team accounts.
    const [volunteer] = await db.insert(users).values({
      username: username.trim(),
      fullName: fullName.trim(),
      passwordHash: await hashPassword(password),
      role: "volunteer",
    }).returning();

    return res.status(201).json({
      userId: volunteer.id,
      username: volunteer.username,
      fullName: volunteer.fullName,
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
