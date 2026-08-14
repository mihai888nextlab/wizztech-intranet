import { DEFAULT_ALLOWED_TYPES } from "@/lib/file-requests";
import { todayISO } from "@/lib/format";

/** Shapes returned by the file-request API, shared by the documents pages. */

export interface Submission {
  id: number;
  userId: number;
  status: string;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  reviewNote: string | null;
  uploadedAt: string;
}

export interface FileRequest {
  id: number;
  title: string;
  description: string | null;
  audience: "all" | "selected";
  dueDate: string | null;
  maxSizeMb: number;
  allowedTypes: string | null;
  closedAt: string | null;
  createdAt: string;
  author: { fullName: string; username: string } | null;
  assigneeCount: number;
  /** Admin list view only. */
  submittedCount?: number;
  approvedCount?: number;
  /** Member view only. */
  mySubmission?: Submission | null;
}

export interface RosterEntry {
  user: { id: number; fullName: string; username: string; role: string };
  submission: Submission | null;
}

export interface TeamMember {
  id: number;
  fullName: string;
  username: string;
  role: string;
}

/** Human labels for the types we can verify from a file's header bytes. */
export const TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
  "image/heic": "HEIC",
};

/** The choices offered when creating a request, in the order they're shown. */
export const TYPE_CHOICES = [
  { value: "application/pdf", label: "PDF", hint: "Scanned or signed forms" },
  { value: "image/jpeg", label: "JPEG", hint: "Most phone photos" },
  { value: "image/png", label: "PNG", hint: "Screenshots" },
  { value: "image/heic", label: "HEIC", hint: "Newer iPhone photos" },
] as const;

export function describeTypes(types: string[]) {
  const labels = types.map((t) => TYPE_LABELS[t] ?? t);
  if (labels.length === 0) return "Any file";
  if (labels.length === 1) return `${labels[0]} only`;
  if (labels.length === TYPE_CHOICES.length) return "PDF or images";
  return labels.join(" or ");
}

export function isPreviewable(mimeType: string) {
  // HEIC has no browser decoder, so it downloads rather than previews.
  return (
    mimeType === "application/pdf" ||
    mimeType === "image/jpeg" ||
    mimeType === "image/png"
  );
}

export function allowedTypesOf(request: Pick<FileRequest, "allowedTypes">) {
  if (!request.allowedTypes) return DEFAULT_ALLOWED_TYPES;
  const types = request.allowedTypes
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return types.length > 0 ? types : DEFAULT_ALLOWED_TYPES;
}

/** Past due and still open — a closed request is no longer chaseable. */
export function isOverdue(request: Pick<FileRequest, "dueDate" | "closedAt">) {
  return Boolean(
    request.dueDate && !request.closedAt && request.dueDate < todayISO()
  );
}
