import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { fileSubmissions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseReviewInput } from "@/lib/file-requests";
import { notifySubmissionReviewed } from "@/lib/push-events";
import { deleteObject } from "@/lib/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
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

  const isAdmin = session.role === "admin";
  const isOwner = submission.userId === session.userId;

  if (req.method === "PATCH") {
    if (!isAdmin) {
      return res.status(403).json({ error: "Only admins can review submissions" });
    }
    const parsed = parseReviewInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const [updated] = await db
      .update(fileSubmissions)
      .set({
        status: parsed.value.status,
        reviewNote: parsed.value.reviewNote,
        reviewedBy: session.userId,
        reviewedAt: new Date(),
      })
      .where(eq(fileSubmissions.id, id))
      .returning();

    const request = await db.query.fileRequests.findFirst({
      where: (r, { eq: matches }) => matches(r.id, updated.requestId),
      columns: { id: true, title: true },
    });
    await notifySubmissionReviewed({
      ownerId: updated.userId,
      requestTitle: request?.title ?? "Your document",
      status: updated.status,
      reviewNote: updated.reviewNote,
      url: `/documents/${updated.requestId}`,
    });

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    // Members may withdraw their own file; admins may remove any.
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Not allowed" });
    }
    await deleteObject(submission.storageKey);
    await db.delete(fileSubmissions).where(eq(fileSubmissions.id, id));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
