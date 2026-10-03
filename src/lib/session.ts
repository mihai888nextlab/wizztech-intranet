/*
  The session cookie's shape and settings, with no database imports, so
  `src/proxy.ts` can read the cookie without pulling Neon in.
*/
import type { AccountType, TeamRole } from "@/lib/roles";

export interface SessionData {
  userId: number;
  username: string;
  fullName: string;
  /**
   * In the cookie because `src/proxy.ts` needs it on every request and cannot
   * reach the database. It only changes if an admin converts an account, which
   * is rare enough that a sign-out is a fair price.
   */
  accountType: AccountType;
  /**
   * A snapshot for the proxy's benefit only. Anything that grants or refuses
   * access reads the roles fresh from the database — see `requirePermission`
   * in `src/lib/auth.ts` — so revoking a role takes effect immediately.
   */
  roles: TeamRole[];
  isLoggedIn: boolean;
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_for_security",
  /*
    Versioned on purpose. Sessions sealed before `role` was split into
    `accountType` + `roles` carry neither field, and a volunteer holding one
    would read as "not a volunteer" to `src/proxy.ts` — which is the one check
    keeping them out of the team's announcements, documents and finances.
    A new name makes every one of those cookies simply not exist, so everybody
    signs in once more and nobody is let through on a stale shape.
  */
  cookieName: "wizztech_session_v2",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};
