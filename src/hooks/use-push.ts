import { useCallback, useEffect, useState } from "react";

/*
  Browser side of Web Push.

  The states matter more than the happy path: a member who denied permission,
  or who is on an iPhone without installing to the Home Screen, must be told
  what is actually wrong rather than shown a button that silently does nothing.
*/

export type PushState =
  | "loading"
  /** No Push API at all — older browser, or iOS Safari in a normal tab. */
  | "unsupported"
  /** iOS, supported in principle, but the app has to be installed first. */
  | "needs-install"
  /** The server has no VAPID keys. */
  | "unconfigured"
  /** Permission was refused; only browser settings can undo it. */
  | "denied"
  | "off"
  | "on";

/** iOS exposes Push only to Home Screen web apps, never to a Safari tab. */
function isIos() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, but has a touch screen.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own, non-standard flag.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** base64url from the server -> the Uint8Array PushManager expects. */
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Works out where this browser stands. Pure: it returns the state rather than
 * setting it, so the effect below never calls setState synchronously.
 */
async function resolvePushState(): Promise<PushState> {
  if (typeof window === "undefined") return "loading";

  const hasApi =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  if (!hasApi) {
    // Distinguish "this iPhone just needs installing" from "never going to
    // work here" — the advice is completely different.
    return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  }

  const key = await fetch("/api/push/key")
    .then((r) => (r.ok ? r.json() : { configured: false }))
    .catch(() => ({ configured: false }));
  if (!key.configured) return "unconfigured";

  if (Notification.permission === "denied") return "denied";

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  return existing ? "on" : "off";
}

export function usePush() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setState(await resolvePushState());
  }, []);

  useEffect(() => {
    let cancelled = false;
    resolvePushState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      // Must come straight from a click; browsers reject a detached request.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return { ok: false, error: "Permission was not granted" };
      }

      const { publicKey } = await fetch("/api/push/key").then((r) => r.json());
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("Could not save the subscription");

      setState("on");
      return { ok: true };
    } catch (err) {
      await refresh();
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not enable notifications",
      };
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        // Tell the server first: once unsubscribed locally the endpoint is gone
        // and the row would be orphaned until its next failed delivery.
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not turn notifications off",
      };
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable, refresh };
}
