import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { financeEntries } from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseFinanceDocumentUpload } from "@/lib/finance";
import { createFinanceDocument } from "@/lib/finance.server";

/** Records a document once the client has uploaded the object itself. */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await requireFinance(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only finance and admins can add documents" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid entry ID" });
  }

  const entry = await db.query.financeEntries.findFirst({
    where: eq(financeEntries.id, id),
  });
  if (!entry) {
    return res.status(404).json({ error: "Entry not found" });
  }

  const parsed = parseFinanceDocumentUpload(
    req.body,
    String(req.body?.storageKey ?? "")
  );
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.error });
  }

  const created = await createFinanceDocument(id, parsed.value);
  if (!created.ok) {
    return res.status(created.status ?? 400).json({ error: created.error });
  }

  return res.status(201).json(created.document);
}
