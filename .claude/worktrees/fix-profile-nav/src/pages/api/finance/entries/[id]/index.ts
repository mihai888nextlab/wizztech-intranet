import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { financeEntries, financeSeasons } from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseEntryInput, toRonBani } from "@/lib/finance";
import { deleteEntry, findCategory, findEntry } from "@/lib/finance.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireFinance(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only finance and admins can change entries" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid entry ID" });
  }

  const existing = await db.query.financeEntries.findFirst({
    where: eq(financeEntries.id, id),
  });
  if (!existing) {
    return res.status(404).json({ error: "Entry not found" });
  }

  if (req.method === "PATCH") {
    const parsed = parseEntryInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const season = await db.query.financeSeasons.findFirst({
      where: eq(financeSeasons.id, parsed.value.seasonId),
    });
    if (!season) {
      return res.status(404).json({ error: "Season not found" });
    }

    const category = await findCategory(parsed.value.categoryId);
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    await db
      .update(financeEntries)
      .set({
        ...parsed.value,
        kind: category.kind,
        amountRonBani: toRonBani(parsed.value.amountMinor, parsed.value.rateToRonMicros),
        updatedAt: new Date(),
      })
      .where(eq(financeEntries.id, id));

    const entry = await findEntry(id, { userId: session.userId, role: session.role });
    return res.status(200).json(entry);
  }

  if (req.method === "DELETE") {
    // Takes the stored documents with it — the rows cascade, the bucket does not.
    const removed = await deleteEntry(id);
    if (!removed) {
      return res.status(404).json({ error: "Entry not found" });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
