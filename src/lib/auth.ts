import { getIronSession, IronSession } from "iron-session";
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import type { UserRole } from "@/lib/roles";

export type { UserRole };

export interface SessionData {
  userId: number;
  username: string;
  fullName: string;
  role: UserRole;
  isLoggedIn: boolean;
}

const sessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_for_security",
  cookieName: "wizztech_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

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
