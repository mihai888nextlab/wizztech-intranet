import { useRef, useState, type ChangeEvent } from "react";
import { Download, Eye, FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { isPreviewable } from "@/lib/documents";
import {
  DOCUMENT_KINDS,
  type DocumentKind,
  type FinanceDocumentView,
} from "@/lib/finance";
import { formatBytes } from "@/lib/format";

/*
  The paperwork behind one entry — the proforma that was quoted, the invoice
  that was paid, the contract that was signed.

  Only treasurers ever reach this component. Everyone else sees a count on the
  entry row, because the API never sends them a document id to open.
*/

export function EntryDocuments({
  entryId,
  documents,
  onChanged,
}: {
  entryId: number;
  documents: FinanceDocumentView[];
  onChanged: (documents: FinanceDocumentView[]) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<DocumentKind>("invoice");
  const [uploading, setUploading] = useState<string | null>(null);
  const [opening, setOpening] = useState<number | null>(null);
  const [removing, setRemoving] = useState<FinanceDocumentView | null>(null);

  const handleFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(file.name);
    try {
      const contentType = file.type || "application/octet-stream";
      const res = await fetch(`/api/finance/entries/${entryId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
          kind,
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
        headers: { "Content-Type": contentType },
        body: file,
      });
      if (!put.ok) {
        toast.error("Upload failed, please try again");
        return;
      }

      const saved = await fetch(`/api/finance/entries/${entryId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storageKey,
          fileName: file.name,
          contentType,
          sizeBytes: file.size,
          kind,
        }),
      });
      if (!saved.ok) {
        const data = await saved.json().catch(() => null);
        toast.error(data?.error || "Could not save the document");
        return;
      }

      onChanged([await saved.json(), ...documents]);
      toast.success("Document attached");
    } catch {
      toast.error("Connection error");
    } finally {
      setUploading(null);
    }
  };

  const openDocument = async (doc: FinanceDocumentView, inline: boolean) => {
    setOpening(doc.id);
    try {
      const res = await fetch(
        `/api/finance/documents/${doc.id}/url?mode=${inline ? "inline" : "download"}`
      );
      if (!res.ok) {
        toast.error("Could not open the document");
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
    const res = await fetch(`/api/finance/documents/${removing.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onChanged(documents.filter((d) => d.id !== removing.id));
      toast.success("Document removed");
    } else {
      toast.error("Could not remove the document");
    }
    setRemoving(null);
  };

  return (
    <div className="space-y-2">
      {documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-lg bg-muted/40 p-3 ring-1 ring-border"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
                <FileText className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{doc.fileName}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {doc.kind} · {formatBytes(doc.sizeBytes)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={opening === doc.id}
                  onClick={() => openDocument(doc, false)}
                >
                  {opening === doc.id ? <Spinner /> : <Download />} Download
                </Button>
                {isPreviewable(doc.mimeType) && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Preview ${doc.fileName}`}
                    disabled={opening === doc.id}
                    onClick={() => openDocument(doc, true)}
                  >
                    <Eye />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${doc.fileName}`}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setRemoving(doc)}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={kind} onValueChange={(v) => v && setKind(v as DocumentKind)}>
          <SelectTrigger className="h-9 w-36" aria-label="Document type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOCUMENT_KINDS.map((k) => (
              <SelectItem key={k} value={k} className="capitalize">
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          {uploading ? `Uploading ${uploading}` : "Add document"}
        </Button>
      </div>
      {documents.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Attach the proforma, invoice, contract or receipt behind this entry.
        </p>
      )}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove "${removing?.fileName ?? ""}"?`}
        description="The file is deleted from storage. This cannot be undone."
        onConfirm={confirmRemove}
      />
    </div>
  );
}
