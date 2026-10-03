/*
  Volunteer points and access, with no database imports so `src/proxy.ts` and
  client pages can share them.
*/

/**
 * Everything a volunteer may reach. Anything not listed is refused, so a new
 * page or API route stays team-only until it is added here on purpose.
 */
const VOLUNTEER_PAGES = [
  /^\/$/,
  /^\/set-pin$/,
  /^\/badge$/,
  /^\/events(\/.*)?$/,
  /^\/leaderboard$/,
  /^\/points$/,
];
const VOLUNTEER_APIS = [
  /^\/api\/auth\/.+$/,
  // Creating and editing events is already organizer-only inside the handlers,
  // and the handlers hide events that aren't open to volunteers.
  /^\/api\/events(\/.*)?$/,
  /^\/api\/volunteers\/leaderboard$/,
  // Their own badge, department and QR hang off /me. Another volunteer's id
  // stays refused — only the literal "me" matches.
  /^\/api\/volunteers\/me(\/.*)?$/,
];

/**
 * The teams a volunteer can be assigned to, and the order they're listed in.
 * Stored as these slugs and shown through DEPARTMENT_LABELS, so renaming one
 * for display never rewrites rows. A volunteer can be in any number of them.
 */
export const VOLUNTEER_DEPARTMENTS = [
  "engineering",
  "programming",
  "media",
  "marketing",
] as const;

export type VolunteerDepartment = (typeof VOLUNTEER_DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<VolunteerDepartment, string> = {
  engineering: "Engineering",
  programming: "Programming",
  media: "Media",
  marketing: "Marketing",
};

export function isVolunteerDepartment(value: unknown): value is VolunteerDepartment {
  return VOLUNTEER_DEPARTMENTS.includes(value as VolunteerDepartment);
}

/**
 * Validates a `departments` array off a request body. Returns null rather than
 * dropping the bad entry, so a coordinator who ticks something and sees it not
 * apply gets told instead of guessing.
 */
export function parseDepartments(value: unknown): VolunteerDepartment[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isVolunteerDepartment)) return null;
  // Rebuilt from the canonical list, so the stored order is always the same
  // and a duplicate can't show up twice on the badge.
  return VOLUNTEER_DEPARTMENTS.filter((d) => value.includes(d));
}

/**
 * How someone's departments read on a badge or a list row: "Engineering ·
 * Media". A volunteer who hasn't picked yet still needs a word, or the row
 * looks broken.
 */
export function departmentLabel(values: readonly string[] | null | undefined) {
  const held = VOLUNTEER_DEPARTMENTS.filter((d) => values?.includes(d));
  return held.length > 0
    ? held.map((d) => DEPARTMENT_LABELS[d]).join(" · ")
    : "No department";
}

/** The default every volunteer account starts on, and may not keep. */
export const DEFAULT_PIN = "0000";

export function isValidPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}$/.test(value);
}

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
  department: VolunteerDepartment;
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

  if (!isVolunteerDepartment(input.department)) {
    return { ok: false, error: "Pick which department these points are for" };
  }
  const department = input.department;

  let eventId: number | null = null;
  if (input.eventId !== undefined && input.eventId !== null && input.eventId !== "") {
    const parsed = Number(input.eventId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { ok: false, error: "Invalid event" };
    }
    eventId = parsed;
  }

  return { ok: true, value: { amount, reason, department, eventId } };
}

export interface VolunteerStanding {
  userId: number;
  fullName: string;
  points: number;
  /** Null for anyone yet to score — see `rankVolunteers`. */
  rank: number | null;
}

/**
 * The boards the leaderboard offers: the four departments, plus "overall" for
 * everyone's total across all of them.
 */
export const OVERALL_BOARD = "overall";

export type LeaderboardBoard = typeof OVERALL_BOARD | VolunteerDepartment;

export function isLeaderboardBoard(value: unknown): value is LeaderboardBoard {
  return value === OVERALL_BOARD || isVolunteerDepartment(value);
}

/**
 * Orders volunteers by points, highest first. Ties share a rank ("1, 2, 2, 4")
 * and are listed alphabetically, so two volunteers on the same score are never
 * told one of them is behind.
 *
 * Nobody on zero gets a rank at all. They still appear — a volunteer has to be
 * able to find themselves on their department's board — but as "–" rather than
 * a number: with four department boards that mostly start empty, ranking
 * everyone who hasn't scored would put half the team in joint first.
 */
export function rankVolunteers(
  rows: { userId: number; fullName: string; points: number }[]
): VolunteerStanding[] {
  const sorted = [...rows].sort(
    (a, b) => b.points - a.points || a.fullName.localeCompare(b.fullName)
  );
  const ranked: VolunteerStanding[] = [];
  sorted.forEach((row, index) => {
    if (row.points === 0) {
      ranked.push({ ...row, rank: null });
      return;
    }
    const above = ranked[index - 1];
    const rank =
      above && above.rank !== null && above.points === row.points
        ? above.rank
        : index + 1;
    ranked.push({ ...row, rank });
  });
  return ranked;
}
