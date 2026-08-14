import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { fileSubmissions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStorageConfigured, presignInline } from "@/lib/storage";

/**
 * Same authorisation as ./download, but redirects to an `inline` signed URL so
 * the browser renders the file rather than saving it. Used as the src of the
 * preview iframe/img, which is why it needs no CORS rule — an iframe or image
 * load is not a cross-origin fetch.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
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
    return res.status(400).json({ error: "Invalid submission ID" });
  }

  const submission = await db.query.fileSubmissions.findFirst({
    where: eq(fileSubmissions.id, id),
  });
  if (!submission) {
    return res.status(404).json({ error: "Submission not found" });
  }

  if (session.role !== "admin" && submission.userId !== session.userId) {
    return res.status(403).json({ error: "Not allowed" });
  }

  const url = await presignInline(
    submission.storageKey,
    submission.fileName,
    submission.mimeType
  );

  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.redirect(302, url);
}
