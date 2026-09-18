import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  formatRonShort,
  parseAmount,
  parseCategoryInput,
  parseEntryInput,
  parseFinanceDocumentUpload,
  parseRate,
  parseSeasonInput,
  RATE_SCALE,
  shapeEntry,
  toRonBani,
} from "@/lib/finance";

/*
  The money helpers carry the whole ledger, so they are pinned down here: a
  rounding slip or a mis-read separator is the kind of bug nobody notices until
  a season's totals are already wrong.
*/

test("parseAmount reads plain decimals", () => {
  assert.equal(parseAmount("1250.50"), 125050);
  assert.equal(parseAmount("1250.5"), 125050);
  assert.equal(parseAmount("340"), 34000);
  assert.equal(parseAmount(" 99.99 "), 9999);
});

test("parseAmount reads Romanian grouping and decimals", () => {
  assert.equal(parseAmount("1.250,50"), 125050);
  assert.equal(parseAmount("1.250"), 125000);
  assert.equal(parseAmount("1.250.000"), 125000000);
  assert.equal(parseAmount("1250,5"), 125050);
});

test("parseAmount reads US grouping", () => {
  assert.equal(parseAmount("1,250.50"), 125050);
  assert.equal(parseAmount("1,250"), 125000);
});

test("parseAmount rejects junk", () => {
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("12.345.6"), null);
  assert.equal(parseAmount("10 lei"), null);
  assert.equal(parseAmount("1.2345"), null);
});

test("toRonBani converts and rounds once", () => {
  assert.equal(toRonBani(34000, RATE_SCALE), 34000);
  assert.equal(toRonBani(34000, 5_083_200), 172829);
  // Half-bani rounds up rather than drifting toward zero.
  assert.equal(toRonBani(1, 1_500_000), 2);
});

test("parseRate accepts more than two decimals", () => {
  assert.equal(parseRate("5,0832"), 5_083_200);
  assert.equal(parseRate("4.3"), 4_300_000);
  assert.equal(parseRate("0"), null);
  assert.equal(parseRate("-3"), null);
  assert.equal(parseRate("abc"), null);
});

test("formatRonShort keeps chart axes narrow", () => {
  assert.equal(formatRonShort(1_250_000), "12,5k");
  assert.equal(formatRonShort(34000), "340");
});

const entry = {
  seasonId: 1,
  categoryId: 2,
  title: "REV motor set",
  occurredOn: "2025-10-04",
  amountMinor: 34000,
  currency: "EUR",
  rateToRonMicros: 5_083_200,
};

test("parseEntryInput accepts a foreign-currency entry", () => {
  const parsed = parseEntryInput(entry);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.ok && parsed.value.rateToRonMicros, 5_083_200);
  assert.equal(parsed.ok && parsed.value.counterparty, null);
});

test("parseEntryInput pins RON to a rate of exactly one", () => {
  const parsed = parseEntryInput({ ...entry, currency: "RON", rateToRonMicros: 7 });
  assert.equal(parsed.ok && parsed.value.rateToRonMicros, RATE_SCALE);
});

test("parseEntryInput rejects bad input", () => {
  assert.equal(parseEntryInput({ ...entry, title: "  " }).ok, false);
  assert.equal(parseEntryInput({ ...entry, amountMinor: 0 }).ok, false);
  assert.equal(parseEntryInput({ ...entry, amountMinor: 12.5 }).ok, false);
  assert.equal(parseEntryInput({ ...entry, currency: "GBP" }).ok, false);
  assert.equal(parseEntryInput({ ...entry, occurredOn: "04-10-2025" }).ok, false);
  assert.equal(parseEntryInput({ ...entry, seasonId: 0 }).ok, false);
  // A EUR entry with no rate cannot be converted, so it is refused rather than
  // silently counted at 1:1.
  assert.equal(parseEntryInput({ ...entry, rateToRonMicros: undefined }).ok, false);
});

