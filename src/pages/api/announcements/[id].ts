import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { announcements } from "@/db/schema";
import { requireAuth } from "@/lib/auth";
import { parseAnnouncementInput } from "@/lib/announcements";
import {
  announcementDocumentsWith,
  countUsers,
  parseDocumentIds,
  setAnnouncementDocuments,
  shapeLinkedDocuments,
} from "@/lib/announcement-documents";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireAuth(req, res, ["admin"]);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid announcement ID" });
  }

  if (req.method === "DELETE") {
    const [deleted] = await db
      .delete(announcements)
      .where(eq(announcements.id, id))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: "Announcement not found" });
    }
    return res.status(200).json({ success: true });
  }

  if (req.method === "PATCH") {
    const parsed = parseAnnouncementInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const [updated] = await db
      .update(announcements)
      .set({ ...parsed.value, updatedAt: new Date() })
      .where(eq(announcements.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Announcement not found" });
    }

    await setAnnouncementDocuments(id, parseDocumentIds(req.body));

    const hydrated = await db.query.announcements.findFirst({
      where: eq(announcements.id, id),
      with: announcementDocumentsWith,
    });
    if (!hydrated) return res.status(200).json(updated);

    const { documents, ...announcement } = hydrated;
    return res.status(200).json({
      ...announcement,
      documents: shapeLinkedDocuments(documents, session, await countUsers()),
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
