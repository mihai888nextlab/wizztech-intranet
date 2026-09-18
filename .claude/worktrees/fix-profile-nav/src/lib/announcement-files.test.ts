import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAttachmentUpload } from "./announcements";

describe("parseAttachmentUpload", () => {
  it("accepts a valid PDF", () => {
    const parsed = parseAttachmentUpload(
      { fileName: "consent-form.pdf", contentType: "application/pdf", sizeBytes: 1024 },
      "announcements/1/x"
    );
    assert.ok(parsed.ok);
    assert.equal(parsed.value.fileName, "consent-form.pdf");
    assert.equal(parsed.value.contentType, "application/pdf");
  });

  it("rejects a missing file name", () => {
    const parsed = parseAttachmentUpload({ fileName: "  ", contentType: "application/pdf", sizeBytes: 1 }, "k");
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, "File name is required");
  });

  it("rejects a type outside the allowed list", () => {
    const parsed = parseAttachmentUpload({ fileName: "x.exe", contentType: "application/x-msdownload", sizeBytes: 1 }, "k");
    assert.ok(!parsed.ok);
    assert.match(parsed.error, /not accepted/);
  });

  it("rejects a file over the size limit", () => {
    const parsed = parseAttachmentUpload({ fileName: "big.pdf", contentType: "application/pdf", sizeBytes: 26 * 1024 * 1024 }, "k");
    assert.ok(!parsed.ok);
    assert.match(parsed.error, /25 MB limit/);
  });

  it("requires a storage key on create", () => {
    const parsed = parseAttachmentUpload({ fileName: "a.pdf", contentType: "application/pdf", sizeBytes: 1 }, "");
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, "Storage key is required");
  });
});
