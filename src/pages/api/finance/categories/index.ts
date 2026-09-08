import type { NextApiRequest, NextApiResponse } from "next";

import { financeCategories } from "@/db/schema";
import { getSession, requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseCategoryInput } from "@/lib/finance";
import { listCategories } from "@/lib/finance.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const session = await getSession(req, res);
    if (!session.isLoggedIn) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    return res.status(200).json(await listCategories());
  }

  if (req.method === "POST") {
    const session = await requireFinance(req, res);
    if (!session) {
      return res.status(401).json({ error: "Only finance and admins can add categories" });
    }

    const parsed = parseCategoryInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const existing = await db.query.financeCategories.findFirst({
      where: (categories, { and, eq }) =>
        and(eq(categories.name, parsed.value.name), eq(categories.kind, parsed.value.kind)),
    });
    if (existing) {
      return res.status(409).json({ error: "That category already exists" });
    }

    const [created] = await db
      .insert(financeCategories)
      .values(parsed.value)
      .returning();

    return res.status(201).json(created);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
