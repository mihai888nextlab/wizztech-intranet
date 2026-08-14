import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";

import { fileRequests, fileSubmissions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  allowedTypesFor,
  maxBytesFor,
  verifyUploadedType,
} from "@/lib/file-requests";
import { canSubmit } from "@/lib/file-requests.server";
import { deleteObject, isStorageConfigured, probeObject } from "@/lib/storage";

/**
 * Records an upload that has already landed in object storage.
 *
 * Nothing the client says about the file is trusted: the key must sit under
 * this member's own prefix, and the real size and type are read back from
 * storage with a HEAD before the submission is accepted.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isStorageConfigured()) {
    return res.status(503).json({ error: "File storage is not configured" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const request = await db.query.fileRequests.findFirst({
    where: eq(fileRequests.id, id),
  });
  if (!request) {
    return res.status(404).json({ error: "File request not found" });
  }
  if (!(await canSubmit(request, session.userId))) {
    return res
      .status(403)
      .json({ error: "This request is closed or not assigned to you" });
  }

  const storageKey =
    typeof req.body?.storageKey === "string" ? req.body.storageKey : "";
  const fileName =
    typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";

  if (!storageKey || !fileName) {
    return res.status(400).json({ error: "Storage key and file name are required" });
  }

  // Stops a member from claiming an object uploaded by someone else.
  const expectedPrefix = `requests/${request.id}/${session.userId}/`;
  if (!storageKey.startsWith(expectedPrefix)) {
    return res.status(400).json({ error: "Storage key does not belong to you" });
  }

  // One call returns the real size, the stored type and the header bytes.
  const object = await probeObject(storageKey);
  if (!object) {
    return res.status(400).json({ error: "Upload not found. Please try again." });
  }

  // Authoritative validation — the presigned PUT could enforce neither size
  // nor type, and Content-Type is whatever the uploader chose to send.
  const maxBytes = maxBytesFor(request);
  if (object.size > maxBytes) {
    await deleteObject(storageKey);
    return res
      .status(400)
      .json({ error: `File is larger than the ${request.maxSizeMb} MB limit` });
  }

  const verified = verifyUploadedType(
    object.head,
    object.contentType,
    allowedTypesFor(request)
  );
  if (!verified.ok) {
    await deleteObject(storageKey);
    return res.status(400).json({ error: verified.error });
  }

  const existing = await db.query.fileSubmissions.findFirst({
    where: and(
      eq(fileSubmissions.requestId, request.id),
      eq(fileSubmissions.userId, session.userId)
    ),
  });

  // Re-uploading resets the review so an admin looks at the new file.
  const values = {
    requestId: request.id,
    userId: session.userId,
    storageKey,
    fileName: fileName.slice(0, 255),
    // The sniffed type, not the one the client claimed.
    mimeType: verified.mimeType,
    sizeBytes: object.size,
    status: "submitted" as const,
    reviewNote: null,
    reviewedBy: null,
    reviewedAt: null,
    uploadedAt: new Date(),
  };

  const [saved] = existing
    ? await db
        .update(fileSubmissions)
        .set(values)
        .where(eq(fileSubmissions.id, existing.id))
        .returning()
    : await db.insert(fileSubmissions).values(values).returning();

  if (existing && existing.storageKey !== storageKey) {
    await deleteObject(existing.storageKey);
  }

  return res.status(201).json(saved);
}
