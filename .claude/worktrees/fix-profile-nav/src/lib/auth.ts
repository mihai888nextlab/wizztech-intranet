import { getIronSession, IronSession } from "iron-session";
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { canManageVolunteers, type UserRole } from "@/lib/roles";
import { sessionOptions, type SessionData } from "@/lib/session";

export type { SessionData, UserRole };

export async function getSession(req: NextApiRequest, res: NextApiResponse): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(req, res, sessionOptions);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function authenticateUser(username: string, password: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username),
  });

  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  return user;
}

export async function requireAuth(req: NextApiRequest, res: NextApiResponse, role?: UserRole[]) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return null;
  }
  if (role && !role.includes(session.role as UserRole)) {
    return null;
  }
  return session;
}

export async function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req, res, ["admin"]);
}

/** Guard for the ledger: treasurers and admins may write, nobody else. */
export async function requireFinance(req: NextApiRequest, res: NextApiResponse) {
  return requireAuth(req, res, ["admin", "finance"]);
}

/**
 * Guard for the volunteer pages: admins, and anyone holding the volunteer
 * manager permission. The flag is read from the database rather than the
 * session, so granting or revoking it applies without signing out.
 */
export async function requireVolunteerManager(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAuth(req, res);
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { role: true, isVolunteerManager: true },
  });
  if (!user || !canManageVolunteers(user.role, user.isVolunteerManager)) return null;
  return session;
}
