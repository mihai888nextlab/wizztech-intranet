import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";

import {
  formRequestFields,
  formRequests,
  formSubmissionValues,
  formSubmissions,
} from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseFormValuesInput, type FormFieldType } from "@/lib/form-requests";
import { canSubmit } from "@/lib/form-requests.server";

/** Records (or replaces) a member's answers for one form request. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const request = await db.query.formRequests.findFirst({
    where: eq(formRequests.id, id),
  });
  if (!request) {
    return res.status(404).json({ error: "Form request not found" });
  }
  if (!(await canSubmit(request, session.userId))) {
    return res
      .status(403)
      .json({ error: "This request is closed or not assigned to you" });
  }

  const fieldRows = await db
    .select({
      id: formRequestFields.id,
      label: formRequestFields.label,
      type: formRequestFields.type,
      required: formRequestFields.required,
      options: formRequestFields.options,
    })
    .from(formRequestFields)
    .where(eq(formRequestFields.requestId, id))
    .orderBy(formRequestFields.sortOrder, formRequestFields.id);

  const rules = fieldRows.map((f) => ({
    id: f.id,
    label: f.label,
    type: (f.type || "text") as FormFieldType,
    required: f.required,
    options: f.options
      ? (JSON.parse(f.options) as string[])
      : [],
  }));

  const parsed = parseFormValuesInput(req.body, rules);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const existing = await db.query.formSubmissions.findFirst({
    where: and(
      eq(formSubmissions.requestId, request.id),
      eq(formSubmissions.userId, session.userId)
    ),
  });

  const [saved] = existing
    ? await db
        .update(formSubmissions)
        .set({
          status: "submitted",
          reviewNote: null,
          reviewedBy: null,
          reviewedAt: null,
          submittedAt: new Date(),
        })
        .where(eq(formSubmissions.id, existing.id))
        .returning()
    : await db
        .insert(formSubmissions)
        .values({ requestId: request.id, userId: session.userId })
        .returning();

  // Replace the answers wholesale, then re-read them with the submission.
  await db
    .delete(formSubmissionValues)
    .where(eq(formSubmissionValues.submissionId, saved.id));
  if (parsed.value.length > 0) {
    await db.insert(formSubmissionValues).values(
      parsed.value.map((v) => ({
        submissionId: saved.id,
        fieldId: v.fieldId,
        value: v.value,
      }))
    );
  }

  const hydrated = await db.query.formSubmissions.findFirst({
    where: eq(formSubmissions.id, saved.id),
    with: {
      values: { columns: { fieldId: true, value: true } },
    },
  });
  if (!hydrated) return res.status(201).json(saved);

  return res.status(201).json(hydrated);
}
