import { useState, type FormEvent } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  CalendarClock,
  ChevronRight,
  ClipboardList,
  ListPlus,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormFillDialog } from "@/components/documents/form-fill-dialog";
import { SubmissionStatusBadge } from "@/components/documents/submission-status-badge";
import { EmptyState } from "@/components/empty-state";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  FIELD_TYPE_LABELS,
  TITLE_MAX,
  type FormFieldType,
} from "@/lib/form-requests";
import type { TeamMember } from "@/lib/documents";
import {
  formStatusOf,
  isOverdueForm,
  type FormRequest,
  type FormSubmission,
} from "@/lib/forms";
import { cn } from "@/lib/utils";

interface DraftField {
  key: number;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder: string;
  options: string;
}

interface FieldsSectionProps {
  isAdmin: boolean;
  members: TeamMember[];
  requests: FormRequest[];
  loading: boolean;
  creating: boolean;
  editing: FormRequest | null;
  deleting: FormRequest | null;
  onCreateChange: (open: boolean) => void;
  onDeleteChange: (open: boolean) => void;
  onEdit: (request: FormRequest) => void;
  onDelete: (request: FormRequest) => void;
  onSaved: (request: FormRequest, isNew: boolean) => void;
  onDeleted: (request: FormRequest) => void;
  onToggleClosed: (request: FormRequest) => void;
  onSubmitted: (request: FormRequest, submission: FormSubmission) => void;
}

