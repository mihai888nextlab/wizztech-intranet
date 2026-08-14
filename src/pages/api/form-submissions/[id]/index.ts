import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { formSubmissions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseReviewInput } from "@/lib/file-requests";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid submission ID" });
  }

  const submission = await db.query.formSubmissions.findFirst({
    where: eq(formSubmissions.id, id),
  });
  if (!submission) {
    return res.status(404).json({ error: "Submission not found" });
  }

  if (req.method === "PATCH") {
    if (session.role !== "admin") {
      return res.status(403).json({ error: "Only admins can review submissions" });
    }
    const parsed = parseReviewInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const [updated] = await db
      .update(formSubmissions)
      .set({
        status: parsed.value.status,
        reviewNote: parsed.value.reviewNote,
        reviewedBy: session.userId,
        reviewedAt: new Date(),
      })
      .where(eq(formSubmissions.id, id))
      .returning();

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    // Members may withdraw their own answers; admins may remove any.
    const isOwner = submission.userId === session.userId;
    if (session.role !== "admin" && !isOwner) {
      return res.status(403).json({ error: "Not allowed" });
    }
    await db.delete(formSubmissions).where(eq(formSubmissions.id, id));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
