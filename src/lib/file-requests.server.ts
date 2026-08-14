import { eq } from "drizzle-orm";

import { fileRequestAssignees, users } from "@/db/schema";
import { db } from "@/lib/db";

/*
  Database-backed helpers, kept apart from the pure validation in
  ./file-requests.ts so that pages can import the shared constants without
  pulling the Postgres client into the browser bundle.
*/

/**
 * Everyone a request applies to. `audience: "all"` means every account,
 * admins included — predictable, and an admin who should not submit can use
 * "selected" instead.
 */
export async function assigneeIdsFor(request: {
  id: number;
  audience: string;
}): Promise<number[]> {
  if (request.audience === "all") {
    const rows = await db.select({ id: users.id }).from(users);
    return rows.map((r) => r.id);
  }
  const rows = await db
    .select({ userId: fileRequestAssignees.userId })
    .from(fileRequestAssignees)
    .where(eq(fileRequestAssignees.requestId, request.id));
  return rows.map((r) => r.userId);
}

export async function isTargeted(
  request: { id: number; audience: string },
  userId: number
) {
  const ids = await assigneeIdsFor(request);
  return ids.includes(userId);
}

/** Members may only upload to a request that targets them and is still open. */
export async function canSubmit(
  request: { id: number; audience: string; closedAt: Date | null },
  userId: number
) {
  if (request.closedAt) return false;
  return isTargeted(request, userId);
}
