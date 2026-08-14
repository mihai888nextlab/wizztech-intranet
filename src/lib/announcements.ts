export const TITLE_MAX = 200;

export interface AnnouncementInput {
  title: string;
  description: string;
}

type ParseResult =
  | { ok: true; value: AnnouncementInput }
  | { ok: false; error: string };

/** Shared by the create and update handlers so both enforce the same rules. */
export function parseAnnouncementInput(body: unknown): ParseResult {
  const raw = (body ?? {}) as Record<string, unknown>;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const description =
    typeof raw.description === "string" ? raw.description.trim() : "";

  if (!title || !description) {
    return { ok: false, error: "Title and description are required" };
  }
  if (title.length > TITLE_MAX) {
    return {
      ok: false,
      error: `Title must be ${TITLE_MAX} characters or fewer`,
    };
  }
  return { ok: true, value: { title, description } };
}
