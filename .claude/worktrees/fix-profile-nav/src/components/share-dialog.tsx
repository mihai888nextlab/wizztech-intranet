import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { whatsappShareUrl } from "@/lib/share";

/** WhatsApp's own mark, so the button is recognisable at a glance. */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
      <path d="M12.04 2c-5.5 0-9.97 4.47-9.97 9.96 0 1.76.46 3.48 1.34 5L2 22l5.16-1.35a9.94 9.94 0 0 0 4.88 1.27h.01c5.49 0 9.96-4.47 9.96-9.96A9.9 9.9 0 0 0 19.1 4.9 9.88 9.88 0 0 0 12.04 2Zm0 18.17h-.01a8.27 8.27 0 0 1-4.21-1.15l-.3-.18-3.13.82.83-3.06-.2-.31a8.24 8.24 0 0 1-1.27-4.4c0-4.56 3.72-8.28 8.29-8.28 2.21 0 4.29.87 5.85 2.43a8.23 8.23 0 0 1 2.42 5.86c0 4.57-3.71 8.27-8.27 8.27Z" />
    </svg>
  );
}

interface ShareDialogProps {
  /** The finished message. Null closes the dialog. */
  text: string | null;
  title?: string;
  onOpenChange: (open: boolean) => void;
}

/**
 * Shows the exact message before it leaves, then hands it to WhatsApp.
 *
 * The primary action is a real anchor rather than window.open, so no popup
 * blocker can swallow it.
 */
export function ShareDialog({
  text,
  title = "Share to WhatsApp",
  onOpenChange,
}: ShareDialogProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the text and copy it manually.");
    }
  };

  return (
    <Dialog
      open={text !== null}
      onOpenChange={(open) => {
        if (!open) setCopied(false);
        onOpenChange(open);
      }}
    >
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Pick the group in WhatsApp once it opens.
          </p>
        </DialogHeader>

        <pre className="max-h-56 overflow-y-auto rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap ring-1 ring-border">
          {text}
        </pre>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="h-11 flex-1 rounded-xl"
            nativeButton={false}
            render={
              <a
                href={text ? whatsappShareUrl(text) : "#"}
                target="_blank"
                rel="noreferrer"
              />
            }
            onClick={() => onOpenChange(false)}
          >
            <WhatsAppIcon className="size-[18px]" /> Open WhatsApp
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="h-11 rounded-xl"
            onClick={copy}
          >
            {copied ? <Check /> : <Copy />}
            {copied ? "Copied" : "Copy text"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          <Share2 className="mr-1 inline size-3" />
          Only people with an account can open the link.
        </p>
      </DialogContent>
    </Dialog>
  );
}
