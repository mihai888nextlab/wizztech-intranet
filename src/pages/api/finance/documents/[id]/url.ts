import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";

import { financeDocuments } from "@/db/schema";
import { requireFinance } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStorageConfigured, presignDownload, presignInline } from "@/lib/storage";

/**
 * Signs a link to one document.
 *
 * This is the gate the whole "everyone reads the numbers, treasurers read the
 * paperwork" rule rests on: the entry list already withholds document ids from
 * everyone else, and this route refuses them even if one were guessed.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await requireFinance(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only finance and admins can open documents" });
  }

  if (!isStorageConfigured()) {
    return res.status(503).json({ error: "File storage is not configured" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid document ID" });
  }

  const document = await db.query.financeDocuments.findFirst({
    where: eq(financeDocuments.id, id),
  });
  if (!document) {
    return res.status(404).json({ error: "Document not found" });
  }

  const url =
    req.query.mode === "inline"
      ? await presignInline(document.storageKey, document.fileName, document.mimeType)
      : await presignDownload(document.storageKey, document.fileName);

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ url });
}
