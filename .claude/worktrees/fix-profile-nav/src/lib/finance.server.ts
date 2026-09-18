import { asc, desc, eq, sql } from "drizzle-orm";

import {
  financeCategories,
  financeDocuments,
  financeEntries,
  financeSeasons,
} from "@/db/schema";
import { db } from "@/lib/db";
import { verifyUploadedType } from "@/lib/file-requests";
import {
  FINANCE_ALLOWED_TYPES,
  FINANCE_DOC_MAX_MB,
  shapeDocument,
  shapeEntry,
  toRonBani,
  type EntryKind,
  type EntryRow,
  type FinanceDocumentInput,
  type FinanceDocumentView,
  type Viewer,
} from "@/lib/finance";
import { deleteObject, deleteObjects, probeObject } from "@/lib/storage";

export type {
  FinanceDocumentView,
  FinanceEntryView,
  Viewer,
} from "@/lib/finance";

/*
  Everything in the ledger that touches the database. Kept out of ./finance.ts
  so the page can import the money helpers without dragging Neon into the
  browser bundle — the same split as file-requests / file-requests.server.
*/

export async function listEntries(seasonId: number, viewer: Viewer) {
  const rows = await db.query.financeEntries.findMany({
    where: eq(financeEntries.seasonId, seasonId),
    with: { category: true, documents: true },
    orderBy: [desc(financeEntries.occurredOn), desc(financeEntries.id)],
  });
  return rows.map((row) => shapeEntry(row as EntryRow, viewer));
}

export async function findEntry(id: number, viewer: Viewer) {
  const row = await db.query.financeEntries.findFirst({
    where: eq(financeEntries.id, id),
    with: { category: true, documents: true },
  });
  return row ? shapeEntry(row as EntryRow, viewer) : null;
}

/*
  Seasons and categories
*/

export function listSeasons() {
  return db
    .select()
    .from(financeSeasons)
    .orderBy(desc(financeSeasons.startDate));
}

export function listCategories() {
  return db
    .select()
    .from(financeCategories)
    .orderBy(asc(financeCategories.kind), asc(financeCategories.name));
}

/**
 * Marks one season current and clears the rest, so "which season are we in?"
 * always has exactly one answer.
 */
export async function setCurrentSeason(id: number) {
  await db
    .update(financeSeasons)
    .set({ isCurrent: false })
    .where(eq(financeSeasons.isCurrent, true));
  await db
    .update(financeSeasons)
    .set({ isCurrent: true })
    .where(eq(financeSeasons.id, id));
}

export async function countEntriesForSeason(seasonId: number) {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(financeEntries)
    .where(eq(financeEntries.seasonId, seasonId));
  return Number(row.count);
}

export async function countEntriesForCategory(categoryId: number) {
  const [row] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(financeEntries)
    .where(eq(financeEntries.categoryId, categoryId));
  return Number(row.count);
}

/*
  Summary
*/

export interface SeasonSummary {
  totalIncomeBani: number;
  totalExpenseBani: number;
  /** What this season alone brought in or cost: income minus expenses. */
  seasonNetBani: number;
  /** Carried in from every earlier season — the bank does not reset in September. */
  openingBalanceBani: number;
  /** Money actually in the bank: everything carried over, plus this season's net. */
  balanceBani: number;
  entryCount: number;
  byCategory: {
    categoryId: number;
    name: string;
    kind: EntryKind;
    colorIndex: number;
    totalBani: number;
  }[];
  byMonth: { month: string; incomeBani: number; expenseBani: number }[];
}

/**
 * Everything the Overview tab draws, in three queries rather than pulling the
 * season's rows into the function and adding them up in JavaScript.
 *
 * Every figure sums `amount_ron_bani`, the column frozen at write time, so the
 * charts and the entry list can never tell different stories.
 */
