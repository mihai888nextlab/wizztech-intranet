import type { NextApiRequest, NextApiResponse } from "next";
import { desc, sql } from "drizzle-orm";

import { fileRequestAssignees, fileRequests, users } from "@/db/schema";
import { currentRoles, getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { db } from "@/lib/db";
import { parseFileRequestInput } from "@/lib/file-requests";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  // Fresh from the database, not the cookie, so a role change applies at once.
  const roles = await currentRoles(session);

  if (req.method === "GET") {
    const all = await db.query.fileRequests.findMany({
      orderBy: [desc(fileRequests.createdAt)],
      with: {
        author: { columns: { fullName: true, username: true } },
        assignees: { columns: { userId: true } },
        submissions: {
          columns: {
            id: true,
            userId: true,
            status: true,
            fileName: true,
            sizeBytes: true,
            mimeType: true,
            reviewNote: true,
            uploadedAt: true,
          },
        },
      },
    });

    // `audience: "all"` resolves to every account, so the roster size is just
    // the user count rather than a stored list.
    const [{ count }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(users);
    const totalUsers = Number(count);

    if (isAdmin(roles)) {
      return res.status(200).json(
        all.map(({ assignees, submissions, ...request }) => ({
          ...request,
          assigneeCount:
            request.audience === "all" ? totalUsers : assignees.length,
          submittedCount: submissions.length,
          approvedCount: submissions.filter((s) => s.status === "approved").length,
        }))
      );
    }

    // Members see only requests aimed at them, and only their own submission.
    const mine = all.filter(
      (request) =>
        request.audience === "all" ||
        request.assignees.some((a) => a.userId === session.userId)
    );

    return res.status(200).json(
      mine.map(({ assignees, submissions, ...request }) => ({
        ...request,
        assigneeCount:
          request.audience === "all" ? totalUsers : assignees.length,
        mySubmission: submissions.find((s) => s.userId === session.userId) ?? null,
      }))
    );
  }

  if (req.method === "POST") {
    if (!isAdmin(roles)) {
      return res.status(403).json({ error: "Only admins can request files" });
    }

    const parsed = parseFileRequestInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { assigneeIds, ...fields } = parsed.value;

    const [created] = await db
      .insert(fileRequests)
      .values({ ...fields, createdBy: session.userId })
      .returning();

    if (fields.audience === "selected") {
      await db.insert(fileRequestAssignees).values(
        assigneeIds.map((userId) => ({ requestId: created.id, userId }))
      );
    }

    return res.status(201).json({
      ...created,
      author: { fullName: session.fullName, username: session.username },
      assigneeCount: assigneeIds.length,
      submittedCount: 0,
      approvedCount: 0,
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
