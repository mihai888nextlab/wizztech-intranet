import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "@/lib/db";
import { fileSubmissions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { isAccountType, parseRoles, type AccountType, type TeamRole } from "@/lib/roles";
import { deleteObjects } from "@/lib/storage";
import { eq } from "drizzle-orm";

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

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  if (req.method === "DELETE") {
    // Deleting the row cascades their submissions, but not the stored files.
    const submitted = await db
      .select({ storageKey: fileSubmissions.storageKey })
      .from(fileSubmissions)
      .where(eq(fileSubmissions.userId, id));
    await deleteObjects(submitted.map((s) => s.storageKey));

    await db.delete(users).where(eq(users.id, id));
    return res.status(200).json({ success: true });
  }

  if (req.method === "PATCH") {
    const { fullName, accountType, roles } = req.body;

    const updateData: {
      fullName?: string;
      accountType?: AccountType;
      roles?: TeamRole[];
    } = {};

    if (fullName) updateData.fullName = fullName;

    if (accountType !== undefined) {
      // Answer 400 rather than ignoring a value we don't recognise: an admin
      // who ticks something and sees nothing happen assumes it worked.
      if (!isAccountType(accountType)) {
        return res.status(400).json({ error: "Invalid account type" });
      }
      updateData.accountType = accountType;
    }

    if (roles !== undefined) {
      const parsedRoles = parseRoles(roles);
      if (parsedRoles === null) {
        return res.status(400).json({ error: "Invalid roles" });
      }
      updateData.roles = parsedRoles;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { accountType: true, roles: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check the state the row would end up in, not just what was sent: a
    // member holding roles being converted to a volunteer has to shed them,
    // since a volunteer's whole surface is the allow-list.
    const resultingType = updateData.accountType ?? existing.accountType;
    const resultingRoles = updateData.roles ?? existing.roles;
    if (resultingType === "volunteer" && resultingRoles.length > 0) {
      return res.status(400).json({ error: "A volunteer account can't hold team roles" });
    }

    const [updated] = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning(PUBLIC_COLUMNS);

    return res.status(200).json(updated);
  }

  res.status(405).json({ error: "Method not allowed" });
}
