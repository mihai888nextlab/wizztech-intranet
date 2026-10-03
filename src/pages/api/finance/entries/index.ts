import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { financeEntries, financeSeasons } from "@/db/schema";
import { currentRoles, getSession, requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseEntryInput, toRonBani } from "@/lib/finance";
import { findCategory, findEntry, listEntries } from "@/lib/finance.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const session = await getSession(req, res);
    if (!session.isLoggedIn) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const seasonId = parseInt(req.query.seasonId as string, 10);
    if (isNaN(seasonId)) {
      return res.status(400).json({ error: "A season is required" });
    }

    // The list is shaped per reader: everyone sees the money, only treasurers
    // see the paperwork behind it.
    return res
      .status(200)
      .json(
        await listEntries(seasonId, {
          userId: session.userId,
          roles: await currentRoles(session),
        })
      );
  }

  if (req.method === "POST") {
    const session = await requireFinance(req, res);
    if (!session) {
      return res.status(401).json({ error: "Only finance and admins can add entries" });
    }

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

    const [created] = await db
      .insert(financeEntries)
      .values({
        ...parsed.value,
        // Copied from the category rather than taken from the client, so the
        // two can never disagree about which side of the ledger this is.
        kind: category.kind,
        amountRonBani: toRonBani(parsed.value.amountMinor, parsed.value.rateToRonMicros),
        createdBy: session.userId,
      })
      .returning();

    const entry = await findEntry(created.id, {
      userId: session.userId,
      roles: await currentRoles(session),
    });
    return res.status(201).json(entry);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
