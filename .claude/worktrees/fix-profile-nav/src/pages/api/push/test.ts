import type { NextApiRequest, NextApiResponse } from "next";

import { getSession } from "@/lib/auth";
import { isPushConfigured, sendPushToUsers } from "@/lib/push";

/**
 * Sends a notification to the caller's own devices.
 *
 * Worth having permanently rather than only during development: it is the one
 * way a member can confirm notifications actually reach their phone, which on
 * iOS depends on them having installed the app to the Home Screen.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!isPushConfigured()) {
    return res.status(503).json({ error: "Push notifications are not configured" });
  }

  const result = await sendPushToUsers([session.userId], {
    title: "WizzTech",
    body: "Notifications are working on this device.",
    url: "/profile",
    tag: "push-test",
  });

  if (result.sent === 0) {
    return res.status(200).json({
      ...result,
      error:
        result.pruned > 0
          ? "This device's subscription had expired. Turn notifications off and on again."
          : "No device is subscribed for your account yet.",
    });
  }

  return res.status(200).json(result);
}
