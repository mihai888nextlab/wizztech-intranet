/*
  The rules that decide whether someone may sign in to an event, with no
  database imports so the dashboard forms and the event page can validate and
  explain them without pulling Neon into the bundle.

  There are two, and they are independent: a cap on how many people may sign
  in, and a list of other events whose attendees are disqualified.
*/

/**
 * Generous for any event this team runs, and small enough that a typo in the
 * capacity box can't produce a number nobody notices is wrong.
 */
export const MAX_CAPACITY = 1000;

export interface EventRules {
  /** Null means no limit. */
  capacity: number | null;
  /** Ids of events whose attendees may not sign in to this one. */
  exclusionIds: number[];
}

/**
 * Validates the capacity field. Returns null for "no limit" — an empty box and
 * an absent field both mean that, since the form always sends the key.
 */
export function parseCapacity(
  value: unknown
): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") {
    return { ok: true, value: null };
  }
  const capacity = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof capacity !== "number" || !Number.isInteger(capacity)) {
    return { ok: false, error: "The participant limit must be a whole number" };
  }
  if (capacity < 1) {
    return { ok: false, error: "The participant limit must be at least 1" };
  }
  if (capacity > MAX_CAPACITY) {
    return { ok: false, error: `The participant limit must be at most ${MAX_CAPACITY}` };
  }
  return { ok: true, value: capacity };
}

/**
 * Validates the list of events whose attendees are excluded. `selfId` is the
 * event being saved, rejected because excluding an event from itself says
 * nothing — you cannot attend the same event twice regardless.
 */
export function parseExclusionIds(
  value: unknown,
  selfId?: number
): { ok: true; value: number[] } | { ok: false; error: string } {
  if (value === undefined || value === null) return { ok: true, value: [] };
  if (!Array.isArray(value)) {
    return { ok: false, error: "Invalid exclusion list" };
  }

  const ids: number[] = [];
  for (const entry of value) {
    const id = typeof entry === "string" ? Number(entry.trim()) : entry;
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
      return { ok: false, error: "Invalid exclusion list" };
    }
    if (selfId !== undefined && id === selfId) {
      return { ok: false, error: "An event can't exclude its own attendees" };
    }
    if (!ids.includes(id)) ids.push(id);
  }
  return { ok: true, value: ids };
}

/** Both rules off one request body. */
export function parseEventRules(
  body: unknown,
  selfId?: number
): { ok: true; value: EventRules } | { ok: false; error: string } {
  const input = (body ?? {}) as Record<string, unknown>;

  const capacity = parseCapacity(input.capacity);
  if (!capacity.ok) return { ok: false, error: capacity.error };

  const exclusionIds = parseExclusionIds(input.exclusionEventIds, selfId);
  if (!exclusionIds.ok) return { ok: false, error: exclusionIds.error };

  return { ok: true, value: { capacity: capacity.value, exclusionIds: exclusionIds.value } };
}

/** How many places are left, or null when the event has no cap. */
export function spotsLeft(capacity: number | null, attendeeCount: number) {
  return capacity === null ? null : Math.max(0, capacity - attendeeCount);
}

export function isFull(capacity: number | null, attendeeCount: number) {
  return capacity !== null && attendeeCount >= capacity;
}

/** Why someone can't sign in, or null when they can. */
export type SignInBlock =
  | { reason: "full" }
  | { reason: "excluded"; events: string[] };

/**
 * The sentence shown where the sign-in button would be. Named events rather
 * than a bare refusal: "you already went to the Saturday session" tells
 * somebody what happened, where "not eligible" starts a conversation.
 */
export function blockMessage(block: SignInBlock): string {
  if (block.reason === "full") {
    return "This event is full.";
  }
  const [first, ...rest] = block.events;
  if (rest.length === 0) {
    return `You can't sign in because you attended ${first}.`;
  }
  if (rest.length === 1) {
    return `You can't sign in because you attended ${first} and ${rest[0]}.`;
  }
  return `You can't sign in because you attended ${first} and ${rest.length} other events.`;
}
