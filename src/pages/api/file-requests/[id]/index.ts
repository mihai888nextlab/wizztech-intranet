import type { NextApiRequest, NextApiResponse } from "next";
import { eq, inArray } from "drizzle-orm";

import { fileRequestAssignees, fileRequests, users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseFileRequestInput } from "@/lib/file-requests";
import { assigneeIdsFor } from "@/lib/file-requests.server";
import { deleteObjects } from "@/lib/storage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const request = await db.query.fileRequests.findFirst({
    where: eq(fileRequests.id, id),
    with: {
      author: { columns: { fullName: true, username: true } },
      submissions: true,
    },
  });
  if (!request) {
    return res.status(404).json({ error: "File request not found" });
  }

  const { submissions, ...requestFields } = request;
  const isAdmin = session.role === "admin";

  if (req.method === "GET") {
    const assigneeIds = await assigneeIdsFor(request);

    if (!isAdmin) {
      if (!assigneeIds.includes(session.userId)) {
        return res.status(404).json({ error: "File request not found" });
      }
      return res.status(200).json({
        ...requestFields,
        mySubmission:
          submissions.find((s) => s.userId === session.userId) ?? null,
      });
    }

    // Admin roster: every targeted member, with their submission if any.
    const roster =
      assigneeIds.length === 0
        ? []
        : await db
            .select({
              id: users.id,
              fullName: users.fullName,
              username: users.username,
              role: users.role,
            })
            .from(users)
            .where(inArray(users.id, assigneeIds));

    return res.status(200).json({
      ...requestFields,
      roster: roster
        .map((member) => ({
          user: member,
          submission: submissions.find((s) => s.userId === member.id) ?? null,
        }))
        .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName)),
    });
  }

  if (!isAdmin) {
    return res.status(403).json({ error: "Only admins can manage file requests" });
  }

  if (req.method === "PATCH") {
    // `closed` can be toggled on its own, without resending every field.
    if (
      typeof req.body?.closed === "boolean" &&
      req.body.title === undefined
    ) {
      const [updated] = await db
        .update(fileRequests)
        .set({
          closedAt: req.body.closed ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(fileRequests.id, id))
        .returning();
      return res.status(200).json(updated);
    }

    const parsed = parseFileRequestInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { assigneeIds, ...fields } = parsed.value;

    const [updated] = await db
      .update(fileRequests)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(fileRequests.id, id))
      .returning();

    // Replace the target list wholesale; it is small and this keeps it simple.
    await db
      .delete(fileRequestAssignees)
      .where(eq(fileRequestAssignees.requestId, id));
    if (fields.audience === "selected") {
      await db.insert(fileRequestAssignees).values(
        assigneeIds.map((userId) => ({ requestId: id, userId }))
      );
    }

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    // Row cascade does not reach object storage, so clear the bucket first.
    await deleteObjects(submissions.map((s) => s.storageKey));
    await db.delete(fileRequests).where(eq(fileRequests.id, id));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
