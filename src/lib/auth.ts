import { getIronSession, IronSession } from "iron-session";
import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import {
  canEditFinance,
  canManageVolunteers,
  isAdmin,
  isOrganizer,
  type AccountType,
  type TeamRole,
} from "@/lib/roles";
import { sessionOptions, type SessionData } from "@/lib/session";

export type { SessionData, AccountType, TeamRole };

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

/** Any signed-in account. Reads the cookie only, so it costs no query. */
export async function requireAuth(req: NextApiRequest, res: NextApiResponse): Promise<IronSession<SessionData> | null> {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return null;
  }
  return session;
}

/**
 * The guard behind every permission check: the roles are read from the
 * database rather than the cookie, so granting or revoking one applies without
 * the person signing out. That costs one small query on guarded routes, which
 * is the right trade — a stale cookie used to mean a demoted admin kept their
 * powers until their session ended.
 *
 * Like `requireAuth`, it returns null instead of writing a response, so every
 * call site answers in its own voice.
 */
export async function requirePermission(
  req: NextApiRequest,
  res: NextApiResponse,
  check: (roles: readonly string[]) => boolean
) {
  const session = await requireAuth(req, res);
  if (!session) return null;
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { roles: true },
  });
  if (!user || !check(user.roles)) return null;
  return session;
}

export function requireAdmin(req: NextApiRequest, res: NextApiResponse) {
  return requirePermission(req, res, isAdmin);
}

/** Guard for events and announcements. */
export function requireOrganizer(req: NextApiRequest, res: NextApiResponse) {
  return requirePermission(req, res, isOrganizer);
}

/** Guard for the ledger: treasurers and admins may write, nobody else. */
export function requireFinance(req: NextApiRequest, res: NextApiResponse) {
  return requirePermission(req, res, canEditFinance);
}

/** Guard for the volunteer pages: coordinators and admins. */
export function requireVolunteerManager(req: NextApiRequest, res: NextApiResponse) {
  return requirePermission(req, res, canManageVolunteers);
}

/**
 * The roles a signed-in person actually holds right now. Handlers that shape
 * their response around permissions — "admins see every submission, members
 * see their own" — need the same fresh read the guards use.
 */
export async function currentRoles(session: { userId: number }): Promise<string[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { roles: true },
  });
  return user?.roles ?? [];
}
