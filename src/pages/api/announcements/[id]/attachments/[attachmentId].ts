import type { NextApiRequest, NextApiResponse } from "next";

import { deleteAttachment } from "@/lib/announcement-files";
import { requireAdmin } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await requireAdmin(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only admins can remove files" });
  }

  const id = parseInt(req.query.id as string, 10);
  const attachmentId = parseInt(req.query.attachmentId as string, 10);
  if (isNaN(id) || isNaN(attachmentId)) {
    return res.status(400).json({ error: "Invalid attachment ID" });
  }

  const removed = await deleteAttachment(attachmentId);
  if (!removed) {
    return res.status(404).json({ error: "Attachment not found" });
  }

  return res.status(200).json({ success: true });
}
