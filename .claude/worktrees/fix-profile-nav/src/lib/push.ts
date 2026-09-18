/*
  Web Push sending.

  Split deliberately: everything above `sendPushToUsers` is free of the
  database, so payload shaping, prune decisions and the actual VAPID-signed
  request can all be tested against a stand-in push service without touching
  Postgres. Only the last function needs a connection.
*/

export const PUSH_TITLE_MAX = 80;
export const PUSH_BODY_MAX = 180;

export interface PushPayload {
  title: string;
  body: string;
  /** Path the notification opens, relative to the app. */
  url: string;
  /** Collapses repeats of the same kind on the device instead of stacking. */
  tag?: string;
}

export interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Reads an env var defensively.
 *
 * .env files have their quotes stripped by dotenv, but hosting dashboards store
 * exactly what you paste — so a value copied out of .env with its surrounding
 * quotes arrives here as `"BN..."`. That decodes to a malformed key and the
 * browser's push service rejects the subscription with a generic
 * "push service error", which points nowhere near the real cause.
 */
function readEnv(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^['"]|['"]$/g, "");
}

/** A VAPID public key is an uncompressed P-256 point: 65 bytes starting 0x04. */
export function isValidVapidPublicKey(key: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return false;
  try {
    const bytes = Buffer.from(key, "base64url");
    return bytes.length === 65 && bytes[0] === 0x04;
  } catch {
    return false;
  }
}

export function isPushConfigured() {
  return Boolean(
    readEnv("VAPID_PUBLIC_KEY") &&
      readEnv("VAPID_PRIVATE_KEY") &&
      readEnv("VAPID_SUBJECT")
  );
}

export function vapidPublicKey() {
  const key = readEnv("VAPID_PUBLIC_KEY");
  return key || null;
}

function clamp(value: string, max: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Notification text is shown by the OS, which truncates without mercy and
 * renders no markup — so clamp here rather than hoping it looks right.
 */
export function buildPayload(payload: PushPayload): PushPayload {
  return {
    title: clamp(payload.title, PUSH_TITLE_MAX),
    body: clamp(payload.body, PUSH_BODY_MAX),
    url: payload.url,
    ...(payload.tag ? { tag: payload.tag } : {}),
  };
}

/**
 * 404 and 410 are the push service saying this endpoint is permanently gone —
 * the only trustworthy signal that a subscription should be deleted. Anything
 * else (429, 5xx, network) is transient and must not destroy a good row.
 */
export function shouldPrune(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}

export interface SendResult {
  ok: boolean;
  statusCode?: number;
  prune: boolean;
}

/** A day is long enough for a phone that was off, short enough to stay relevant. */
export const PUSH_TTL_SECONDS = 60 * 60 * 24;

/**
 * Builds the signed, encrypted request without sending it.
 *
 * `web-push` does the VAPID signing and aes128gcm encryption here; the network
 * call is ours (below). Separating them means the crypto can be inspected in a
 * test without a TLS endpoint, and the transport has explicit timeout handling.
 */
export async function buildRequestDetails(
  subscription: WebPushSubscription,
  payload: PushPayload
) {
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    readEnv("VAPID_SUBJECT"),
    readEnv("VAPID_PUBLIC_KEY"),
    readEnv("VAPID_PRIVATE_KEY")
  );
  return webpush.generateRequestDetails(
    subscription,
    JSON.stringify(buildPayload(payload)),
    { TTL: PUSH_TTL_SECONDS }
  );
}

/**
 * Sends one notification. No database access, so tests can point a fake
 * subscription at a local server and inspect the real signed request.
 */
export async function sendToSubscription(
  subscription: WebPushSubscription,
  payload: PushPayload,
  { timeoutMs = 8000 }: { timeoutMs?: number } = {}
): Promise<SendResult> {
  try {
    const details = await buildRequestDetails(subscription, payload);
    const headers = { ...details.headers } as Record<string, string>;
    // fetch computes this itself and rejects an explicit value.
    delete headers["Content-Length"];

    const res = await fetch(details.endpoint, {
      method: "POST",
      headers,
      body: new Uint8Array(details.body as Buffer),
      signal: AbortSignal.timeout(timeoutMs),
    });

    return {
      ok: res.ok,
      statusCode: res.status,
      prune: shouldPrune(res.status),
    };
  } catch {
    // A network failure or timeout says nothing about whether the subscription
    // is still good, so never prune on it.
    return { ok: false, prune: false };
  }
}

/** Small cap so a big team doesn't open dozens of sockets at once. */
const CONCURRENCY = 8;

/**
 * Delivers to every device belonging to the given users and prunes the dead
 * endpoints it discovers.
 *
 * Never throws. A push failing must not take down the announcement that
 * triggered it — the notification is a courtesy, the write is the point.
 */
export async function sendPushToUsers(
  userIds: number[],
  payload: PushPayload
): Promise<{ sent: number; failed: number; pruned: number }> {
  const empty = { sent: 0, failed: 0, pruned: 0 };
  if (userIds.length === 0 || !isPushConfigured()) return empty;

  try {
    const { inArray } = await import("drizzle-orm");
    const { db } = await import("@/lib/db");
    const { pushSubscriptions } = await import("@/db/schema");

    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));
    if (subs.length === 0) return empty;

    const dead: string[] = [];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < subs.length; i += CONCURRENCY) {
      const batch = subs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((sub) =>
          sendToSubscription(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          )
        )
      );
      results.forEach((result, index) => {
        if (result.ok) sent++;
        else failed++;
        if (result.prune) dead.push(batch[index].endpoint);
      });
    }

    if (dead.length > 0) {
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.endpoint, dead));
    }

    return { sent, failed, pruned: dead.length };
  } catch (err) {
    console.error("push send failed", err);
    return empty;
  }
}
