import type { NextApiRequest, NextApiResponse } from "next";

import { getSession } from "@/lib/auth";
import { isPushConfigured, vapidPublicKey } from "@/lib/push";

/**
 * The browser needs the VAPID public key to subscribe. Serving it here keeps
 * one source of truth instead of duplicating it into a NEXT_PUBLIC_* variable,
 * and lets the client tell "push isn't set up" apart from "you said no".
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getSession(req, res);
  if (!session.isLoggedIn) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  if (!isPushConfigured()) {
    return res.status(200).json({ configured: false });
  }
  return res.status(200).json({ configured: true, publicKey: vapidPublicKey() });
}
