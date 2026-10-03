import type { NextApiRequest, NextApiResponse } from "next";
import { eq, inArray } from "drizzle-orm";

import {
  formRequestAssignees,
  formRequests,
  formRequestFields,
  users,
} from "@/db/schema";
import { currentRoles, getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { db } from "@/lib/db";
import { parseFormRequestInput } from "@/lib/form-requests";
import {
  assigneeIdsFor,
  countUsers,
  formRequestDetailWith,
  shapeFormRequest,
} from "@/lib/form-requests.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  // Fresh from the database, not the cookie, so a role change applies at once.
  const roles = await currentRoles(session);

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const request = await db.query.formRequests.findFirst({
    where: eq(formRequests.id, id),
    with: formRequestDetailWith,
  });
  if (!request) {
    return res.status(404).json({ error: "Form request not found" });
  }

  const viewerIsAdmin = isAdmin(roles);

  if (req.method === "GET") {
    const assigneeIds = await assigneeIdsFor(request);

    if (!viewerIsAdmin) {
      if (!assigneeIds.includes(session.userId)) {
        return res.status(404).json({ error: "Form request not found" });
      }
      return res
        .status(200)
        .json(shapeFormRequest(request, session, await countUsers()));
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
              roles: users.roles,
            })
            .from(users)
            .where(inArray(users.id, assigneeIds));

    return res.status(200).json({
      ...shapeFormRequest(request, session, await countUsers()),
      roster: roster
        .map((member) => ({
          user: member,
          submission:
            request.submissions.find((s) => s.userId === member.id) ?? null,
        }))
        .sort((a, b) => a.user.fullName.localeCompare(b.user.fullName)),
    });
  }

  if (!viewerIsAdmin) {
    return res.status(403).json({ error: "Only admins can manage form requests" });
  }

  if (req.method === "PATCH") {
    // `closed` can be toggled on its own, without resending every field.
    if (
      typeof req.body?.closed === "boolean" &&
      req.body.title === undefined
    ) {
      const [updated] = await db
        .update(formRequests)
        .set({
          closedAt: req.body.closed ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(formRequests.id, id))
        .returning();
      return res.status(200).json(updated);
    }

    const parsed = parseFormRequestInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { assigneeIds, fields, ...base } = parsed.value;

    const [updated] = await db
      .update(formRequests)
      .set({ ...base, updatedAt: new Date() })
      .where(eq(formRequests.id, id))
      .returning();

    // Replace the target list and the fields wholesale; both are small.
    await db
      .delete(formRequestAssignees)
      .where(eq(formRequestAssignees.requestId, id));
    if (base.audience === "selected") {
      await db.insert(formRequestAssignees).values(
        assigneeIds.map((userId) => ({ requestId: id, userId }))
      );
    }

    await db
      .delete(formRequestFields)
      .where(eq(formRequestFields.requestId, id));
    await db.insert(formRequestFields).values(
      fields.map((field, index) => ({
        requestId: id,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder,
        options: field.type === "select" ? JSON.stringify(field.options) : null,
        sortOrder: index,
      }))
    );

    const hydrated = await db.query.formRequests.findFirst({
      where: eq(formRequests.id, id),
      with: formRequestDetailWith,
    });
    if (!hydrated) return res.status(200).json(updated);

    return res
      .status(200)
      .json(shapeFormRequest(hydrated, session, await countUsers()));
  }

  if (req.method === "DELETE") {
    // Submissions and values cascade through the request id.
    await db.delete(formRequests).where(eq(formRequests.id, id));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
