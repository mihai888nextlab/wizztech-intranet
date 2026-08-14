import { desc, eq } from "drizzle-orm";

import { announcementDocuments, announcements, users } from "@/db/schema";
import { db } from "@/lib/db";

/*
  Server-only helpers for the document requests attached to an announcement.
  Kept out of ./announcements.ts so pages can keep importing TITLE_MAX without
  dragging the database client into the browser bundle.
*/

/** Validated list of request ids from a request body. */
export function parseDocumentIds(body: unknown): number[] {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(raw.documentIds)) return [];
  return Array.from(
    new Set(
      raw.documentIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
}

/** Replaces the links for one announcement. Ignores ids that do not exist. */
export async function setAnnouncementDocuments(
  announcementId: number,
  requestIds: number[]
) {
  await db
    .delete(announcementDocuments)
    .where(eq(announcementDocuments.announcementId, announcementId));
  if (requestIds.length === 0) return;

  await db
    .insert(announcementDocuments)
    .values(requestIds.map((requestId) => ({ announcementId, requestId })))
    // A request deleted between the picker loading and the save landing would
    // otherwise blow up the whole insert.
    .onConflictDoNothing();
}

type LinkedRow = {
  request: {
    id: number;
    title: string;
    audience: string;
    dueDate: string | null;
    maxSizeMb: number;
    allowedTypes: string | null;
    closedAt: Date | null;
    assignees: { userId: number }[];
    submissions: {
      id: number;
      userId: number;
      status: string;
      fileName: string;
      sizeBytes: number;
      mimeType: string;
      reviewNote: string | null;
      uploadedAt: Date;
    }[];
  } | null;
};

/**
 * Shapes linked requests for one viewer.
 *
 * Members see only the requests aimed at them, each with their own submission
 * and nobody else's. Admins see every linked request with handed-in counts.
 */
export function shapeLinkedDocuments(
  rows: LinkedRow[],
  viewer: { userId: number; role: string },
  totalUsers: number
) {
  const isAdmin = viewer.role === "admin";

  return rows
    .map((row) => row.request)
    .filter((r): r is NonNullable<LinkedRow["request"]> => Boolean(r))
    .filter((r) => {
      if (isAdmin) return true;
      return (
        r.audience === "all" ||
        r.assignees.some((a) => a.userId === viewer.userId)
      );
    })
    .map(({ assignees, submissions, ...request }) => ({
      ...request,
      assigneeCount: request.audience === "all" ? totalUsers : assignees.length,
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
    }));
}

/** The `with` clause every announcement query needs to hydrate its documents. */
export const announcementDocumentsWith = {
  author: { columns: { fullName: true, username: true } },
  documents: {
    with: {
      request: {
        with: {
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
      },
    },
  },
} as const;

export async function countUsers() {
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}

export const announcementsNewestFirst = [desc(announcements.createdAt)];
