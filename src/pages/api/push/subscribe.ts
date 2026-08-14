import type { NextApiRequest, NextApiResponse } from "next";
import { and, eq } from "drizzle-orm";

import { pushSubscriptions } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

interface ParsedSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function parseSubscription(body: unknown): ParsedSubscription | null {
  const raw = (body ?? {}) as Record<string, unknown>;
  const endpoint = typeof raw.endpoint === "string" ? raw.endpoint.trim() : "";
  const keys = (raw.keys ?? {}) as Record<string, unknown>;
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";

  if (!endpoint || !p256dh || !auth) return null;
  // Endpoints are always absolute https URLs from the browser's push service.
  if (!/^https:\/\//i.test(endpoint)) return null;
  return { endpoint, p256dh, auth };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (req.method === "POST") {
    const parsed = parseSubscription(req.body);
    if (!parsed) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    const userAgent =
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"].slice(0, 255)
        : null;

    try {
      // Browsers reuse an endpoint across sessions, and a shared device may
      // hand the same one to a different account — so claim it for whoever is
      // signed in now rather than creating a duplicate.
      await db
        .insert(pushSubscriptions)
        .values({
          userId: session.userId,
          endpoint: parsed.endpoint,
          p256dh: parsed.p256dh,
          auth: parsed.auth,
          userAgent,
          lastUsedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            userId: session.userId,
            p256dh: parsed.p256dh,
            auth: parsed.auth,
            userAgent,
            lastUsedAt: new Date(),
          },
        });
    } catch (err) {
      // Without this the client gets Next's HTML error page and can only say
      // "something went wrong". The commonest cause by far is the table not
      // existing yet, so name it.
      const message = err instanceof Error ? err.message : String(err);
      console.error("push subscribe failed", err);
      return res.status(500).json({
        error: /relation .* does not exist|push_subscriptions/i.test(message)
          ? "Notifications aren't set up yet: the push_subscriptions table is missing. An admin needs to run the database migration."
          : "Could not store the subscription.",
      });
    }

    return res.status(201).json({ subscribed: true });
  }

  if (req.method === "DELETE") {
    const endpoint =
      typeof req.body?.endpoint === "string" ? req.body.endpoint.trim() : "";
    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint is required" });
    }

    // Scoped to the caller so nobody can unsubscribe someone else's device.
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.userId, session.userId)
        )
      );

    return res.status(200).json({ subscribed: false });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
