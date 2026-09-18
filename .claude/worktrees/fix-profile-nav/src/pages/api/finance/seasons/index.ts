import type { NextApiRequest, NextApiResponse } from "next";

import { financeSeasons } from "@/db/schema";
import { getSession, requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseSeasonInput } from "@/lib/finance";
import { listSeasons, setCurrentSeason } from "@/lib/finance.server";

/** The whole team can see which seasons exist; only treasurers add one. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const session = await getSession(req, res);
    if (!session.isLoggedIn) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    return res.status(200).json(await listSeasons());
  }

  if (req.method === "POST") {
    const session = await requireFinance(req, res);
    if (!session) {
      return res.status(401).json({ error: "Only finance and admins can add seasons" });
    }

    const parsed = parseSeasonInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const existing = await db.query.financeSeasons.findFirst({
      where: (seasons, { eq }) => eq(seasons.name, parsed.value.name),
    });
    if (existing) {
      return res.status(409).json({ error: "A season with that name already exists" });
    }

    const [created] = await db
      .insert(financeSeasons)
      .values({
        name: parsed.value.name,
        startDate: parsed.value.startDate,
        endDate: parsed.value.endDate,
      })
      .returning();

    // Done after the insert so the new row is the one left flagged.
    if (parsed.value.isCurrent) {
      await setCurrentSeason(created.id);
      created.isCurrent = true;
    }

    return res.status(201).json(created);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
