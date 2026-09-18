import type {
  financeCategories,
  financeDocuments,
  financeEntries,
} from "@/db/schema";
import {
  ATTACHMENT_ALLOWED_TYPES,
  parseAttachmentUpload,
  type AttachmentUploadInput,
} from "@/lib/announcements";
import { canViewFinanceDocuments } from "@/lib/roles";

/*
  Pure rules for the ledger: money arithmetic, formatting, and the parsers the
  API routes share so create and update cannot drift apart. Nothing here touches
  the database, so the page can import it and the tests can run without Neon.
*/

export const TITLE_MAX = 200;
export const COUNTERPARTY_MAX = 120;
export const SEASON_NAME_MAX = 100;
export const CATEGORY_NAME_MAX = 60;

export const CURRENCIES = ["RON", "EUR", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const ENTRY_KINDS = ["income", "expense"] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

export const DOCUMENT_KINDS = [
  "proforma",
  "invoice",
  "contract",
  "receipt",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Paperwork arrives as PDFs, phone scans and the occasional spreadsheet. */
export const FINANCE_ALLOWED_TYPES = ATTACHMENT_ALLOWED_TYPES;
export const FINANCE_DOC_MAX_MB = 25;

/** The chart tokens are --chart-1 through --chart-5. */
export const CHART_COLOR_COUNT = 5;

/** Rates are stored times a million; RON against itself is exactly 1. */
export const RATE_SCALE = 1_000_000;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/*
  Money
  -----
  Everything is integer minor units. `amountMinor` is in the entry's own
  currency; `amountRonBani` is the same sum in bani, which is what every total
  and chart adds up.
*/

/**
 * Reads an amount typed by a human into minor units.
 *
 * Both conventions are accepted, because a Romanian treasurer types "1.250,50"
 * while a paste from a bank export says "1250.50". With both separators
 * present, the last one is the decimal point and the other is grouping. With
 * only one, three digits after it means grouping ("1.250" is one thousand two
 * hundred fifty, never 1,25 RON) and one or two digits means cents.
 */
export function parseAmount(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, "");
  if (!/^-?[\d.,]*\d$/.test(trimmed)) return null;

  const negative = trimmed.startsWith("-");
  const digits = negative ? trimmed.slice(1) : trimmed;

  const lastDot = digits.lastIndexOf(".");
  const lastComma = digits.lastIndexOf(",");
  const decimalAt = Math.max(lastDot, lastComma);

  let whole = digits;
  let fraction = "";

  if (decimalAt !== -1) {
    const tail = digits.slice(decimalAt + 1);
    const bothPresent = lastDot !== -1 && lastComma !== -1;
    const repeated = digits.split(digits[decimalAt]).length > 2;
    const isDecimal = bothPresent || repeated ? bothPresent : tail.length !== 3;

    if (isDecimal) {
      if (tail.length > 2) return null;
      whole = digits.slice(0, decimalAt);
      fraction = tail;
    }
  }

  // Whatever is left of the decimal point is grouped or nothing: every group
  // after the first must be exactly three digits, so a typo like "12.345.6" is
  // refused rather than quietly read as twelve thousand three hundred forty-six.
  if (!/^\d+$|^\d{1,3}(?:[.,]\d{3})+$/.test(whole)) return null;
  whole = whole.replace(/[.,]/g, "");

  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(minor)) return null;
  return negative ? -minor : minor;
}

/** The one rounding rule: minor units of a currency into bani. */
export function toRonBani(amountMinor: number, rateToRonMicros: number) {
  return Math.round((amountMinor * rateToRonMicros) / RATE_SCALE);
}

/**
 * Money as a Romanian team reads it: `1.250,50 RON`, `340,00 €`.
 *
 * A deliberate local exception — the rest of the UI is English with US-style
 * dates, but nobody on this team reads their own budget in en-US.
 */
