import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { announcementFiles } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { presignDownload, presignInline } from "@/lib/storage";

/**
 * Fresh short-lived URL for one announcement attachment.
 *
 * Announcements are visible to every member, so any authenticated user may
 * fetch a URL. The URL itself expires in about a minute, which keeps the
 * bucket private while still letting the browser open the file without leaving
 * the page.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid attachment ID" });
  }

  const row = await db.query.announcementFiles.findFirst({
    where: eq(announcementFiles.id, id),
  });
  if (!row) {
    return res.status(404).json({ error: "Attachment not found" });
  }

  const inline = req.query.mode === "inline";
  const url = inline
    ? await presignInline(row.storageKey, row.fileName, row.mimeType)
    : await presignDownload(row.storageKey, row.fileName);

  return res.status(200).json({ url });
}
