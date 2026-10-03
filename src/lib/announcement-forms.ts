import { asc, eq } from "drizzle-orm";

import { announcementForms } from "@/db/schema";
import { db } from "@/lib/db";
import { fieldOf } from "@/lib/forms";
import { isAdmin } from "@/lib/roles";

/*
  Server-only helpers for the field requests attached to an announcement.
  Mirrors ./announcement-documents.ts for the file-request links.
*/

/** Validated list of form-request ids from a request body. */
export function parseFormRequestIds(body: unknown): number[] {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(raw.formIds)) return [];
  return Array.from(
    new Set(
      raw.formIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
}

/** Replaces the links for one announcement. Ignores ids that do not exist. */
export async function setAnnouncementForms(
  announcementId: number,
  requestIds: number[]
) {
  await db
    .delete(announcementForms)
    .where(eq(announcementForms.announcementId, announcementId));
  if (requestIds.length === 0) return;

  await db
    .insert(announcementForms)
    .values(requestIds.map((requestId) => ({ announcementId, requestId })))
    .onConflictDoNothing();
}

type LinkedRow = {
  request: {
    id: number;
    title: string;
    audience: string;
    dueDate: string | null;
    closedAt: Date | null;
    fields: {
      id: number;
      label: string;
      type: string;
      required: boolean;
      placeholder: string | null;
      options: string | null;
    }[];
    assignees: { userId: number }[];
    submissions: {
      id: number;
      userId: number;
      status: string;
      reviewNote: string | null;
      submittedAt: Date;
      values: { fieldId: number; value: string }[];
    }[];
  } | null;
};

/**
 * Shapes linked form requests for one viewer, the same way linked documents
 * are shaped: members see only what targets them plus their own answers, and
 * admins see every request with handed-in counts.
 */
export function shapeLinkedForms(
  rows: LinkedRow[],
  viewer: { userId: number; roles: readonly string[] },
  totalUsers: number
) {
  const viewerIsAdmin = isAdmin(viewer.roles);

  return rows
    .map((row) => row.request)
    .filter((r): r is NonNullable<LinkedRow["request"]> => Boolean(r))
    .filter((r) => {
      if (viewerIsAdmin) return true;
      return (
        r.audience === "all" ||
        r.assignees.some((a) => a.userId === viewer.userId)
      );
    })
    .map(({ assignees, submissions, fields, ...request }) => ({
      ...request,
      fields: fields.map(fieldOf),
      assigneeCount: request.audience === "all" ? totalUsers : assignees.length,
      ...(viewerIsAdmin
        ? {
            submittedCount: submissions.length,
            approvedCount: submissions.filter((s) => s.status === "approved")
              .length,
          }
        : {
            mySubmission:
              submissions.find((s) => s.userId === viewer.userId) ?? null,
          }),
    }));
}

/** The `with` clause every announcement query needs to hydrate its forms. */
export const announcementFormsWith = {
  forms: {
    with: {
      request: {
        with: {
          fields: {
            columns: {
              id: true,
              label: true,
              type: true,
              required: true,
              placeholder: true,
              options: true,
            },
            orderBy: (fields: { sortOrder: unknown; id: unknown }, operators: { asc: typeof asc }) =>
              [operators.asc(fields.sortOrder as never), operators.asc(fields.id as never)],
          },
          assignees: { columns: { userId: true } },
          submissions: {
            columns: {
              id: true,
              userId: true,
              status: true,
              reviewNote: true,
              submittedAt: true,
            },
            with: {
              values: { columns: { fieldId: true, value: true } },
            },
          },
        },
      },
    },
  },
} as const;