export function formatMoney(minor: number, currency: string) {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

export function formatRon(bani: number) {
  return formatMoney(bani, "RON");
}

/** Compact form for chart axes, where `12.500 RON` would not fit. */
export function formatRonShort(bani: number) {
  const ron = bani / 100;
  if (Math.abs(ron) >= 1000) {
    return `${new Intl.NumberFormat("ro-RO", {
      maximumFractionDigits: 1,
    }).format(ron / 1000)}k`;
  }
  return new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 0 }).format(ron);
}

/** `1_000_000` -> `"1"`, `5_083_200` -> `"5,0832"`. For prefilling the rate field. */
export function formatRate(micros: number) {
  return new Intl.NumberFormat("ro-RO", {
    maximumFractionDigits: 6,
  }).format(micros / RATE_SCALE);
}

export function parseRate(input: string): number | null {
  const amount = parseRateDigits(input);
  if (amount === null) return null;
  if (amount <= 0 || amount > 2000 * RATE_SCALE) return null;
  return amount;
}

/** Rates need more than two decimals, so they cannot reuse `parseAmount`. */
function parseRateDigits(input: string): number | null {
  const trimmed = input.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    return null;
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * RATE_SCALE);
}

/*
  Parsers
*/

export interface SeasonInput {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export function parseSeasonInput(body: unknown): Parsed<SeasonInput> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return { ok: false, error: "Season name is required" };
  if (name.length > SEASON_NAME_MAX) {
    return { ok: false, error: `Name must be ${SEASON_NAME_MAX} characters or fewer` };
  }

  const startDate = asDate(raw.startDate);
  const endDate = asDate(raw.endDate);
  if (!startDate || !endDate) {
    return { ok: false, error: "Start and end dates are required" };
  }
  if (endDate < startDate) {
    return { ok: false, error: "The season cannot end before it starts" };
  }

  return { ok: true, value: { name, startDate, endDate, isCurrent: raw.isCurrent === true } };
}

export interface CategoryInput {
  name: string;
  kind: EntryKind;
  colorIndex: number;
}

export function parseCategoryInput(body: unknown): Parsed<CategoryInput> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) return { ok: false, error: "Category name is required" };
  if (name.length > CATEGORY_NAME_MAX) {
    return { ok: false, error: `Name must be ${CATEGORY_NAME_MAX} characters or fewer` };
  }

  const kind = raw.kind as EntryKind;
  if (!ENTRY_KINDS.includes(kind)) {
    return { ok: false, error: "Category must be income or expense" };
  }

  const colorIndex = raw.colorIndex === undefined ? 1 : Number(raw.colorIndex);
  if (!Number.isInteger(colorIndex) || colorIndex < 1 || colorIndex > CHART_COLOR_COUNT) {
    return { ok: false, error: `Colour must be between 1 and ${CHART_COLOR_COUNT}` };
  }

  return { ok: true, value: { name, kind, colorIndex } };
}

export interface EntryInput {
  seasonId: number;
  categoryId: number;
  title: string;
  counterparty: string | null;
  note: string | null;
  occurredOn: string;
  amountMinor: number;
  currency: Currency;
  rateToRonMicros: number;
}

