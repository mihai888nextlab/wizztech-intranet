import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { financeCategories } from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCategoryInput } from "@/lib/finance";
import { countEntriesForCategory } from "@/lib/finance.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireFinance(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only finance and admins can change categories" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid category ID" });
  }

  const category = await db.query.financeCategories.findFirst({
    where: eq(financeCategories.id, id),
  });
  if (!category) {
    return res.status(404).json({ error: "Category not found" });
  }

  if (req.method === "PATCH") {
    // Archiving is a separate, simpler request than a rename.
    if (typeof req.body?.archived === "boolean") {
      const [updated] = await db
        .update(financeCategories)
        .set({ archivedAt: req.body.archived ? new Date() : null })
        .where(eq(financeCategories.id, id))
        .returning();
      return res.status(200).json(updated);
    }

    const parsed = parseCategoryInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    // The side of the ledger is fixed: entries copy `kind` from their category,
    // so flipping it would rewrite history for every entry already filed here.
    if (parsed.value.kind !== category.kind) {
      return res.status(400).json({
        error: "A category cannot move between income and expense. Archive it and make a new one.",
      });
    }

    const [updated] = await db
      .update(financeCategories)
      .set({ name: parsed.value.name, colorIndex: parsed.value.colorIndex })
      .where(eq(financeCategories.id, id))
      .returning();

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    // Once entries reference it, the name is part of the record — archive it so
    // old seasons still read correctly.
    const entries = await countEntriesForCategory(id);
    if (entries > 0) {
      const [archived] = await db
        .update(financeCategories)
        .set({ archivedAt: new Date() })
        .where(eq(financeCategories.id, id))
        .returning();
      return res.status(200).json({ archived: true, category: archived });
    }

    await db.delete(financeCategories).where(eq(financeCategories.id, id));
    return res.status(200).json({ archived: false });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
