export const TITLE_MAX = 200;
export const MAX_SIZE_MB_LIMIT = 50;

/** Signed paperwork is scans and PDFs; anything else is refused by default. */
export const DEFAULT_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
];

export const SUBMISSION_STATUSES = ["submitted", "approved", "rejected"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export type Audience = "all" | "selected";

export interface FileRequestInput {
  title: string;
  description: string | null;
  audience: Audience;
  assigneeIds: number[];
  dueDate: string | null;
  maxSizeMb: number;
  allowedTypes: string | null;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const MIME_PATTERN = /^[\w.+-]+\/[\w.+*-]+$/;

/** Shared by the create and update handlers so the rules cannot drift apart. */
export function parseFileRequestInput(body: unknown): Parsed<FileRequestInput> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Title must be ${TITLE_MAX} characters or fewer` };
  }

  const description =
    typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : null;

  const audience: Audience = raw.audience === "selected" ? "selected" : "all";

  let assigneeIds: number[] = [];
  if (audience === "selected") {
    if (!Array.isArray(raw.assigneeIds)) {
      return { ok: false, error: "Select at least one member" };
    }
    assigneeIds = Array.from(
      new Set(
        raw.assigneeIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );
    if (assigneeIds.length === 0) {
      return { ok: false, error: "Select at least one member" };
    }
  }

  let dueDate: string | null = null;
  if (typeof raw.dueDate === "string" && raw.dueDate.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate.trim())) {
      return { ok: false, error: "Due date must be a calendar date" };
    }
    dueDate = raw.dueDate.trim();
  }

  const maxSizeMb = raw.maxSizeMb === undefined ? 10 : Number(raw.maxSizeMb);
  if (!Number.isInteger(maxSizeMb) || maxSizeMb < 1 || maxSizeMb > MAX_SIZE_MB_LIMIT) {
    return {
      ok: false,
      error: `Maximum size must be between 1 and ${MAX_SIZE_MB_LIMIT} MB`,
    };
  }

  let allowedTypes: string | null = null;
  if (Array.isArray(raw.allowedTypes) && raw.allowedTypes.length > 0) {
    const types = raw.allowedTypes
      .map((t) => String(t).trim().toLowerCase())
      .filter(Boolean);
    if (types.some((t) => !MIME_PATTERN.test(t))) {
      return { ok: false, error: "Allowed types must be MIME types" };
    }
    allowedTypes = types.join(",");
  }

  return {
    ok: true,
    value: { title, description, audience, assigneeIds, dueDate, maxSizeMb, allowedTypes },
  };
}

export function parseReviewInput(
  body: unknown
): Parsed<{ status: SubmissionStatus; reviewNote: string | null }> {
  const raw = (body ?? {}) as Record<string, unknown>;
  const status = String(raw.status ?? "") as SubmissionStatus;
  if (!SUBMISSION_STATUSES.includes(status)) {
    return { ok: false, error: "Status must be submitted, approved or rejected" };
  }
  const reviewNote =
    typeof raw.reviewNote === "string" && raw.reviewNote.trim()
      ? raw.reviewNote.trim()
      : null;
  return { ok: true, value: { status, reviewNote } };
}

export function allowedTypesFor(request: { allowedTypes: string | null }) {
  if (!request.allowedTypes) return DEFAULT_ALLOWED_TYPES;
  const types = request.allowedTypes
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  return types.length > 0 ? types : DEFAULT_ALLOWED_TYPES;
}

export function maxBytesFor(request: { maxSizeMb: number }) {
  return request.maxSizeMb * 1024 * 1024;
}

/** Types whose real identity we can confirm from the file header. */
const SNIFFABLE = new Set(DEFAULT_ALLOWED_TYPES);

/**
 * Identifies a file from its magic bytes, ignoring the Content-Type the
 * uploader claimed. Returns null when the header is not recognised.
 */
export function detectMimeType(head: Buffer): string | null {
  if (head.length >= 4 && head.subarray(0, 4).toString("latin1") === "%PDF") {
    return "application/pdf";
  }
  if (
    head.length >= 8 &&
    head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }
  // ISO base media container: "ftyp" at offset 4, then a HEIF brand.
  if (head.length >= 12 && head.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = head.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) {
      return "image/heic";
    }
  }
  return null;
}

/**
 * Decides whether an uploaded object is acceptable.
 *
 * When every allowed type is one we can recognise, the header must prove the
 * file really is one of them — that is what stops a renamed executable. If an
 * admin has widened the list to something unsniffable, fall back to trusting
 * the stored Content-Type for those.
 */
export function verifyUploadedType(
  head: Buffer | null,
  storedContentType: string,
  allowed: string[]
): { ok: true; mimeType: string } | { ok: false; error: string } {
  const detected = head ? detectMimeType(head) : null;

  if (detected) {
    return allowed.includes(detected)
      ? { ok: true, mimeType: detected }
      : { ok: false, error: "That file type is not accepted" };
  }

  const allSniffable = allowed.every((t) => SNIFFABLE.has(t));
  if (allSniffable) {
    return {
      ok: false,
      error: `That file does not look like a valid ${allowed
        .map((t) => t.replace(/^.*\//, "").toUpperCase())
        .join(" or ")}`,
    };
  }

  const stored = storedContentType.toLowerCase();
  return allowed.includes(stored)
    ? { ok: true, mimeType: stored }
    : { ok: false, error: "That file type is not accepted" };
}
