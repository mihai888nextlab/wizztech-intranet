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

  // Read the whole lot fresh rather than trusting the cookie: granting a role,
  // setting someone's departments or resetting their PIN then takes effect on
  // their next page load instead of waiting for them to sign out. The guards
  // in `src/lib/auth.ts` read the same way, so the UI and the API agree.
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: {
      fullName: true,
      accountType: true,
      roles: true,
      departments: true,
      mustChangePin: true,
    },
  });

  if (!user) {
    // The account was deleted under them; the session is worthless now.
    session.destroy();
    return res.status(401).json({ error: "Not authenticated" });
  }

  res.status(200).json({
    userId: session.userId,
    username: session.username,
    fullName: user.fullName,
    accountType: user.accountType,
    roles: user.roles,
    departments: user.departments,
    mustChangePin: user.mustChangePin,
  });
}
