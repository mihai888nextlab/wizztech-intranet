/*
  The role vocabulary, in one place and with no database imports, so client
  pages can ask "may this person do X?" without pulling Neon into the bundle.
  The list used to live inline in five files; it now lives here alone.
*/

/** Ordered by ascending privilege — the Members role picker renders them in this order. */
export const USER_ROLES = [
  "member",
  "volunteer",
  "organizer",
  "finance",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export function isUserRole(value: unknown): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}

/** Runs events and posts announcements. */
export function isOrganizer(role: string) {
  return role === "admin" || role === "organizer";
}

/**
 * Finance is a treasurer role: full control of the ledger and nothing else.
 * Organizers are deliberately not included — running events and holding the
 * team's books are separate jobs.
 */
export function canEditFinance(role: string) {
  return role === "admin" || role === "finance";
}

/**
 * Everyone signed in can read the ledger, but the supporting documents are a
 * different matter: contracts and sponsor invoices carry signatures, bank
 * details and personal data, so they stay with the treasurers.
 */
export const canViewFinanceDocuments = canEditFinance;

/**
 * Volunteers help out at events but aren't on the team: they see events, their
 * own points and the volunteer leaderboard, and nothing else. `src/proxy.ts`
 * enforces that for every route.
 */
export function isVolunteer(role: string) {
  return role === "volunteer";
}

/**
 * Giving points and managing volunteer accounts is an extra permission a
 * member can hold alongside their role, rather than a role of its own.
 */
export function canManageVolunteers(role: string, isVolunteerManager: boolean) {
  return role === "admin" || isVolunteerManager;
}