export async function seasonSummary(seasonId: number): Promise<SeasonSummary> {
  const season = await db.query.financeSeasons.findFirst({
    where: eq(financeSeasons.id, seasonId),
  });
  if (!season) throw new Error(`Season ${seasonId} not found`);

  const totals = await db
    .select({
      kind: financeEntries.kind,
      total: sql<number>`COALESCE(SUM(${financeEntries.amountRonBani}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(financeEntries)
    .where(eq(financeEntries.seasonId, seasonId))
    .groupBy(financeEntries.kind);

  const byCategoryRows = await db
    .select({
      categoryId: financeCategories.id,
      name: financeCategories.name,
      kind: financeCategories.kind,
      colorIndex: financeCategories.colorIndex,
      totalBani: sql<number>`COALESCE(SUM(${financeEntries.amountRonBani}), 0)`,
    })
    .from(financeEntries)
    .innerJoin(
      financeCategories,
      eq(financeEntries.categoryId, financeCategories.id)
    )
    .where(eq(financeEntries.seasonId, seasonId))
    .groupBy(
      financeCategories.id,
      financeCategories.name,
      financeCategories.kind,
      financeCategories.colorIndex
    );

  const byMonthRows = await db
    .select({
      month: sql<string>`TO_CHAR(${financeEntries.occurredOn}, 'YYYY-MM')`,
      kind: financeEntries.kind,
      total: sql<number>`COALESCE(SUM(${financeEntries.amountRonBani}), 0)`,
    })
    .from(financeEntries)
    .where(eq(financeEntries.seasonId, seasonId))
    .groupBy(sql`1`, financeEntries.kind)
    .orderBy(sql`1`);

  /*
    Everything banked before this season started.

    Seasons are ordered by when they begin, with the id breaking a tie, so two
    seasons created on the same day still have a definite order. Income counts
    up and expenses count down, giving the balance the team carried in.
  */
  const [opening] = await db
    .select({
      total: sql<number>`COALESCE(SUM(
        CASE WHEN ${financeEntries.kind} = 'income'
          THEN ${financeEntries.amountRonBani}
          ELSE -${financeEntries.amountRonBani}
        END), 0)`,
    })
    .from(financeEntries)
    .innerJoin(financeSeasons, eq(financeEntries.seasonId, financeSeasons.id))
    .where(
      sql`(${financeSeasons.startDate}, ${financeSeasons.id}) < (${season.startDate}, ${season.id})`
    );

  const totalIncomeBani = Number(
    totals.find((t) => t.kind === "income")?.total ?? 0
  );
  const totalExpenseBani = Number(
    totals.find((t) => t.kind === "expense")?.total ?? 0
  );
  const openingBalanceBani = Number(opening.total);
  const seasonNetBani = totalIncomeBani - totalExpenseBani;

  // One row per month with both sides filled in, so the bar chart does not have
  // to reconcile two sparse series while it draws.
  const months = new Map<string, { incomeBani: number; expenseBani: number }>();
  for (const row of byMonthRows) {
    const bucket = months.get(row.month) ?? { incomeBani: 0, expenseBani: 0 };
    if (row.kind === "income") bucket.incomeBani = Number(row.total);
    else bucket.expenseBani = Number(row.total);
    months.set(row.month, bucket);
  }

  return {
    totalIncomeBani,
    totalExpenseBani,
    seasonNetBani,
    openingBalanceBani,
    balanceBani: openingBalanceBani + seasonNetBani,
    entryCount: totals.reduce((sum, t) => sum + Number(t.count), 0),
    byCategory: byCategoryRows
      .map((row) => ({
        categoryId: row.categoryId,
        name: row.name,
        kind: row.kind as EntryKind,
        colorIndex: row.colorIndex,
        totalBani: Number(row.totalBani),
      }))
      .sort((a, b) => b.totalBani - a.totalBani),
    byMonth: [...months.entries()]
      .map(([month, sums]) => ({ month, ...sums }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}

/*
  Documents
*/

/**
 * Records a document after the client has uploaded it straight to the bucket.
 * The object is probed first — a presigned PUT can lie about both size and
 * type, so the stored reference only reflects what is really there.
 */
export async function createFinanceDocument(
  entryId: number,
  input: FinanceDocumentInput
): Promise<
  | { ok: true; document: FinanceDocumentView }
  | { ok: false; error: string; status?: number }
> {
  const prefix = `finance/${entryId}/`;
  if (!input.storageKey.startsWith(prefix)) {
    return { ok: false, error: "Storage key does not belong to this entry" };
  }

  const probe = await probeObject(input.storageKey);
  if (!probe) {
    return { ok: false, error: "The file did not upload, please try again", status: 404 };
  }
  if (probe.size > FINANCE_DOC_MAX_MB * 1024 * 1024) {
    await deleteObject(input.storageKey);
    return { ok: false, error: `File is larger than the ${FINANCE_DOC_MAX_MB} MB limit` };
  }

  const verified = verifyUploadedType(
    probe.head,
    probe.contentType,
    FINANCE_ALLOWED_TYPES
  );
  if (!verified.ok) {
    await deleteObject(input.storageKey);
    return { ok: false, error: verified.error };
  }

  const [row] = await db
    .insert(financeDocuments)
    .values({
      entryId,
      kind: input.kind,
      storageKey: input.storageKey,
      fileName: input.fileName,
      mimeType: verified.mimeType,
      sizeBytes: probe.size,
    })
    .returning();

  return { ok: true, document: shapeDocument(row) };
}

/** Removes a document and its object from the bucket. */
export async function deleteFinanceDocument(id: number): Promise<boolean> {
  const [row] = await db
    .select()
    .from(financeDocuments)
    .where(eq(financeDocuments.id, id));
  if (!row) return false;

  await Promise.all([
    deleteObject(row.storageKey),
    db.delete(financeDocuments).where(eq(financeDocuments.id, id)),
  ]);
  return true;
}

/*
  Entries
*/

/** The derived columns, computed in one place so create and update agree. */
export function entryValues(
  input: {
    amountMinor: number;
    rateToRonMicros: number;
  },
  kind: EntryKind
) {
  return {
    kind,
    amountRonBani: toRonBani(input.amountMinor, input.rateToRonMicros),
  };
}

/**
 * Deletes an entry along with its stored objects. The rows cascade, but the
 * bucket does not, so the keys are collected first — the same order the user
 * deletion handler uses.
 */
export async function deleteEntry(id: number): Promise<boolean> {
  const docs = await db
    .select({ storageKey: financeDocuments.storageKey })
    .from(financeDocuments)
    .where(eq(financeDocuments.entryId, id));

  await deleteObjects(docs.map((d) => d.storageKey));

  const [deleted] = await db
    .delete(financeEntries)
    .where(eq(financeEntries.id, id))
    .returning({ id: financeEntries.id });
  return Boolean(deleted);
}

/**
 * The entry's `kind` is copied from its category, so the category has to be
 * loaded on every write — there is no way for the client to set the side of the
 * ledger directly, and no way for the two to disagree.
 */
export async function findCategory(categoryId: number) {
  const [row] = await db
    .select()
    .from(financeCategories)
    .where(eq(financeCategories.id, categoryId));
  return row ?? null;
}
