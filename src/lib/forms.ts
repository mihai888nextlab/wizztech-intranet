import { FORM_FIELD_TYPES, parseFieldOptions, type FormFieldType } from "@/lib/form-requests";

/** Shapes returned by the form-request API, shared by the forms pages. */

export interface FormField {
  id: number;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string | null;
  options: string[];
}

export interface FormValue {
  fieldId: number;
  value: string;
}

export interface FormSubmission {
  id: number;
  userId: number;
  status: string;
  reviewNote: string | null;
  submittedAt: string;
  values: FormValue[];
}

export interface FormRequest {
  id: number;
  title: string;
  description: string | null;
  audience: "all" | "selected";
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
  author: { fullName: string; username: string } | null;
  fields: FormField[];
  assigneeCount: number;
  /** The members a "selected" request targets. Admin view only. */
  assigneeIds?: number[];
  /** Admin list view only. */
  submittedCount?: number;
  approvedCount?: number;
  /** Member view only. */
  mySubmission?: FormSubmission | null;
}

export interface FormRosterEntry {
  user: { id: number; fullName: string; username: string; role: string };
  submission: FormSubmission | null;
}

/** Maps a stored (stringified) options column onto the client field shape. */
export function fieldOf(row: {
  id: number;
  label: string;
  type: string;
  required: boolean;
  placeholder: string | null;
  options: string | null;
}): FormField {
  const type = FORM_FIELD_TYPES.includes(row.type as FormFieldType)
    ? (row.type as FormFieldType)
    : "text";
  return {
    id: row.id,
    label: row.label,
    type,
    required: row.required,
    placeholder: row.placeholder,
    options: type === "select" ? parseFieldOptions(row.options) : [],
  };
}

/** The value a member has stored for one field, if any. */
export function valueOf(
  submission: Pick<FormSubmission, "values"> | null | undefined,
  fieldId: number
): string {
  return submission?.values.find((v) => v.fieldId === fieldId)?.value ?? "";
}

/** Includes "missing", which is the absence of a submission rather than a row. */
export type FormStatus = "missing" | "submitted" | "approved" | "rejected";

export function formStatusOf(
  submission: { status: string } | null | undefined
): FormStatus {
  if (!submission) return "missing";
  if (submission.status === "approved") return "approved";
  if (submission.status === "rejected") return "rejected";
  return "submitted";
}

/** Past due and still open — a closed request is no longer chaseable. */
export function isOverdueForm(
  request: Pick<FormRequest, "dueDate" | "closedAt">
) {
  return Boolean(
    request.dueDate && !request.closedAt && request.dueDate < todayISO()
  );
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
