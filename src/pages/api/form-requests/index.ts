import type { NextApiRequest, NextApiResponse } from "next";
import { desc } from "drizzle-orm";

import { formRequestAssignees, formRequests, formRequestFields } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseFormRequestInput } from "@/lib/form-requests";
import {
  countUsers,
  formRequestDetailWith,
  shapeFormRequest,
} from "@/lib/form-requests.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "GET") {
    const [all, totalUsers] = await Promise.all([
      db.query.formRequests.findMany({
        orderBy: [desc(formRequests.createdAt)],
        with: formRequestDetailWith,
      }),
      countUsers(),
    ]);

    if (session.role === "admin") {
      return res.status(200).json(
        all.map((request) => shapeFormRequest(request, session, totalUsers))
      );
    }

    // Members see only requests aimed at them, and only their own answers.
    const mine = all.filter(
      (request) =>
        request.audience === "all" ||
        request.assignees.some((a) => a.userId === session.userId)
    );

    return res.status(200).json(
      mine.map((request) => shapeFormRequest(request, session, totalUsers))
    );
  }

  if (req.method === "POST") {
    if (session.role !== "admin") {
      return res.status(403).json({ error: "Only admins can request answers" });
    }

    const parsed = parseFormRequestInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { assigneeIds, fields, ...base } = parsed.value;

    const [created] = await db
      .insert(formRequests)
      .values({ ...base, createdBy: session.userId })
      .returning();

    if (base.audience === "selected") {
      await db.insert(formRequestAssignees).values(
        assigneeIds.map((userId) => ({ requestId: created.id, userId }))
      );
    }
    await db.insert(formRequestFields).values(
      fields.map((field, index) => ({
        requestId: created.id,
        label: field.label,
        type: field.type,
        required: field.required,
        placeholder: field.placeholder,
        options: field.type === "select" ? JSON.stringify(field.options) : null,
        sortOrder: index,
      }))
    );

    const hydrated = await db.query.formRequests.findFirst({
      where: (table, { eq }) => eq(table.id, created.id),
      with: formRequestDetailWith,
    });
    if (!hydrated) {
      return res.status(201).json({
        ...created,
        author: { fullName: session.fullName, username: session.username },
        fields: fields.map((field, index) => ({
          id: -index - 1,
          label: field.label,
          type: field.type,
          required: field.required,
          placeholder: field.placeholder,
          options: field.options,
        })),
        assigneeCount:
          base.audience === "all" ? (await countUsers()) : assigneeIds.length,
        submittedCount: 0,
        approvedCount: 0,
      });
    }

    return res
      .status(201)
      .json(shapeFormRequest(hydrated, session, await countUsers()));
  }

  return res.status(405).json({ error: "Method not allowed" });
}