export function FieldsSection({
  isAdmin,
  members,
  requests,
  loading,
  creating,
  editing,
  deleting,
  onCreateChange,
  onDeleteChange,
  onEdit,
  onDelete,
  onSaved,
  onDeleted,
  onToggleClosed,
  onSubmitted,
}: FieldsSectionProps) {
  const [filling, setFilling] = useState<FormRequest | null>(null);

  return (
    <>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={isAdmin ? "No field requests yet" : "Nothing to fill in"}
          description={
            isAdmin
              ? "Ask the team for details like contact info or sizes."
              : "When an admin asks for answers, they will appear here."
          }
          action={
            isAdmin && (
              <Button onClick={() => onCreateChange(true)}>
                <ListPlus /> New field request
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <FormRequestCard
              key={request.id}
              request={request}
              isAdmin={isAdmin}
              onEdit={() => onEdit(request)}
              onDelete={() => onDelete(request)}
              onToggleClosed={() => onToggleClosed(request)}
              onFill={() => setFilling(request)}
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <FormRequestDialog
          open={creating || editing !== null}
          existing={editing}
          members={members}
          onOpenChange={(open) => {
            if (!open) onCreateChange(false);
          }}
          onSaved={onSaved}
        />
      )}

      <FormFillDialog
        request={filling}
        submission={filling?.mySubmission ?? null}
        open={filling !== null}
        onOpenChange={(open) => !open && setFilling(null)}
        onSubmitted={(saved) => {
          if (filling) onSubmitted(filling, saved);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && onDeleteChange(false)}
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="Every answer handed in for this request is deleted too. This cannot be undone."
        onConfirm={async () => {
          if (deleting) onDeleted(deleting);
        }}
      />
    </>
  );
}

function FormRequestCard({
  request,
  isAdmin,
  onEdit,
  onDelete,
  onToggleClosed,
  onFill,
}: {
  request: FormRequest;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleClosed: () => void;
  onFill: () => void;
}) {
  const status = formStatusOf(request.mySubmission);
  const overdue = isOverdueForm(request);
  const closed = Boolean(request.closedAt);
  const submission = request.mySubmission ?? null;

  return (
    <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base leading-snug font-semibold tracking-tight text-pretty sm:text-lg">
              {isAdmin ? (
                <Link
                  href={`/forms/${request.id}`}
                  className="transition-colors hover:text-primary"
                >
                  {request.title}
                </Link>
              ) : (
                request.title
              )}
            </h2>
            {closed && (
              <Badge variant="secondary" className="gap-1.5 text-muted-foreground">
                <Lock aria-hidden="true" /> Closed
              </Badge>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {request.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5",
                  overdue && "font-medium text-destructive"
                )}
              >
                <CalendarClock className="size-3.5" />
                {overdue ? "Overdue — was due " : "Due "}
                {format(parseISO(request.dueDate), "MMM d, yyyy")}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {request.audience === "all"
                ? "Whole team"
                : `${request.assigneeCount} member${request.assigneeCount === 1 ? "" : "s"}`}
            </span>
            <span>
              {request.fields.length} field
              {request.fields.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {isAdmin ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mt-1 -mr-1 size-9 shrink-0 text-muted-foreground"
                  aria-label="Request actions"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onToggleClosed}>
                <Lock /> {closed ? "Reopen" : "Close"}
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <SubmissionStatusBadge status={status} />
        )}
      </header>

      {request.description && (
        <div className="mt-3 border-t border-border pt-3">
          <Markdown className="text-sm/relaxed">{request.description}</Markdown>
        </div>
      )}

      <footer className="mt-4 border-t border-border pt-4">
        {isAdmin ? (
          <FormAdminSummary request={request} />
        ) : (
          <div className="space-y-3">
            {status === "rejected" && submission?.reviewNote && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <span className="font-medium">Changes needed:</span>{" "}
                {submission.reviewNote}
              </p>
            )}

            {closed ? (
              <p className="text-sm text-muted-foreground">
                This request is closed
                {status === "missing" ? " and you did not fill it in." : "."}
              </p>
            ) : status === "approved" ? (
              <p className="text-sm text-muted-foreground">
                Approved — nothing more to do.
              </p>
            ) : (
              <Button
                size="lg"
                onClick={onFill}
                className="w-full sm:w-auto"
                variant={submission ? "outline" : "default"}
              >
                {submission ? "Edit answers" : "Fill in"}
              </Button>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}

function FormAdminSummary({ request }: { request: FormRequest }) {
  const submitted = request.submittedCount ?? 0;
  const approved = request.approvedCount ?? 0;
  const total = request.assigneeCount;
  const percent = total > 0 ? Math.round((submitted / total) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-40 flex-1">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium">
            <span className="font-heading text-base font-semibold tabular-nums">
              {submitted}
            </span>
            <span className="text-muted-foreground"> of {total} filled in</span>
          </span>
          <span className="text-muted-foreground tabular-nums">
            {approved} approved
          </span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={submitted}
          aria-valuemin={0}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <Button
        variant="outline"
        size="lg"
        nativeButton={false}
        render={<Link href={`/forms/${request.id}`} />}
      >
        Review <ChevronRight />
      </Button>
    </div>
  );
}

function FormRequestDialog({
  open,
  existing,
  members,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  existing: FormRequest | null;
  members: TeamMember[];
  onOpenChange: (open: boolean) => void;
  onSaved: (request: FormRequest, isNew: boolean) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [fields, setFields] = useState<DraftField[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [saving, setSaving] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Load on open, clear on close.
  const formKey = existing ? `edit-${existing.id}` : "new";
  if (open && loadedKey !== formKey) {
    setLoadedKey(formKey);
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setDueDate(existing?.dueDate ?? "");
    setAudience(existing?.audience ?? "all");
    setSelected(existing?.assigneeIds ?? []);
    setFields(
      existing
        ? existing.fields.map((f) => ({
            key: f.id,
            label: f.label,
            type: f.type,
            required: f.required,
            placeholder: f.placeholder ?? "",
            options: f.options.join(", "),
          }))
        : [
            {
              key: 1,
              label: "",
              type: "text",
              required: true,
              placeholder: "",
              options: "",
            },
          ]
    );
    setNextKey((existing?.fields.length ?? 1) + 1);
  }
  if (!open && loadedKey !== null) {
    setLoadedKey(null);
  }

  const patchField = (key: number, patch: Partial<DraftField>) =>
    setFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, ...patch } : f))
    );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (audience === "selected" && selected.length === 0) {
      toast.error("Pick at least one member");
      return;
    }
    const filled = fields.filter((f) => f.label.trim());
    if (filled.length === 0) {
      toast.error("Add at least one field");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(
        existing ? `/api/form-requests/${existing.id}` : "/api/form-requests",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || undefined,
            dueDate: dueDate || undefined,
            audience,
            assigneeIds: audience === "selected" ? selected : undefined,
            fields: filled.map((f) => ({
              label: f.label,
              type: f.type,
              required: f.required,
              placeholder: f.placeholder || undefined,
              options: f.type === "select"
                ? f.options
                    .split(",")
                    .map((o) => o.trim())
                    .filter(Boolean)
                : undefined,
            })),
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not save the request");
        return;
      }
      onSaved(await res.json(), !existing);
      toast.success(existing ? "Request updated" : "Request created");
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
          <DialogTitle>
            {existing ? "Edit field request" : "Request specific fields"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Ask the team to fill in details instead of uploading a file.
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="formTitle">What do you need?</Label>
            <Input
              id="formTitle"
              className="h-10"
              maxLength={TITLE_MAX}
              placeholder="Emergency contact details"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="formDescription">Instructions</Label>
            <Input
              id="formDescription"
              className="h-10"
              placeholder="Optional — e.g. 'Use a parent's phone number'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="formDueDate">Due date</Label>
              <Input
                id="formDueDate"
                type="date"
                className="h-10"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fields needed</Label>
              <p className="flex h-10 items-center text-xs text-muted-foreground">
                {fields.filter((f) => f.label.trim()).length} added
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Fields</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setFields((prev) => [
                    ...prev,
                    {
                      key: nextKey,
                      label: "",
                      type: "text",
                      required: true,
                      placeholder: "",
                      options: "",
                    },
                  ]);
                  setNextKey((k) => k + 1);
                }}
              >
                <ListPlus /> Add field
              </Button>
            </div>

            <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
              {fields.map((field, index) => (
                <div
                  key={field.key}
                  className="space-y-2 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <div className="grid flex-1 grid-cols-2 gap-2">
                      <Input
                        className="h-9"
                        placeholder="Field label, e.g. Phone number"
                        value={field.label}
                        onChange={(e) =>
                          patchField(field.key, { label: e.target.value })
                        }
                      />
                      <Select
                        value={field.type}
                        onValueChange={(next) =>
                          next && patchField(field.key, { type: next as FormFieldType })
                        }
                      >
                        <SelectTrigger className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FIELD_TYPE_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove field"
                      className="text-muted-foreground"
                      onClick={() =>
                        setFields((prev) =>
                          prev.filter((f) => f.key !== field.key)
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      className="h-9 flex-1"
                      placeholder="Placeholder (optional)"
                      value={field.placeholder}
                      onChange={(e) =>
                        patchField(field.key, { placeholder: e.target.value })
                      }
                    />
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                      <Checkbox
                        checked={field.required}
                        onCheckedChange={(next) =>
                          patchField(field.key, { required: Boolean(next) })
                        }
                      />
                      Required
                    </label>
                  </div>

                  {field.type === "select" && (
                    <Input
                      className="h-9"
                      placeholder="Options, comma separated — e.g. S, M, L"
                      value={field.options}
                      onChange={(e) =>
                        patchField(field.key, { options: e.target.value })
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Who needs to fill it in?</Label>
            <div className="flex gap-0.5 rounded-lg bg-muted p-[3px]">
              {(
                [
                  { value: "all", label: "Whole team" },
                  { value: "selected", label: "Pick members" },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={audience === option.value}
                  onClick={() => setAudience(option.value)}
                  className={cn(
                    "h-8 flex-1 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    audience === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {audience === "selected" && (
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {members.length === 0 ? (
                  <p className="p-2 text-sm text-muted-foreground">
                    Loading members…
                  </p>
                ) : (
                  members.map((member) => {
                    const checked = selected.includes(member.id);
                    return (
                      <label
                        key={member.id}
                        className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            setSelected((prev) =>
                              next
                                ? [...prev, member.id]
                                : prev.filter((id) => id !== member.id)
                            )
                          }
                        />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {member.fullName}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            @{member.username}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
            {existing && audience === "selected" && (
              <p className="text-xs text-muted-foreground">
                Saving replaces the current member list.
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="h-10 w-full rounded-xl"
            disabled={saving || !title.trim()}
          >
            {saving && <Spinner />}
            {existing ? "Save changes" : "Create request"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
