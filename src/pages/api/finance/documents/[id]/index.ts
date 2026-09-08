import type { NextApiRequest, NextApiResponse } from "next";

import { requireFinance } from "@/lib/auth";
import { deleteFinanceDocument } from "@/lib/finance.server";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await requireFinance(req, res);
  if (!session) {
    return res.status(401).json({ error: "Only finance and admins can remove documents" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid document ID" });
  }

  const removed = await deleteFinanceDocument(id);
  if (!removed) {
    return res.status(404).json({ error: "Document not found" });
  }

  return res.status(200).json({ success: true });
}
