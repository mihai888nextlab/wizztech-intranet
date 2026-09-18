import { desc, eq } from "drizzle-orm";

import {
  ATTACHMENT_ALLOWED_TYPES,
  ATTACHMENT_MAX_MB,
  type AttachmentUploadInput,
} from "@/lib/announcements";
import { announcementFiles } from "@/db/schema";
import { db } from "@/lib/db";
import { verifyUploadedType } from "@/lib/file-requests";
import { deleteObject, probeObject } from "@/lib/storage";

/*
  Server-only helpers for files attached to an announcement. Members only ever
  read these — admins upload and remove them — so there is no per-user shaping
  like the linked requests have. Validation lives in ./announcements.ts so the
  pure rules stay testable without a database connection.
*/

export interface AnnouncementAttachment {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export function shapeAttachment(row: {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
}): AnnouncementAttachment {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

/** The `with` clause every announcement query needs to hydrate its files. */
export const announcementFilesWith = {
  files: {
    orderBy: (files: { id: unknown }, operators: { desc: typeof desc }) => [
      operators.desc(files.id as never),
    ],
  },
} as const;

/** True when a preview in the browser is safe and useful for this type. */
export function isPreviewable(mimeType: string) {
  return (
    mimeType === "application/pdf" ||
    mimeType.startsWith("image/") ||
    mimeType === "text/plain"
  );
}

/**
 * Records an attachment after the client has uploaded it straight to the
 * bucket. The object is probed first — a presigned PUT can lie about size and
 * type, so the stored reference only reflects what is really there.
 */
export async function createAttachment(
  announcementId: number,
  input: AttachmentUploadInput
): Promise<{ ok: true; attachment: AnnouncementAttachment } | { ok: false; error: string; status?: number }> {
  const prefix = `announcements/${announcementId}/`;
  if (!input.storageKey.startsWith(prefix)) {
    return { ok: false, error: "Storage key does not belong to this announcement" };
  }

  const probe = await probeObject(input.storageKey);
  if (!probe) {
    return { ok: false, error: "The file did not upload, please try again", status: 404 };
  }
  if (probe.size > ATTACHMENT_MAX_MB * 1024 * 1024) {
    return { ok: false, error: `File is larger than the ${ATTACHMENT_MAX_MB} MB limit` };
  }

  const verified = verifyUploadedType(
    probe.head,
    probe.contentType,
    ATTACHMENT_ALLOWED_TYPES
  );
  if (!verified.ok) {
    return { ok: false, error: verified.error };
  }

  const [row] = await db
    .insert(announcementFiles)
    .values({
      announcementId,
      storageKey: input.storageKey,
      fileName: input.fileName,
      mimeType: verified.mimeType,
      sizeBytes: probe.size,
    })
    .returning();

  return { ok: true, attachment: shapeAttachment(row) };
}

/** Removes an attachment and its object from the bucket. */
export async function deleteAttachment(
  attachmentId: number
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(announcementFiles)
    .where(eq(announcementFiles.id, attachmentId));
  if (!row) return false;

  await Promise.all([
    deleteObject(row.storageKey),
    db.delete(announcementFiles).where(eq(announcementFiles.id, attachmentId)),
  ]);
  return true;
}
