import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { FormFieldInput } from "@/components/documents/form-field-input";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import type { FormRequest, FormSubmission } from "@/lib/forms";
import { valueOf } from "@/lib/forms";

/**
 * Lets a member fill in (or edit) their answers to a form request. Shared by
 * the Documents page, the announcement cards and the request detail page.
 */
export function FormFillDialog({
  request,
  submission,
  open,
  onOpenChange,
  onSubmitted,
}: {
  request: FormRequest | null;
  submission: FormSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (submission: FormSubmission) => void;
}) {
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Load the form when a request is opened; clear it once the dialog closes.
  const formKey = request ? `fill-${request.id}` : "none";
  if (open && request && loadedKey !== formKey) {
    setLoadedKey(formKey);
    const prefill: Record<number, string> = {};
    for (const field of request.fields) {
      prefill[field.id] = submission ? valueOf(submission, field.id) : "";
    }
    setValues(prefill);
  }
  if (!open && loadedKey !== null) {
    setLoadedKey(null);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!request) return;

    for (const field of request.fields) {
      if (field.required && !(values[field.id] ?? "").trim()) {
        toast.error(`"${field.label}" is required`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/form-requests/${request.id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: request.fields.map((field) => ({
            fieldId: field.id,
            value: values[field.id] ?? "",
          })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not save your answers");
        return;
      }
      onSubmitted(await res.json());
      toast.success(submission ? "Answers updated" : "Answers submitted");
      onOpenChange(false);
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          {request?.description && (
            <div className="text-sm text-muted-foreground">
              <Markdown>{request.description}</Markdown>
            </div>
          )}
        </DialogHeader>

        {request && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {request.fields.map((field) => (
              <div key={field.id} className="space-y-2">
                <Label htmlFor={`fill-${request.id}-${field.id}`}>
                  {field.label}
                  {field.required && (
                    <span className="ml-0.5 text-destructive" aria-hidden="true">
                      *
                    </span>
                  )}
                </Label>
                <FormFieldInput
                  id={`fill-${request.id}-${field.id}`}
                  field={field}
                  value={values[field.id] ?? ""}
                  onChange={(next) =>
                    setValues((prev) => ({ ...prev, [field.id]: next }))
                  }
                />
              </div>
            ))}

            <Button
              type="submit"
              className="h-10 w-full rounded-xl"
              disabled={saving}
            >
              {saving && <Spinner />}
              {submission ? "Save answers" : "Submit answers"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
