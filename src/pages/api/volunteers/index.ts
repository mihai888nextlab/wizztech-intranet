import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword, requireVolunteerManager } from "@/lib/auth";
import { DEFAULT_PIN, parseDepartments } from "@/lib/volunteers";
import { newBadgeCode, volunteerStandings } from "@/lib/volunteers.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireVolunteerManager(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    return res.status(200).json(await volunteerStandings());
  }

  if (req.method === "POST") {
    const { username, fullName } = req.body;

    if (!username?.trim() || !fullName?.trim()) {
      return res.status(400).json({ error: "Username and full name are required" });
    }

    const departments = parseDepartments(req.body?.departments ?? []);
    if (departments === null) {
      return res.status(400).json({ error: "Invalid departments" });
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.username, username.trim()),
    });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    // Always a volunteer: this route can't be used to mint team accounts.
    // Everyone starts on the same known PIN and is made to replace it on their
    // first sign-in, so a coordinator never has to invent or pass one along.
    const [volunteer] = await db.insert(users).values({
      username: username.trim(),
      fullName: fullName.trim(),
      passwordHash: await hashPassword(DEFAULT_PIN),
      accountType: "volunteer",
      mustChangePin: true,
      departments,
      badgeCode: newBadgeCode(),
    }).returning();

    return res.status(201).json({
      userId: volunteer.id,
      username: volunteer.username,
      fullName: volunteer.fullName,
      departments: volunteer.departments,
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
