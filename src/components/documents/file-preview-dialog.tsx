import { useState } from "react";
import { Download, FileWarning, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { isPreviewable, type Submission } from "@/lib/documents";
import { formatBytes } from "@/lib/format";

interface FilePreviewDialogProps {
  submission: Submission | null;
  /** Whose file it is, shown in the header when an admin is reviewing. */
  ownerName?: string;
  onOpenChange: (open: boolean) => void;
}

export function FilePreviewDialog({
  submission,
  ownerName,
  onOpenChange,
}: FilePreviewDialogProps) {
  const [loaded, setLoaded] = useState(false);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  // Reset the spinner when a different file is opened.
  if (submission && submission.id !== loadedId) {
    setLoadedId(submission.id);
    setLoaded(false);
  }
  if (!submission && loadedId !== null) {
    setLoadedId(null);
  }

  const src = submission ? `/api/submissions/${submission.id}/preview` : "";
  const isPdf = submission?.mimeType === "application/pdf";
  const canPreview = submission ? isPreviewable(submission.mimeType) : false;

  return (
    <Dialog open={submission !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90dvh] max-h-[90dvh] w-full max-w-[calc(100%-1.5rem)] flex-col gap-3 p-3 sm:max-w-3xl sm:p-4">
        <DialogHeader className="pr-10">
          <DialogTitle className="truncate text-sm">
            {submission?.fileName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {ownerName ? `${ownerName} · ` : ""}
            {submission ? formatBytes(submission.sizeBytes) : ""}
          </p>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-muted/40 ring-1 ring-border">
          {submission && canPreview ? (
            <>
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner className="size-5 text-muted-foreground" />
                </div>
              )}
              {isPdf ? (
                // The signed URL is served from the storage origin, so this
                // document cannot reach the app's cookies or DOM.
                <iframe
                  key={submission.id}
                  src={src}
                  title={submission.fileName}
                  className="size-full border-0"
                  onLoad={() => setLoaded(true)}
                />
              ) : (
                <div className="flex size-full items-center justify-center overflow-auto p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    key={submission.id}
                    src={src}
                    alt={submission.fileName}
                    className="max-h-full max-w-full object-contain"
                    onLoad={() => setLoaded(true)}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="flex size-full flex-col items-center justify-center gap-3 p-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-xl bg-muted">
                <FileWarning className="size-5 text-muted-foreground" />
              </span>
              <div>
                <p className="font-heading text-sm font-medium">
                  Can&apos;t preview this format
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Browsers have no decoder for HEIC. Download it to open.
                </p>
              </div>
            </div>
          )}
        </div>

        {submission && (
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              size="lg"
              className="flex-1"
              nativeButton={false}
              render={<a href={`/api/submissions/${submission.id}/download`} />}
            >
              <Download /> Download
            </Button>
            {canPreview && (
              <Button
                variant="outline"
                size="lg"
                aria-label="Open in a new tab"
                nativeButton={false}
                render={<a href={src} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink /> New tab
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
