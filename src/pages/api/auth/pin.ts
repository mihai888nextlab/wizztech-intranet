import type { NextApiRequest, NextApiResponse } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { hashPassword, requireAuth, verifyPassword } from "@/lib/auth";
import { DEFAULT_PIN, isValidPin } from "@/lib/volunteers";

/**
 * Anyone signed in changing their own PIN, and the only route that can clear
 * `mustChangePin` — so the one way off the /set-pin screen is to actually pick
 * a PIN.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await requireAuth(req, res);
  if (!session) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  const { currentPin, newPin } = req.body ?? {};

  if (!isValidPin(newPin)) {
    return res.status(400).json({ error: "Your new PIN must be exactly 4 digits" });
  }
  if (newPin === DEFAULT_PIN) {
    return res.status(400).json({ error: `${DEFAULT_PIN} is the shared starting PIN — please pick another` });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.userId),
    columns: { passwordHash: true, mustChangePin: true },
  });
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  /*
    Someone replacing a PIN that was chosen for them has already proved they
    know it — they just signed in with it — so /set-pin doesn't ask for it
    again. It can't, in fact: an admin may have picked any four digits for a
    new member, and that screen has no way to know which.

    A voluntary change is the case worth guarding, so there the current PIN is
    required: a signed-in phone left on a desk shouldn't be enough to lock its
    owner out of their own account.
  */
  if (!user.mustChangePin) {
    if (typeof currentPin !== "string" || !(await verifyPassword(currentPin, user.passwordHash))) {
      return res.status(400).json({ error: "That isn't your current PIN" });
    }
  }

  // Compared against the hash rather than the submitted value, so it also
  // catches "change it to the same thing" on the forced path, where no current
  // PIN is sent at all.
  if (await verifyPassword(newPin, user.passwordHash)) {
    return res.status(400).json({ error: "That's already your PIN" });
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPin), mustChangePin: false })
    .where(eq(users.id, session.userId));

  res.status(200).json({ success: true });
}
