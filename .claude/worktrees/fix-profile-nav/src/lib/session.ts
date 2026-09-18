/*
  The session cookie's shape and settings, with no database imports, so
  `src/proxy.ts` can read the cookie without pulling Neon in.
*/
import type { UserRole } from "@/lib/roles";

export interface SessionData {
  userId: number;
  username: string;
  fullName: string;
  role: UserRole;
  isLoggedIn: boolean;
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET || "complex_password_at_least_32_characters_long_for_security",
  cookieName: "wizztech_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};
