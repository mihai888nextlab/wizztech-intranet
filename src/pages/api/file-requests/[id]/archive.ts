import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { ZipArchive } from "archiver";

import { fileRequests } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { getObjectStream, isStorageConfigured } from "@/lib/storage";

/**
 * Streams every file handed in for one request as a single ZIP.
 *
 * Streamed, never buffered: files go R2 -> archiver -> response, so a whole
 * team's paperwork never sits in the function's memory. Entries are stored
 * uncompressed because PDFs and JPEGs are already compressed — deflating them
 * again costs CPU and time for no size win.
 */
export const config = {
  // A team's worth of scans takes longer than the default budget.
  maxDuration: 60,
};

/** Total bytes above which we refuse rather than risk a timeout mid-stream. */
const MAX_ARCHIVE_BYTES = 400 * 1024 * 1024;

function safeEntryName(fullName: string, fileName: string) {
  const person = fullName.replace(/[^\w\s.-]+/g, "").trim() || "unknown";
  const file = fileName.replace(/[/\\]+/g, "-").replace(/^\.+/, "").trim() || "file";
  return `${person} - ${file}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await requireAdmin(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!isStorageConfigured()) {
    return res.status(503).json({ error: "File storage is not configured" });
  }

  const id = parseInt(req.query.id as string, 10);
  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid request ID" });
  }

  const request = await db.query.fileRequests.findFirst({
    where: eq(fileRequests.id, id),
    with: {
      submissions: {
        with: { user: { columns: { fullName: true } } },
      },
    },
  });
  if (!request) {
    return res.status(404).json({ error: "File request not found" });
  }

  const submissions = request.submissions;
  if (submissions.length === 0) {
    return res.status(404).json({ error: "Nothing has been handed in yet" });
  }

  const totalBytes = submissions.reduce((sum, s) => sum + s.sizeBytes, 0);
  if (totalBytes > MAX_ARCHIVE_BYTES) {
    return res.status(413).json({
      error:
        "These files are too large to zip in one go. Download them individually from the roster.",
    });
  }

  const zipName = `${request.title.replace(/[^\w\s-]+/g, "").trim() || "documents"}.zip`;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${zipName}"`);
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const archive = new ZipArchive({ store: true });

  // Once bytes are on the wire we cannot switch to a JSON error, so log and
  // drop the connection instead of sending a corrupt archive.
  archive.on("error", (err: Error) => {
    console.error("archive error", err);
    res.destroy();
  });
  archive.on("warning", (err: Error & { code?: string }) => {
    if (err.code !== "ENOENT") console.error("archive warning", err);
  });
  // If the admin cancels the download, stop pulling from storage.
  res.on("close", () => archive.destroy());

  archive.pipe(res);

  const used = new Set<string>();
  for (const submission of submissions) {
    const stream = await getObjectStream(submission.storageKey);
    if (!stream) continue; // object vanished; skip rather than fail the whole zip

    let name = safeEntryName(submission.user?.fullName ?? "unknown", submission.fileName);
    // Two people can upload files with the same name.
    if (used.has(name)) {
      const dot = name.lastIndexOf(".");
      const stem = dot > 0 ? name.slice(0, dot) : name;
      const ext = dot > 0 ? name.slice(dot) : "";
      let n = 2;
      while (used.has(`${stem} (${n})${ext}`)) n++;
      name = `${stem} (${n})${ext}`;
    }
    used.add(name);

    archive.append(stream, { name, date: submission.uploadedAt });
  }

  await archive.finalize();
}
