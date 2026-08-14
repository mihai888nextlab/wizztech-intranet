export const TITLE_MAX = 200;

export const ATTACHMENT_MAX_MB = 25;

/** Reference documents: printable, viewable or spreadsheet-shaped. */
export const ATTACHMENT_ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/heic",
];

export interface AnnouncementInput {
  title: string;
  description: string;
}

export interface AttachmentUploadInput {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
}

type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

/** Shared by the create and update handlers so both enforce the same rules. */
export function parseAnnouncementInput(body: unknown): ParseResult<AnnouncementInput> {
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

/**
 * Shared by the upload-url and create handlers so the rules cannot drift.
 * A storage key is only required when recording the attachment, not when
 * asking for the presigned upload URL.
 */
export function parseAttachmentUpload(
  body: unknown,
  storageKey?: string
): ParseResult<AttachmentUploadInput> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const fileName =
    typeof raw.fileName === "string" ? raw.fileName.trim().slice(0, 255) : "";
  if (!fileName) return { ok: false, error: "File name is required" };

  const contentType =
    typeof raw.contentType === "string" ? raw.contentType.trim().toLowerCase() : "";
  if (!contentType) return { ok: false, error: "File type is required" };
  if (!ATTACHMENT_ALLOWED_TYPES.includes(contentType)) {
    return {
      ok: false,
      error: `That file type is not accepted. Allowed: ${ATTACHMENT_ALLOWED_TYPES.map((t) => t.replace(/^.*\//, "").toUpperCase()).join(", ")}`,
    };
  }

  const sizeBytes = Number(raw.sizeBytes);
  if (!Number.isInteger(sizeBytes) || sizeBytes < 0) {
    return { ok: false, error: "File size is required" };
  }
  const maxBytes = ATTACHMENT_MAX_MB * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    return { ok: false, error: `File is larger than the ${ATTACHMENT_MAX_MB} MB limit` };
  }

  if (storageKey !== undefined && !storageKey) {
    return { ok: false, error: "Storage key is required" };
  }

  return { ok: true, value: { fileName, contentType, sizeBytes, storageKey: storageKey ?? "" } };
}