export function parseEntryInput(body: unknown): Parsed<EntryInput> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const seasonId = Number(raw.seasonId);
  if (!Number.isInteger(seasonId) || seasonId <= 0) {
    return { ok: false, error: "Pick a season" };
  }

  const categoryId = Number(raw.categoryId);
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { ok: false, error: "Pick a category" };
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Title must be ${TITLE_MAX} characters or fewer` };
  }

  const counterparty =
    typeof raw.counterparty === "string" && raw.counterparty.trim()
      ? raw.counterparty.trim().slice(0, COUNTERPARTY_MAX)
      : null;

  const note =
    typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : null;

  const occurredOn = asDate(raw.occurredOn);
  if (!occurredOn) return { ok: false, error: "Date must be a calendar date" };

  // The client sends minor units; a decimal here would mean it did the maths.
  const amountMinor = Number(raw.amountMinor);
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false, error: "Amount must be greater than zero" };
  }
  if (amountMinor > Number.MAX_SAFE_INTEGER / RATE_SCALE) {
    return { ok: false, error: "That amount is too large" };
  }

  const currency = raw.currency as Currency;
  if (!CURRENCIES.includes(currency)) {
    return { ok: false, error: `Currency must be one of ${CURRENCIES.join(", ")}` };
  }

  const rateToRonMicros =
    currency === "RON" ? RATE_SCALE : Number(raw.rateToRonMicros);
  if (
    !Number.isInteger(rateToRonMicros) ||
    rateToRonMicros <= 0 ||
    rateToRonMicros > 2000 * RATE_SCALE
  ) {
    return { ok: false, error: "Exchange rate must be a positive number" };
  }

  if (toRonBani(amountMinor, rateToRonMicros) > 2_000_000_000) {
    return { ok: false, error: "That amount is too large" };
  }

  return {
    ok: true,
    value: {
      seasonId,
      categoryId,
      title,
      counterparty,
      note,
      occurredOn,
      amountMinor,
      currency,
      rateToRonMicros,
    },
  };
}

export interface FinanceDocumentInput extends AttachmentUploadInput {
  kind: DocumentKind;
}

/**
 * Reuses the announcement attachment rules for name, type and size — the two
 * uploads share a bucket and a limit, so they should share the checks — and
 * adds the label saying what the paper actually is.
 */
export function parseFinanceDocumentUpload(
  body: unknown,
  storageKey?: string
): Parsed<FinanceDocumentInput> {
  const base = parseAttachmentUpload(body, storageKey);
  if (!base.ok) return base;

  const raw = (body ?? {}) as Record<string, unknown>;
  const kind = (raw.kind ?? "other") as DocumentKind;
  if (!DOCUMENT_KINDS.includes(kind)) {
    return { ok: false, error: `Document kind must be one of ${DOCUMENT_KINDS.join(", ")}` };
  }

  return { ok: true, value: { ...base.value, kind } };
}

function asDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

/*
  Shaping
*/

export interface Viewer {
  userId: number;
  role: string;
}

export interface FinanceDocumentView {
  id: number;
  kind: DocumentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

export interface FinanceEntryView {
  id: number;
  seasonId: number;
  categoryId: number;
  categoryName: string;
  categoryColorIndex: number;
  kind: EntryKind;
  title: string;
  counterparty: string | null;
  note: string | null;
  occurredOn: string;
  amountMinor: number;
  currency: string;
  rateToRonMicros: number;
  amountRonBani: number;
  /** How many documents back this entry — the only thing non-treasurers see. */
  documentCount: number;
  /** Present only for treasurers; everyone else gets the count above. */
  documents?: FinanceDocumentView[];
}

export type EntryRow = typeof financeEntries.$inferSelect & {
  category: typeof financeCategories.$inferSelect;
  documents: (typeof financeDocuments.$inferSelect)[];
};

/**
 * Shapes an entry for one reader.
 *
 * The whole team can read the ledger, but the paperwork stays with the
 * treasurers: contracts and sponsor invoices carry signatures, bank details and
 * personal data. Non-treasurers get a count and never a storage key, so there
 * is nothing to guess at even if the UI were bypassed.
 */
export function shapeEntry(row: EntryRow, viewer: Viewer): FinanceEntryView {
  const base: FinanceEntryView = {
    id: row.id,
    seasonId: row.seasonId,
    categoryId: row.categoryId,
    categoryName: row.category.name,
    categoryColorIndex: row.category.colorIndex,
    kind: row.kind as EntryKind,
    title: row.title,
    counterparty: row.counterparty,
    note: row.note,
    occurredOn: row.occurredOn,
    amountMinor: row.amountMinor,
    currency: row.currency,
    rateToRonMicros: row.rateToRonMicros,
    amountRonBani: row.amountRonBani,
    documentCount: row.documents.length,
  };

  if (!canViewFinanceDocuments(viewer.role)) return base;

  return {
    ...base,
    documents: row.documents.map(shapeDocument),
  };
}

export function shapeDocument(
  row: typeof financeDocuments.$inferSelect
): FinanceDocumentView {
  return {
    id: row.id,
    kind: row.kind as DocumentKind,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}
