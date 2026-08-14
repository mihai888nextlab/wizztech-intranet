import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { announcements } from "@/db/schema";
import { createAttachment } from "@/lib/announcement-files";
import { parseAttachmentUpload } from "@/lib/announcements";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";

/** Creates an attachment once the client has uploaded the object itself. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await requireAdmin(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only admins can add files" });
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

  const parsed = parseAttachmentUpload(req.body, String(req.body?.storageKey ?? ""));
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const created = await createAttachment(id, parsed.value);
  if (!created.ok) {
    return res
      .status(created.status ?? 400)
      .json({ error: created.error });
  }

  return res.status(201).json(created.attachment);
}
