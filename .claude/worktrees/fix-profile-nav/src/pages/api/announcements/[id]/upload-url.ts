import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { announcements } from "@/db/schema";
import { parseAttachmentUpload } from "@/lib/announcements";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachmentKey, isStorageConfigured, presignUpload } from "@/lib/storage";

/**
 * Hands an admin a short-lived URL to upload an announcement attachment
 * straight to object storage.
 *
 * Like file-request uploads, the checks here are for fast feedback only — the
 * authoritative size and type verification happens when the attachment is
 * recorded in ./attachments/index.ts, once the object actually exists.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await requireAdmin(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only admins can add files" });
  }

  if (!isStorageConfigured()) {
    return res.status(503).json({
      error: "File storage is not configured. Ask an admin to set the S3_* variables.",
    });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid announcement ID" });
  }

  const announcement = await db.query.announcements.findFirst({
    where: eq(announcements.id, id),
  });
  if (!announcement) {
    return res.status(404).json({ error: "Announcement not found" });
  }

  const parsed = parseAttachmentUpload(req.body);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const storageKey = attachmentKey(id, parsed.value.fileName);
  const url = await presignUpload(storageKey, parsed.value.contentType);

  return res.status(200).json({ url, storageKey });
}
