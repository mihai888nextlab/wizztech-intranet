import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword, requireAuth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAuth(req, res, ["admin"]);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const allUsers = await db.select().from(users).orderBy(users.fullName);
    return res.status(200).json(allUsers.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
      role: u.role,
      createdAt: u.createdAt,
    })));
  }

  if (req.method === "POST") {
    const { username, fullName, password, role } = req.body;

    if (!username || !fullName || !password) {
      return res.status(400).json({ error: "Username, full name, and password are required" });
    }

    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      return res.status(400).json({ error: "Password must be exactly 4 digits" });
    }

    const validRoles = ["admin", "organizer", "volunteer", "member"];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ error: "Invalid role" });
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const passwordHash = await hashPassword(password);
    const [newUser] = await db.insert(users).values({
      username,
      fullName,
      passwordHash,
      role: role || "member",
    }).returning();

    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      role: newUser.role,
      createdAt: newUser.createdAt,
    });
  }

  res.status(405).json({ error: "Method not allowed" });
}