test("parseSeasonInput refuses a season that ends before it starts", () => {
  const good = parseSeasonInput({
    name: "2025-26 DECODE",
    startDate: "2025-09-06",
    endDate: "2026-04-30",
  });
  assert.equal(good.ok, true);
  assert.equal(good.ok && good.value.isCurrent, false);

  const bad = parseSeasonInput({
    name: "2025-26 DECODE",
    startDate: "2026-04-30",
    endDate: "2025-09-06",
  });
  assert.equal(bad.ok, false);
});

test("parseCategoryInput bounds the colour to the chart tokens", () => {
  assert.equal(parseCategoryInput({ name: "Travel", kind: "expense", colorIndex: 5 }).ok, true);
  assert.equal(parseCategoryInput({ name: "Travel", kind: "expense", colorIndex: 6 }).ok, false);
  assert.equal(parseCategoryInput({ name: "Travel", kind: "both" }).ok, false);
});

test("parseFinanceDocumentUpload defaults the kind and rejects unknown ones", () => {
  const base = {
    fileName: "invoice.pdf",
    contentType: "application/pdf",
    sizeBytes: 1024,
  };
  const parsed = parseFinanceDocumentUpload(base);
  assert.equal(parsed.ok && parsed.value.kind, "other");

  const named = parseFinanceDocumentUpload({ ...base, kind: "proforma" });
  assert.equal(named.ok && named.value.kind, "proforma");

  assert.equal(parseFinanceDocumentUpload({ ...base, kind: "napkin" }).ok, false);
  assert.equal(parseFinanceDocumentUpload({ ...base, contentType: "application/x-msdownload" }).ok, false);
});


/*
  The rule that keeps signed contracts and bank details away from the rest of
  the team. It is enforced in the API too, but this is the shaping step that
  decides what ever reaches the wire.
*/

const ledgerRow = {
  id: 7,
  seasonId: 1,
  categoryId: 2,
  kind: "expense",
  title: "REV motor set",
  counterparty: "REV Robotics",
  note: null,
  occurredOn: "2025-10-04",
  amountMinor: 34000,
  currency: "EUR",
  rateToRonMicros: 5_083_200,
  amountRonBani: 172829,
  createdBy: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  category: {
    id: 2,
    name: "Parts & materials",
    kind: "expense",
    colorIndex: 2,
    archivedAt: null,
    createdAt: new Date(),
  },
  documents: [
    {
      id: 11,
      entryId: 7,
      kind: "invoice",
      storageKey: "finance/7/secret-key.pdf",
      fileName: "invoice.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      uploadedAt: new Date(),
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const shapedRow = ledgerRow as any;

for (const role of ["admin", "finance"]) {
  test(`${role} sees the documents behind an entry`, () => {
    const shaped = shapeEntry(shapedRow, { userId: 1, role });
    assert.equal(shaped.documentCount, 1);
    assert.equal(shaped.documents?.length, 1);
    assert.equal(shaped.documents?.[0].fileName, "invoice.pdf");
  });
}

for (const role of ["member", "volunteer", "organizer"]) {
  test(`${role} gets the count but never the documents`, () => {
    const shaped = shapeEntry(shapedRow, { userId: 2, role });
    assert.equal(shaped.documentCount, 1);
    assert.equal(shaped.documents, undefined);
    // Nothing that could be used to reach the object may appear anywhere in the
    // payload — not the storage key, not the document id.
    assert.equal(JSON.stringify(shaped).includes("secret-key"), false);
    assert.equal(JSON.stringify(shaped).includes("invoice.pdf"), false);
  });
}

test("everyone still sees the money", () => {
  const shaped = shapeEntry(shapedRow, { userId: 2, role: "member" });
  assert.equal(shaped.amountRonBani, 172829);
  assert.equal(shaped.currency, "EUR");
  assert.equal(shaped.categoryName, "Parts & materials");
});
