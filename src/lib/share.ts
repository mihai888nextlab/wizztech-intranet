/*
  Turning app content into a WhatsApp message.

  Pure on purpose — no app imports, no database, no browser APIs — so the only
  part of this feature with real logic can be tested on its own.

  WhatsApp understands *bold*, _italic_, ~strike~ and ```monospace``` and
  nothing else, so Markdown has to be translated rather than pasted. This is a
  formatter built on regexes, not a Markdown parser: unusual or deeply nested
  syntax may pass through untouched, which is fine for a chat message.
*/

/** Sentinels stand in for finished bold runs so the italic pass can't eat them. */
const BOLD_OPEN = "\u0001";
const BOLD_CLOSE = "\u0002";

export function markdownToWhatsApp(markdown: string): string {
  let text = markdown
    .replace(/\r\n?/g, "\n")
    // Strip our own sentinels in case they somehow appear in the source.
    .replace(/[\u0001\u0002]/g, "");

  // Fenced code: drop the language tag, keep WhatsApp's ``` delimiters.
  text = text.replace(/^```[a-zA-Z0-9+-]*\n/gm, "```\n");
  // Inline code: WhatsApp has no single-backtick syntax, so unwrap it.
  text = text.replace(/`([^`\n]+)`/g, "$1");

  // Images first, so their alt text isn't mistaken for a link.
  text = text.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  text = text.replace(/\[([^\]]+)\]\(\s*([^)\s]+)[^)]*\)/g, (_, label, url) =>
    label.trim() === url.trim() ? url : `${label} (${url})`
  );

  // Headings become bold lines.
  text = text.replace(
    /^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*$/gm,
    (_, heading) => `${BOLD_OPEN}${heading}${BOLD_CLOSE}`
  );

  // Task list items before generic bullets, and both before emphasis, so a
  // leading "* " is never read as the start of an italic run.
  text = text.replace(/^(\s*)[-*+][ \t]+\[[ ]\][ \t]+/gm, "$1☐ ");
  text = text.replace(/^(\s*)[-*+][ \t]+\[[xX]\][ \t]+/gm, "$1☑ ");
  text = text.replace(/^(\s*)[-*+][ \t]+/gm, "$1• ");

  text = text.replace(/^ {0,3}>[ \t]?/gm, "");
  // Horizontal rules have no equivalent; drop the line entirely.
  text = text.replace(/^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "");

  text = text.replace(/\*\*([^\n]+?)\*\*/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);
  text = text.replace(/__([^\n]+?)__/g, `${BOLD_OPEN}$1${BOLD_CLOSE}`);
  text = text.replace(/~~([^\n]+?)~~/g, "~$1~");

  // Remaining single markers are italic. The guards keep them from firing on
  // snake_case words or a stray asterisk.
  text = text.replace(/(^|[\s(])\*([^*\n]+?)\*(?=[\s).,!?;:]|$)/g, "$1_$2_");
  text = text.replace(/(^|[\s(])_([^_\n]+?)_(?=[\s).,!?;:]|$)/g, "$1_$2_");

  text = text
    .replace(new RegExp(BOLD_OPEN, "g"), "*")
    .replace(new RegExp(BOLD_CLOSE, "g"), "*");

  // Tidy the vertical rhythm: no runs of blank lines, no trailing spaces.
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Cuts on a word boundary so the message never ends mid-word. */
export function truncate(text: string, max = 600): string {
  if (text.length <= max) return text;
  const clipped = text.slice(0, max);
  const lastBreak = clipped.search(/\s\S*$/);
  return `${(lastBreak > max * 0.6 ? clipped.slice(0, lastBreak) : clipped).trimEnd()}…`;
}

/**
 * No phone number in the URL on purpose: `wa.me/?text=` opens WhatsApp's chat
 * chooser, which is what lets the sender pick a group. Adding a number would
 * open a one-to-one chat instead.
 */
export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function announcementShareText(
  announcement: { title: string; description: string },
  url: string
): string {
  const body = truncate(markdownToWhatsApp(announcement.description));
  return [`*${announcement.title}*`, "", body, "", `Read it here: ${url}`]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function eventShareText(
  event: {
    title: string;
    description?: string | null;
    dateLabel: string;
    timeLabel: string;
    location?: string | null;
  },
  url: string
): string {
  const lines = [`*${event.title}*`, "", `📅 ${event.dateLabel}`, `🕒 ${event.timeLabel}`];
  if (event.location) lines.push(`📍 ${event.location}`);
  if (event.description?.trim()) {
    lines.push("", truncate(markdownToWhatsApp(event.description), 300));
  }
  lines.push("", `Details: ${url}`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
