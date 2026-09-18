import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { fileRequests } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { allowedTypesFor, maxBytesFor } from "@/lib/file-requests";
import { canSubmit } from "@/lib/file-requests.server";
import { isStorageConfigured, presignUpload, submissionKey } from "@/lib/storage";

/**
 * Hands the browser a short-lived URL to upload straight to object storage.
 *
 * The checks here are for fast feedback only — a presigned PUT cannot enforce
 * a size limit, so the authoritative check happens in ./submissions.ts once
 * the object actually exists.
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
    return res.status(503).json({
      error: "File storage is not configured. Ask an admin to set the S3_* variables.",
    });
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

  const fileName =
    typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
  const contentType =
    typeof req.body?.contentType === "string"
      ? req.body.contentType.trim().toLowerCase()
      : "";
  const sizeBytes = Number(req.body?.sizeBytes);

  if (!fileName || !contentType) {
    return res.status(400).json({ error: "File name and type are required" });
  }

  const allowed = allowedTypesFor(request);
  if (!allowed.includes(contentType)) {
    return res
      .status(400)
      .json({ error: `That file type is not accepted. Allowed: ${allowed.join(", ")}` });
  }

  const maxBytes = maxBytesFor(request);
  if (Number.isFinite(sizeBytes) && sizeBytes > maxBytes) {
    return res
      .status(400)
      .json({ error: `File is larger than the ${request.maxSizeMb} MB limit` });
  }

  const storageKey = submissionKey(request.id, session.userId, fileName);
  const url = await presignUpload(storageKey, contentType);

  return res.status(200).json({ url, storageKey });
}
