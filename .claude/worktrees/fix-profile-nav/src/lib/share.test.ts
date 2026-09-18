import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  announcementShareText,
  eventShareText,
  markdownToWhatsApp,
  truncate,
  whatsappShareUrl,
} from "./share";

const md = markdownToWhatsApp;

describe("markdownToWhatsApp", () => {
  it("leaves plain text alone", () => {
    assert.equal(md("Bus leaves at 08:15 sharp."), "Bus leaves at 08:15 sharp.");
  });

  it("converts bold to WhatsApp's single asterisk", () => {
    assert.equal(md("Bring **safety glasses**"), "Bring *safety glasses*");
    assert.equal(md("Bring __safety glasses__"), "Bring *safety glasses*");
  });

  it("converts italic to underscores", () => {
    assert.equal(md("a *charged* laptop"), "a _charged_ laptop");
    assert.equal(md("a _charged_ laptop"), "a _charged_ laptop");
  });

  it("does not let the italic pass eat freshly made bold", () => {
    // The bug this guards: **x** -> *x*, then *x* -> _x_ would lose the bold.
    assert.equal(md("**bold** and *italic*"), "*bold* and _italic_");
    assert.equal(md("**both** __of__ these"), "*both* *of* these");
  });

  it("leaves snake_case identifiers intact", () => {
    assert.equal(md("check the drive_train_bolts value"), "check the drive_train_bolts value");
  });

  it("turns headings into bold lines", () => {
    assert.equal(md("## Schedule"), "*Schedule*");
    assert.equal(md("# Regionals\n\ntext"), "*Regionals*\n\ntext");
    assert.equal(md("### Closing ###"), "*Closing*");
  });

  it("turns bullets into dots and keeps ordered lists", () => {
    assert.equal(md("- one\n- two"), "• one\n• two");
    assert.equal(md("* one\n+ two"), "• one\n• two");
    assert.equal(md("1. first\n2. second"), "1. first\n2. second");
  });

  it("keeps nesting indentation on bullets", () => {
    assert.equal(md("- one\n  - nested"), "• one\n  • nested");
  });

  it("renders task lists as boxes", () => {
    assert.equal(md("- [x] packed\n- [ ] todo"), "☑ packed\n☐ todo");
  });

  it("flattens links to text plus url", () => {
    assert.equal(md("[route map](https://ex.com/m)"), "route map (https://ex.com/m)");
  });

  it("does not duplicate a bare url used as its own label", () => {
    assert.equal(md("[https://ex.com](https://ex.com)"), "https://ex.com");
  });

  it("reduces images to their alt text", () => {
    assert.equal(md("![the pit](https://ex.com/p.png)"), "the pit");
  });

  it("unwraps inline code and keeps fenced blocks", () => {
    assert.equal(md("check `drivetrain` bolts"), "check drivetrain bolts");
    assert.equal(md("```python\nx = 1\n```"), "```\nx = 1\n```");
  });

  it("strips blockquote markers and horizontal rules", () => {
    assert.equal(md("> pit crew note"), "pit crew note");
    assert.equal(md("before\n\n---\n\nafter"), "before\n\nafter");
  });

  it("converts strikethrough", () => {
    assert.equal(md("~~cancelled~~"), "~cancelled~");
  });

  it("collapses runs of blank lines and trims", () => {
    assert.equal(md("\n\na\n\n\n\nb\n\n"), "a\n\nb");
  });

  it("handles a realistic post end to end", () => {
    const out = md(
      "## What's happening\n\nBring your **safety glasses**.\n\n- Meet at 08:00\n- Bus leaves *08:15*\n\n[Route map](https://ex.com/map)\n\n---\n\nQuestions? Ask in the chat."
    );
    assert.equal(
      out,
      "*What's happening*\n\nBring your *safety glasses*.\n\n• Meet at 08:00\n• Bus leaves _08:15_\n\nRoute map (https://ex.com/map)\n\nQuestions? Ask in the chat."
    );
  });

  it("is documented as single-application only", () => {
    // Markdown's *x* means italic; WhatsApp's *x* means bold. The same syntax
    // carries opposite meanings, so converting twice is inherently lossy and
    // no amount of care makes this idempotent. Call sites must convert exactly
    // once — this test pins the behaviour so the limitation stays visible.
    const once = md("**bold** and *italic*");
    assert.equal(once, "*bold* and _italic_");
    assert.equal(md(once), "_bold_ and _italic_", "second pass degrades bold");
  });
});

describe("truncate", () => {
  it("leaves short text untouched", () => {
    assert.equal(truncate("short", 100), "short");
  });

  it("cuts on a word boundary", () => {
    const out = truncate("alpha beta gamma delta epsilon", 20);
    assert.ok(out.endsWith("…"));
    assert.ok(out.length <= 21, `too long: ${out.length}`);
    assert.ok(!out.includes("delt…"), "cut mid-word");
  });

  it("still cuts when there is no usable break", () => {
    const out = truncate("a".repeat(50), 10);
    assert.equal(out, `${"a".repeat(10)}…`);
  });
});

describe("whatsappShareUrl", () => {
  it("omits the phone number so WhatsApp shows the chat chooser", () => {
    assert.ok(whatsappShareUrl("hi").startsWith("https://wa.me/?text="));
  });

  it("round-trips newlines, ampersands and hashes", () => {
    const text = "line one\nline two & three #4";
    const url = whatsappShareUrl(text);
    assert.ok(!url.includes("\n"), "raw newline would break the URL");
    assert.ok(!url.includes("#"), "raw # would truncate at the fragment");
    assert.equal(decodeURIComponent(url.split("?text=")[1]), text);
  });

  it("round-trips Romanian diacritics and emoji", () => {
    const text = "Întâlnire să mergem 🚀 și așa mai departe";
    assert.equal(
      decodeURIComponent(whatsappShareUrl(text).split("?text=")[1]),
      text
    );
  });
});

describe("share text builders", () => {
  it("puts the title in bold and the link last", () => {
    const out = announcementShareText(
      { title: "Regionals", description: "Bring **glasses**." },
      "https://app.test/announcements#a-12"
    );
    assert.equal(
      out,
      "*Regionals*\n\nBring *glasses*.\n\nRead it here: https://app.test/announcements#a-12"
    );
  });

  it("does not leave a blank gap when the body is empty", () => {
    const out = announcementShareText({ title: "Heads up", description: "" }, "https://app.test/a");
    assert.ok(!/\n\n\n/.test(out), `blank run in: ${JSON.stringify(out)}`);
  });

  it("includes date, time and location for an event", () => {
    const out = eventShareText(
      {
        title: "Regional qualifier",
        dateLabel: "Sat, Sep 20",
        timeLabel: "09:00 – 17:00",
        location: "Sala Polivalentă",
        description: null,
      },
      "https://app.test/events/4"
    );
    assert.ok(out.includes("*Regional qualifier*"));
    assert.ok(out.includes("Sat, Sep 20"));
    assert.ok(out.includes("Sala Polivalentă"));
    assert.ok(out.trimEnd().endsWith("https://app.test/events/4"));
  });

  it("omits the location line when there is none", () => {
    const out = eventShareText(
      { title: "Meeting", dateLabel: "Mon", timeLabel: "18:00 – 20:00", location: null },
      "https://app.test/events/5"
    );
    assert.ok(!out.includes("📍"));
  });
});
