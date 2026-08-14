import { asc, eq } from "drizzle-orm";

import { formRequestAssignees, users } from "@/db/schema";
import { db } from "@/lib/db";
import { fieldOf } from "@/lib/forms";

/*
  Database-backed helpers for the form-request feature, kept apart from the
  pure validation in ./form-requests.ts so pages can import the client shapes
  without pulling the Postgres client into the browser bundle.
*/

/** Everyone a form request applies to. `audience: "all"` means every account. */
export async function assigneeIdsFor(request: {
  id: number;
  audience: string;
}): Promise<number[]> {
  if (request.audience === "all") {
    const rows = await db.select({ id: users.id }).from(users);
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ userId: formRequestAssignees.userId })
    .from(formRequestAssignees)
    .where(eq(formRequestAssignees.requestId, request.id));
  return rows.map((r) => r.userId);
}

export async function isTargeted(
  request: { id: number; audience: string },
  userId: number
) {
  const ids = await assigneeIdsFor(request);
  return ids.includes(userId);
}

/** Members may only answer a request that targets them and is still open. */
export async function canSubmit(
  request: { id: number; audience: string; closedAt: Date | null },
  userId: number
) {
  if (request.closedAt) return false;
  return isTargeted(request, userId);
}

/** The `with` clause every form-request query needs to hydrate its content. */
export const formRequestDetailWith = {
  author: { columns: { fullName: true, username: true } },
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
} as const;

type DetailRow = {
  audience: string;
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
};

/**
 * Shapes a hydrated form request for one viewer. Members see only the requests
 * aimed at them (callers filter first) plus their own answers; admins see the
 * handed-in and approved counts.
 */
export function shapeFormRequest(
  row: DetailRow,
  viewer: { userId: number; role: string },
  totalUsers: number
) {
  const isAdmin = viewer.role === "admin";
  const { assignees, submissions, fields, ...request } = row;

  return {
    ...request,
    fields: fields.map(fieldOf),
    assigneeCount: row.audience === "all" ? totalUsers : assignees.length,
    ...(row.audience === "selected"
      ? { assigneeIds: assignees.map((a) => a.userId) }
      : {}),
    ...(isAdmin
      ? {
          submittedCount: submissions.length,
          approvedCount: submissions.filter((s) => s.status === "approved")
            .length,
        }
      : {
          mySubmission:
            submissions.find((s) => s.userId === viewer.userId) ?? null,
        }),
  };
}

export async function countUsers() {
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}
