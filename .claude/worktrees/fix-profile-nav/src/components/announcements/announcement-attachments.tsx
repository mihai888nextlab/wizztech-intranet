import { useRef, useState, type ChangeEvent } from "react";
import { Download, Eye, FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { isPreviewable } from "@/lib/documents";
import { formatBytes } from "@/lib/format";

/** A file an admin attached to an announcement, stored in the bucket. */
export interface AnnouncementAttachment {
  id: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

/**
 * Attachments live directly on the posted announcement: admins add or remove
 * files at any time, and everyone else just gets the links. Members never touch
 * the add/remove controls, so the whole section is hidden for them when empty.
 */
export function AnnouncementAttachments({
  announcementId,
  files,
  isAdmin,
  onChanged,
}: {
  announcementId: number;
  files: AnnouncementAttachment[];
  isAdmin: boolean;
  onChanged: (files: AnnouncementAttachment[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [removing, setRemoving] = useState<AnnouncementAttachment | null>(null);

  if (files.length === 0 && !isAdmin) return null;

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(file.name);
    try {
      const res = await fetch(`/api/announcements/${announcementId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "That file could not be attached");
        return;
      }
      const { url, storageKey } = await res.json();

      const put = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) {
        toast.error("Upload failed, please try again");
        return;
      }

      const saved = await fetch(`/api/announcements/${announcementId}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey,
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          sizeBytes: file.size,
        }),
      });
      if (!saved.ok) {
        const data = await saved.json().catch(() => null);
        toast.error(data?.error || "Could not save the file");
        return;
      }

      onChanged([await saved.json(), ...files]);
      toast.success("File attached");
    } catch {
      toast.error("Connection error");
    } finally {
      setUploading(null);
    }
  };

  const openAttachment = async (file: AnnouncementAttachment, inline: boolean) => {
    setOpening(file.id);
    try {
      const res = await fetch(
        `/api/announcement-attachments/${file.id}/url?mode=${inline ? "inline" : "download"}`
      );
      if (!res.ok) {
        toast.error("Could not open the file");
        return;
      }
      const { url } = await res.json();
      const anchor = document.createElement("a");
      anchor.href = url;
      if (inline) anchor.target = "_blank";
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast.error("Connection error");
    } finally {
      setOpening(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const res = await fetch(
      `/api/announcements/${announcementId}/attachments/${removing.id}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onChanged(files.filter((f) => f.id !== removing.id));
      toast.success("File removed");
    } else {
      toast.error("Could not remove the file");
    }
    setRemoving(null);
  };

  return (
    <section className="mt-4 space-y-2 border-t border-border pt-4">
      <h3 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Paperclip className="size-3.5" />
        {isAdmin ? "Attachments" : "Documents"}
      </h3>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg bg-muted/40 p-3 ring-1 ring-border"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(file.sizeBytes)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={opening === file.id}
                  onClick={() => openAttachment(file, false)}
                >
                  {opening === file.id ? <Spinner /> : <Download />} Download
                </Button>
                {isPreviewable(file.mimeType) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Preview ${file.fileName}`}
                    disabled={opening === file.id}
                    onClick={() => openAttachment(file, true)}
                  >
                    <Eye />
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${file.fileName}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRemoving(file)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading !== null}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Spinner /> : <Paperclip />}
            {uploading ? `Uploading ${uploading}` : "Add file"}
          </Button>
          {files.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Attach reference documents — like a PDF to read or complete.
            </p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove "${removing?.fileName ?? ""}"?`}
        description="The file is deleted from storage for everyone. This cannot be undone."
        onConfirm={confirmRemove}
      />
    </section>
  );
}
