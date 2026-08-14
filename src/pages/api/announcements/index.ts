import type { NextApiRequest, NextApiResponse } from "next";

import { announcements } from "@/db/schema";
import {
  announcementDocumentsWith,
  announcementsNewestFirst,
  countUsers,
  parseDocumentIds,
  setAnnouncementDocuments,
  shapeLinkedDocuments,
} from "@/lib/announcement-documents";
import {
  announcementFormsWith,
  parseFormRequestIds,
  setAnnouncementForms,
  shapeLinkedForms,
} from "@/lib/announcement-forms";
import {
  announcementFilesWith,
  shapeAttachment,
} from "@/lib/announcement-files";
import { parseAnnouncementInput } from "@/lib/announcements";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const [all, totalUsers] = await Promise.all([
      db.query.announcements.findMany({
        orderBy: announcementsNewestFirst,
        with: { ...announcementDocumentsWith, ...announcementFormsWith, ...announcementFilesWith },
      }),
      countUsers(),
    ]);

    return res.status(200).json(
      all.map(({ documents, forms, files, ...announcement }) => ({
        ...announcement,
        documents: shapeLinkedDocuments(documents, session, totalUsers),
        forms: shapeLinkedForms(forms, session, totalUsers),
        files: files.map(shapeAttachment),
      }))
    );
  }

  if (req.method === "POST") {
    if (session.role !== "admin") {
      return res.status(403).json({ error: "Only admins can post announcements" });
    }

    const parsed = parseAnnouncementInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const [created] = await db
      .insert(announcements)
      .values({ ...parsed.value, createdBy: session.userId })
      .returning();

    await setAnnouncementDocuments(created.id, parseDocumentIds(req.body));
    await setAnnouncementForms(created.id, parseFormRequestIds(req.body));

    const withDocuments = await db.query.announcements.findFirst({
      where: (a, { eq }) => eq(a.id, created.id),
      with: { ...announcementDocumentsWith, ...announcementFormsWith, ...announcementFilesWith },
    });

    const totalUsers = await countUsers();
    const { documents = [], forms = [], files = [], ...announcement } = withDocuments ?? {
      ...created,
      author: null,
      documents: [],
      forms: [],
      files: [],
    };

    return res.status(201).json({
      ...announcement,
      documents: shapeLinkedDocuments(documents, session, totalUsers),
      forms: shapeLinkedForms(forms, session, totalUsers),
      files: files.map(shapeAttachment),
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
