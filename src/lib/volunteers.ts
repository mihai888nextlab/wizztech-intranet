/*
  Volunteer points and access, with no database imports so `src/proxy.ts` and
  client pages can share them.
*/

/**
 * Everything a volunteer may reach. Anything not listed is refused, so a new
 * page or API route stays team-only until it is added here on purpose.
 */
const VOLUNTEER_PAGES = [/^\/$/, /^\/events(\/.*)?$/, /^\/leaderboard$/, /^\/points$/];
const VOLUNTEER_APIS = [
  /^\/api\/auth\/.+$/,
  // Creating and editing events is already organizer-only inside the handlers.
  /^\/api\/events(\/.*)?$/,
  /^\/api\/volunteers\/leaderboard$/,
  /^\/api\/volunteers\/me$/,
];

export function isVolunteerPathAllowed(pathname: string) {
  // Trailing slashes are equivalent to their bare path for routing.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const allowed = path.startsWith("/api/") ? VOLUNTEER_APIS : VOLUNTEER_PAGES;
  return allowed.some((pattern) => pattern.test(path));
}

export const MAX_REASON_LENGTH = 200;
/** Generous for any real award, and far inside a Postgres integer when summed. */
export const MAX_AWARD = 10_000;

export interface AwardInput {
  amount: number;
  reason: string;
  eventId: number | null;
}

/** Validates a points award from a request body. */
export function parseAwardInput(
  body: unknown
): { ok: true; value: AwardInput } | { ok: false; error: string } {
  const input = (body ?? {}) as Record<string, unknown>;

  const amount = typeof input.amount === "string" ? Number(input.amount.trim()) : input.amount;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount === 0) {
    return { ok: false, error: "Points must be a whole number other than zero" };
  }
  if (Math.abs(amount) > MAX_AWARD) {
    return { ok: false, error: `Points must be between -${MAX_AWARD} and ${MAX_AWARD}` };
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reason) {
    return { ok: false, error: "A reason is required" };
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return { ok: false, error: `Reason must be at most ${MAX_REASON_LENGTH} characters` };
  }

  let eventId: number | null = null;
  if (input.eventId !== undefined && input.eventId !== null && input.eventId !== "") {
    const parsed = Number(input.eventId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: "Invalid event" };
    }
    eventId = parsed;
  }

  return { ok: true, value: { amount, reason, eventId } };
}

export interface VolunteerStanding {
  userId: number;
  fullName: string;
  points: number;
  rank: number;
}

/**
 * Orders volunteers by points, highest first. Ties share a rank ("1, 2, 2, 4")
 * and are listed alphabetically, so two volunteers on the same score are never
 * told one of them is behind.
 */
export function rankVolunteers(
  rows: { userId: number; fullName: string; points: number }[]
): VolunteerStanding[] {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || a.fullName.localeCompare(b.fullName)
  );
  const ranked: VolunteerStanding[] = [];
  sorted.forEach((row, index) => {
    const above = ranked[index - 1];
    const rank = above && above.points === row.points ? above.rank : index + 1;
    ranked.push({ ...row, rank });
  });
  return ranked;
}
