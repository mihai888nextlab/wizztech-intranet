import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { isAccountType, parseRoles } from "@/lib/roles";
import { isValidPin } from "@/lib/volunteers";
import { eq } from "drizzle-orm";

/** Never send these out: a hash is a credential, a badge code is a key. */
const PUBLIC_COLUMNS = {
  id: users.id,
  username: users.username,
  fullName: users.fullName,
  accountType: users.accountType,
  roles: users.roles,
  departments: users.departments,
  mustChangePin: users.mustChangePin,
  createdAt: users.createdAt,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAdmin(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method === "GET") {
    const allUsers = await db.select(PUBLIC_COLUMNS).from(users).orderBy(users.fullName);
    return res.status(200).json(allUsers);
  }

  if (req.method === "POST") {
    const { username, fullName, password, accountType, roles } = req.body;

    if (!username || !fullName || !password) {
      return res.status(400).json({ error: "Username, full name, and password are required" });
    }

    if (!isValidPin(password)) {
      return res.status(400).json({ error: "Password must be exactly 4 digits" });
    }

    if (accountType !== undefined && !isAccountType(accountType)) {
      return res.status(400).json({ error: "Invalid account type" });
    }

    // Volunteers hold no team roles — their whole surface is the allow-list.
    const parsedRoles = roles === undefined ? [] : parseRoles(roles);
    if (parsedRoles === null) {
      return res.status(400).json({ error: "Invalid roles" });
    }
    if (accountType === "volunteer" && parsedRoles.length > 0) {
      return res.status(400).json({ error: "A volunteer account can't hold team roles" });
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.username, username),
    });
    if (existing) {
      return res.status(409).json({ error: "Username already exists" });
    }

    const [newUser] = await db.insert(users).values({
      username,
      fullName,
      passwordHash: await hashPassword(password),
      accountType: accountType ?? "member",
      roles: parsedRoles,
      // An admin picked this PIN, so its owner still has to choose their own.
      mustChangePin: true,
    }).returning(PUBLIC_COLUMNS);

    return res.status(201).json(newUser);
  }

  res.status(405).json({ error: "Method not allowed" });
}
