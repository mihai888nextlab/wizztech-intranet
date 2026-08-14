/*
  Pure validation and shared constants for the field-request ("form") feature.
  No database imports, so pages can import the client types and labels without
  dragging the Postgres client into the browser bundle.
*/

export const TITLE_MAX = 200;
export const FIELD_LABEL_MAX = 200;
export const FIELD_LIMIT = 20;
export const VALUE_MAX = 2000;

export const FORM_FIELD_TYPES = ["text", "number", "date", "select"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

/** Human labels for the field types, shown in the admin builder. */
export const FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Short text",
  number: "Number",
  date: "Date",
  select: "Choice",
};

export type Audience = "all" | "selected";

export interface FormFieldInput {
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string | null;
  /** Only for select fields. */
  options: string[];
}

export interface FormRequestInput {
  title: string;
  description: string | null;
  audience: Audience;
  assigneeIds: number[];
  dueDate: string | null;
  fields: FormFieldInput[];
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Decodes the JSON options column, falling back to comma-separated text. */
export function parseFieldOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const options = parsed
        .filter((o): o is string => typeof o === "string")
        .map((o) => o.trim())
        .filter(Boolean);
      if (options.length > 0) return options;
    }
  } catch {
    // Fall through to the comma-separated interpretation.
  }
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function cleanOptionList(raw: unknown): string[] {
  const options = Array.isArray(raw)
    ? raw.map((o) => String(o).trim())
    : String(raw ?? "")
        .split(",")
        .map((o) => o.trim());
  return Array.from(new Set(options.filter(Boolean)));
}

/** Shared by the create and update handlers so the rules cannot drift apart. */
export function parseFormRequestInput(body: unknown): Parsed<FormRequestInput> {
  const raw = (body ?? {}) as Record<string, unknown>;

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) return { ok: false, error: "Title is required" };
  if (title.length > TITLE_MAX) {
    return { ok: false, error: `Title must be ${TITLE_MAX} characters or fewer` };
  }

  const description =
    typeof raw.description === "string" && raw.description.trim()
      ? raw.description.trim()
      : null;

  const audience: Audience = raw.audience === "selected" ? "selected" : "all";

  let assigneeIds: number[] = [];
  if (audience === "selected") {
    if (!Array.isArray(raw.assigneeIds)) {
      return { ok: false, error: "Select at least one member" };
    }
    assigneeIds = Array.from(
      new Set(
        raw.assigneeIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );
    if (assigneeIds.length === 0) {
      return { ok: false, error: "Select at least one member" };
    }
  }

  let dueDate: string | null = null;
  if (typeof raw.dueDate === "string" && raw.dueDate.trim()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate.trim())) {
      return { ok: false, error: "Due date must be a calendar date" };
    }
    dueDate = raw.dueDate.trim();
  }

  if (!Array.isArray(raw.fields) || raw.fields.length === 0) {
    return { ok: false, error: "Add at least one field" };
  }
  if (raw.fields.length > FIELD_LIMIT) {
    return { ok: false, error: `A request can have at most ${FIELD_LIMIT} fields` };
  }

  const fields: FormFieldInput[] = [];
  for (const entry of raw.fields) {
    const field = (entry ?? {}) as Record<string, unknown>;

    const label = typeof field.label === "string" ? field.label.trim() : "";
    if (!label) return { ok: false, error: "Every field needs a label" };
    if (label.length > FIELD_LABEL_MAX) {
      return {
        ok: false,
        error: `Field labels must be ${FIELD_LABEL_MAX} characters or fewer`,
      };
    }

    const type = FORM_FIELD_TYPES.includes(field.type as FormFieldType)
      ? (field.type as FormFieldType)
      : "text";

    const required = field.required !== false;

    let placeholder: string | null = null;
    if (typeof field.placeholder === "string" && field.placeholder.trim()) {
      placeholder = field.placeholder.trim().slice(0, 200);
    }

    let options: string[] = [];
    if (type === "select") {
      options = cleanOptionList(field.options);
      if (options.length < 2) {
        return {
          ok: false,
          error: `"${label}" needs at least two options`,
        };
      }
      if (options.some((o) => o.length > 100)) {
        return {
          ok: false,
          error: `Options for "${label}" must be 100 characters or fewer`,
        };
      }
    }

    fields.push({ label, type, required, placeholder, options });
  }

  return { ok: true, value: { title, description, audience, assigneeIds, dueDate, fields } };
}

interface FieldRule {
  id: number;
  label: string;
  type: FormFieldType;
  required: boolean;
  options: string[];
}

export interface FormValueInput {
  fieldId: number;
  value: string;
}

/**
 * Validates the answers to one submission against the request's fields.
 * Unknown fields are ignored; required fields must be non-empty; values are
 * checked against the field's type (numbers numeric, dates calendar dates,
 * choices one of the stored options).
 */
export function parseFormValuesInput(
  body: unknown,
  fields: FieldRule[]
): Parsed<FormValueInput[]> {
  const raw = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(raw.values)) {
    return { ok: false, error: "Values are required" };
  }

  const byField = new Map<number, string>();
  for (const entry of raw.values) {
    const item = (entry ?? {}) as Record<string, unknown>;
    const fieldId = Number(item.fieldId);
    if (!Number.isInteger(fieldId) || fieldId <= 0) continue;
    const value = typeof item.value === "string" ? item.value.trim() : "";
    byField.set(fieldId, value);
  }

  const values: FormValueInput[] = [];
  for (const field of fields) {
    const value = byField.get(field.id) ?? "";

    if (field.required && !value) {
      return { ok: false, error: `"${field.label}" is required` };
    }
    if (!value) {
      // Optional and left blank — nothing to store.
      continue;
    }
    if (value.length > VALUE_MAX) {
      return { ok: false, error: `"${field.label}" is too long` };
    }

    if (field.type === "number" && !/^-?\d*\.?\d+$/.test(value)) {
      return { ok: false, error: `"${field.label}" must be a number` };
    }
    if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { ok: false, error: `"${field.label}" must be a date` };
    }
    if (field.type === "select" && !field.options.includes(value)) {
      return { ok: false, error: `"${field.label}" has an invalid choice` };
    }

    values.push({ fieldId: field.id, value });
  }

  return { ok: true, value: values };
}
