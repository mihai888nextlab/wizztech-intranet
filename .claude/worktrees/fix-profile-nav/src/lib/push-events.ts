import { ne } from "drizzle-orm";

import { users } from "@/db/schema";
import { db } from "@/lib/db";
import { sendPushToUsers } from "@/lib/push";

/*
  The two things worth interrupting someone for.

  Kept together so the wording and links stay consistent, and so the call sites
  stay one line — a notification must never be the reason a write fails.
*/

/** Everyone but the author; the author already knows. */
export async function notifyNewAnnouncement(announcement: {
  id: number;
  title: string;
  description: string;
  authorId: number;
  authorName: string;
}) {
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(ne(users.id, announcement.authorId));

  return sendPushToUsers(
    recipients.map((r) => r.id),
    {
      title: announcement.title,
      // The body is plain text on the lock screen, so strip the Markdown
      // markers rather than showing raw ** and ##.
      body: `${announcement.authorName}: ${announcement.description.replace(/[*_#`>[\]()]/g, " ")}`,
      url: `/announcements#a-${announcement.id}`,
      tag: `announcement-${announcement.id}`,
    }
  );
}

/** Only the person whose submission it is. */
export function notifySubmissionReviewed(review: {
  ownerId: number;
  requestTitle: string;
  status: string;
  reviewNote: string | null;
  url: string;
}) {
  const approved = review.status === "approved";
  return sendPushToUsers([review.ownerId], {
    title: approved ? "Approved" : "Changes needed",
    body: approved
      ? `${review.requestTitle} was approved.`
      : `${review.requestTitle}: ${review.reviewNote || "please check and send it again."}`,
    url: review.url,
    tag: `review-${review.url}`,
  });
}
