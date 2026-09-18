import { NextResponse, type NextRequest } from "next/server";
import { unsealData } from "iron-session";

import { isVolunteer } from "@/lib/roles";
import { sessionOptions, type SessionData } from "@/lib/session";
import { isVolunteerPathAllowed } from "@/lib/volunteers";

/*
  Volunteers see events, their points and the volunteer leaderboard — nothing
  else. Enforcing that here, against an allow-list, covers every page and API
  route at once, including ones added later. Everyone else passes straight
  through to the per-route checks they already had.
*/
export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(sessionOptions.cookieName)?.value;
  if (!cookie) return NextResponse.next();

  let session: Partial<SessionData>;
  try {
    session = await unsealData<SessionData>(cookie, {
      password: sessionOptions.password,
    });
  } catch {
    // A cookie we can't read is no session at all; the routes will say so.
    return NextResponse.next();
  }

  if (!session.isLoggedIn || !session.role || !isVolunteer(session.role)) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  if (isVolunteerPathAllowed(pathname)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not available to volunteers" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/events", request.url));
}

export const config = {
  // Skip build output and public assets — the service worker, manifest and
  // icons must load for everyone, or the app stops being installable.
  matcher: [
    "/((?!_next/static|_next/image|icons/|sw\\.js|manifest\\.webmanifest|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|ico|webp)$).*)",
  ],
};
