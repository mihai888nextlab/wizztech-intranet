import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Uploads with XMLHttpRequest rather than fetch: fetch cannot report upload
 * progress, and these are multi-megabyte scans on phone connections.
 */
function putWithProgress(
  url: string,
  file: File,
  onProgress: (percent: number) => void
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Storage rejected the upload (${xhr.status})`))
    );
    xhr.addEventListener("error", () =>
      reject(new Error("Network error while uploading"))
    );
    xhr.addEventListener("abort", () => reject(new Error("Upload cancelled")));
    xhr.send(file);
  });
}

interface UploadButtonProps {
  requestId: number;
  allowedTypes: string[];
  maxSizeMb: number;
  hasExisting: boolean;
  disabled?: boolean;
  onUploaded: (submission: unknown) => void;
  className?: string;
}

export function UploadButton({
  requestId,
  allowedTypes,
  maxSizeMb,
  hasExisting,
  disabled,
  onUploaded,
  className,
}: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const busy = progress !== null;

  const handleFile = async (file: File) => {
    // Fast local feedback; the server re-checks both size and real file type.
    if (file.size > maxSizeMb * 1024 * 1024) {
      toast.error(
        `That file is ${formatBytes(file.size)} — the limit is ${maxSizeMb} MB.`
      );
      return;
    }

    setProgress(0);
    try {
      const presignRes = await fetch(`/api/file-requests/${requestId}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!presignRes.ok) {
        const data = await presignRes.json().catch(() => null);
        throw new Error(data?.error || "Could not start the upload");
      }
      const { url, storageKey } = await presignRes.json();

      await putWithProgress(url, file, setProgress);

      const confirmRes = await fetch(`/api/file-requests/${requestId}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storageKey, fileName: file.name }),
      });
      if (!confirmRes.ok) {
        const data = await confirmRes.json().catch(() => null);
        throw new Error(data?.error || "The file was rejected");
      }

      onUploaded(await confirmRes.json());
      toast.success(hasExisting ? "File replaced" : "File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={allowedTypes.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        variant={hasExisting ? "outline" : "default"}
        size="lg"
        className={cn("relative overflow-hidden", className)}
        disabled={disabled || busy}
        onClick={() => inputRef.current?.click()}
      >
        {/* Progress reads as a fill sweeping across the button. */}
        {busy && (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        )}
        <span className="relative inline-flex items-center gap-1.5">
          {busy ? <Spinner /> : <Upload />}
          {busy
            ? `Uploading ${progress}%`
            : hasExisting
              ? "Replace file"
              : "Upload file"}
        </span>
      </Button>
    </>
  );
}
