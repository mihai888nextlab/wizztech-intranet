import type { NextApiRequest, NextApiResponse } from "next";
import { authenticateUser, getSession } from "@/lib/auth";
import type { AccountType, TeamRole } from "@/lib/roles";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const user = await authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const session = await getSession(req, res);
  session.userId = user.id;
  session.username = user.username;
  session.fullName = user.fullName;
  session.accountType = user.accountType as AccountType;
  session.roles = user.roles as TeamRole[];
  session.isLoggedIn = true;
  await session.save();

  res.status(200).json({
    userId: user.id,
    username: user.username,
    fullName: user.fullName,
    accountType: user.accountType,
    roles: user.roles,
    // The login page sends them straight to /set-pin when this is true, so
    // somebody else's choice of PIN never becomes their permanent one.
    mustChangePin: user.mustChangePin,
  });
}
