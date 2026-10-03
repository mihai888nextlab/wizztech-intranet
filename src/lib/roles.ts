/*
  The permission vocabulary, in one place and with no database imports, so
  client pages and `src/proxy.ts` can ask "may this person do X?" without
  pulling Neon into the bundle.

  Two separate ideas live here, and keeping them apart is the point:

  - `accountType` is *what kind of account this is*. A volunteer is an outsider
    who helps at events; their entire app surface is allow-listed in
    `src/lib/volunteers.ts` and enforced by `src/proxy.ts`.
  - `roles` is *what jobs this person does*, and someone can hold several at
    once — running the volunteers and creating events are different jobs that
    often land on the same person.
*/

/** A volunteer is an outsider; everyone else is on the team. */
export const ACCOUNT_TYPES = ["member", "volunteer"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];

export function isAccountType(value: unknown): value is AccountType {
  return ACCOUNT_TYPES.includes(value as AccountType);
}

/**
 * The jobs a team member can hold, in the order the Members dialog lists them.
 * A plain member holds none of them.
 */
export const TEAM_ROLES = ["organizer", "finance", "coordinator", "admin"] as const;

export type TeamRole = (typeof TEAM_ROLES)[number];

export const ROLE_LABELS: Record<TeamRole, string> = {
  organizer: "Organizer",
  finance: "Treasurer",
  coordinator: "Volunteer coordinator",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  organizer: "Creates events and posts announcements",
  finance: "Full control of the ledger and its documents",
  coordinator: "Adds volunteers and gives them points",
  admin: "Everything, including members and documents",
};

export function isTeamRole(value: unknown): value is TeamRole {
  return TEAM_ROLES.includes(value as TeamRole);
}

/**
 * Validates a `roles` array off a request body. Returns null — rather than
 * quietly dropping the bad entry — so the handler can answer 400 and the admin
 * finds out their change didn't apply.
 */
export function parseRoles(value: unknown): TeamRole[] | null {
  if (!Array.isArray(value)) return null;
  if (!value.every(isTeamRole)) return null;
  // Duplicates would survive into the database and show twice in the UI.
  return TEAM_ROLES.filter((role) => value.includes(role));
}

function has(roles: readonly string[] | undefined, role: TeamRole) {
  return roles?.includes(role) ?? false;
}

/** Admins hold every permission below, so each check starts with them. */
export function isAdmin(roles: readonly string[] | undefined) {
  return has(roles, "admin");
}

/** Runs events and posts announcements. */
export function isOrganizer(roles: readonly string[] | undefined) {
  return isAdmin(roles) || has(roles, "organizer");
}

/**
 * Finance is a treasurer role: full control of the ledger and nothing else.
 * Organizers are deliberately not included — running events and holding the
 * team's books are separate jobs.
 */
export function canEditFinance(roles: readonly string[] | undefined) {
  return isAdmin(roles) || has(roles, "finance");
}

/**
 * Everyone signed in can read the ledger, but the supporting documents are a
 * different matter: contracts and sponsor invoices carry signatures, bank
 * details and personal data, so they stay with the treasurers.
 */
export const canViewFinanceDocuments = canEditFinance;

/** Adds volunteer accounts, sets their department and gives them points. */
export function canManageVolunteers(roles: readonly string[] | undefined) {
  return isAdmin(roles) || has(roles, "coordinator");
}

/**
 * Volunteers help out at events but aren't on the team: they see the events
 * opened to them, their own badge, their points and the volunteer
 * leaderboard, and nothing else. `src/proxy.ts` enforces that for every route.
 */
export function isVolunteer(accountType: string | undefined) {
  return accountType === "volunteer";
}

/**
 * How someone's jobs read in a badge or a list row: "Organizer · Treasurer".
 * Plain members hold no roles, so they get their account type instead — a row
 * with nothing in it looks like a bug.
 */
export function roleSummary(
  accountType: string | undefined,
  roles: readonly string[] | undefined
): string {
  if (isVolunteer(accountType)) return "Volunteer";
  const held = TEAM_ROLES.filter((role) => has(roles, role)).map((role) => ROLE_LABELS[role]);
  return held.length > 0 ? held.join(" · ") : "Member";
}
