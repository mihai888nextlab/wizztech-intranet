import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { financeSeasons } from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSeasonInput } from "@/lib/finance";
import { countEntriesForSeason, setCurrentSeason } from "@/lib/finance.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await requireFinance(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only finance and admins can change seasons" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid season ID" });
  }

  const season = await db.query.financeSeasons.findFirst({
    where: eq(financeSeasons.id, id),
  });
  if (!season) {
    return res.status(404).json({ error: "Season not found" });
  }

  if (req.method === "PATCH") {
    const parsed = parseSeasonInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const [updated] = await db
      .update(financeSeasons)
      .set({
        name: parsed.value.name,
        startDate: parsed.value.startDate,
        endDate: parsed.value.endDate,
      })
      .where(eq(financeSeasons.id, id))
      .returning();

    if (parsed.value.isCurrent && !season.isCurrent) {
      await setCurrentSeason(id);
      updated.isCurrent = true;
    }

    return res.status(200).json(updated);
  }

  if (req.method === "DELETE") {
    // Refused rather than cascaded: deleting a season would silently take a
    // year of bookkeeping and its paperwork with it.
    const entries = await countEntriesForSeason(id);
    if (entries > 0) {
      return res.status(409).json({
        error: `That season still has ${entries} ${entries === 1 ? "entry" : "entries"}. Move or delete them first.`,
      });
    }

    await db.delete(financeSeasons).where(eq(financeSeasons.id, id));
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
