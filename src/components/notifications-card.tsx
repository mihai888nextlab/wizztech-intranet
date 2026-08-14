import { useState } from "react";
import { Bell, BellOff, Send, Share, SquarePlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { usePush } from "@/hooks/use-push";

/**
 * Notification settings, mirroring the Appearance card next to it.
 *
 * Every state gets an honest explanation. A dead "Enable" button on a phone
 * that can never subscribe is worse than saying why.
 */
export function NotificationsCard() {
  const { state, busy, enable, disable } = usePush();
  const [testing, setTesting] = useState(false);

  const handleEnable = async () => {
    const result = await enable();
    if (result.ok) toast.success("Notifications on for this device");
    else if (result.error) toast.error(result.error);
  };

  const handleDisable = async () => {
    const result = await disable();
    if (result.ok) toast.success("Notifications off for this device");
    else if (result.error) toast.error(result.error);
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) toast.error(data?.error || "Could not send the test");
      else if (data?.error) toast.error(data.error);
      else toast.success("Sent — it should arrive in a moment");
    } catch {
      toast.error("Connection error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading text-sm font-medium">Notifications</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            New announcements, and when your uploads get reviewed.
          </p>
        </div>

        {state === "on" && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={busy}
            onClick={handleDisable}
          >
            {busy ? <Spinner /> : <BellOff />} Turn off
          </Button>
        )}
        {state === "off" && (
          <Button size="sm" className="shrink-0" disabled={busy} onClick={handleEnable}>
            {busy ? <Spinner /> : <Bell />} Enable
          </Button>
        )}
      </div>

      {state === "loading" && (
        <p className="mt-3 text-xs text-muted-foreground">Checking…</p>
      )}

      {state === "on" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-success">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            On for this device
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={testing}
            onClick={handleTest}
          >
            {testing ? <Spinner /> : <Send />} Send test
          </Button>
        </div>
      )}

      {state === "denied" && (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          You blocked notifications for this site. The app can&apos;t ask again —
          re-allow them in your browser&apos;s site settings, then reload.
        </p>
      )}

      {state === "unsupported" && (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          This browser doesn&apos;t support notifications. Chrome, Firefox or Edge
          will work.
        </p>
      )}

      {state === "unconfigured" && (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Notifications aren&apos;t set up on the server yet. An admin needs to add
          the VAPID keys.
        </p>
      )}

      {state === "needs-install" && <IosInstallGuide />}
    </div>
  );
}

/**
 * iOS refuses Push to anything that isn't a Home Screen app, so this is the
 * only route for iPhone users — worth spelling out rather than hinting at.
 */
function IosInstallGuide() {
  return (
    <div className="mt-3 space-y-2 rounded-lg bg-muted/60 p-3">
      <p className="text-xs font-medium">
        On iPhone, add WizzTech to your Home Screen first
      </p>
      <p className="text-xs text-muted-foreground">
        Apple only allows notifications for installed apps, not for Safari tabs.
        It takes a few seconds:
      </p>
      <ol className="space-y-1.5 text-xs text-muted-foreground">
        <li className="flex items-center gap-2">
          <Share className="size-3.5 shrink-0" aria-hidden="true" />
          Tap the Share button in Safari&apos;s toolbar
        </li>
        <li className="flex items-center gap-2">
          <SquarePlus className="size-3.5 shrink-0" aria-hidden="true" />
          Choose <span className="font-medium">Add to Home Screen</span>
        </li>
        <li className="flex items-center gap-2">
          <Bell className="size-3.5 shrink-0" aria-hidden="true" />
          Open WizzTech from the Home Screen, then come back here and tap Enable
        </li>
      </ol>
    </div>
  );
}
