import { useState, useEffect, FormEvent } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  CalendarClock,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { FilePreviewDialog } from "@/components/documents/file-preview-dialog";
import {
  documentStatusOf,
  SubmissionStatusBadge,
} from "@/components/documents/submission-status-badge";
import { UploadButton } from "@/components/documents/upload-button";
import { EmptyState } from "@/components/empty-state";
import { AppShell, AuthLoading } from "@/components/layout/app-shell";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/use-user";
import {
  allowedTypesOf,
  describeTypes,
  isOverdue,
  TYPE_CHOICES,
  type FileRequest,
  type Submission,
  type TeamMember,
} from "@/lib/documents";
import { MAX_SIZE_MB_LIMIT, TITLE_MAX } from "@/lib/file-requests";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";


export default function DocumentsPage() {
  const user = useUser();
  const [requests, setRequests] = useState<FileRequest[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FileRequest | null>(null);
  const [deleting, setDeleting] = useState<FileRequest | null>(null);
  const [previewing, setPreviewing] = useState<Submission | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    fetch("/api/file-requests")
      .then((res) => (res.ok ? res.json() : []))
      .then(setRequests)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : []))
      .then(setMembers);
  }, [isAdmin]);

  if (!user) return <AuthLoading />;

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/file-requests/${deleting.id}`, { method: "DELETE" });
    if (res.ok) {
      setRequests(requests.filter((r) => r.id !== deleting.id));
      toast.success("Request deleted");
    } else {
      toast.error("Could not delete that request");
    }
  };

  const toggleClosed = async (request: FileRequest) => {
    const res = await fetch(`/api/file-requests/${request.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ closed: !request.closedAt }),
    });
    if (!res.ok) {
      toast.error("Could not update that request");
      return;
    }
    const updated = await res.json();
    setRequests(
      requests.map((r) => (r.id === updated.id ? { ...r, closedAt: updated.closedAt } : r))
    );
    toast.success(updated.closedAt ? "Request closed" : "Request reopened");
  };

  const outstanding = requests.filter(
    (r) => !r.closedAt && documentStatusOf(r.mySubmission) !== "approved"
  ).length;

  return (
    <AppShell
      user={user}
      title="Documents"
      description={
        isAdmin
          ? "Ask the team for files and track who has handed them in."
          : outstanding > 0
            ? `You have ${outstanding} file${outstanding === 1 ? "" : "s"} to hand in.`
            : "Files requested from you."
      }
      action={
        isAdmin && (
          <Button size="lg" onClick={() => setCreating(true)}>
            <Plus /> New
          </Button>
        )
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={isAdmin ? "No requests yet" : "Nothing to hand in"}
          description={
            isAdmin
              ? "Create a request to start collecting signed forms from the team."
              : "When an admin asks for a document, it will appear here."
          }
          action={
            isAdmin && (
              <Button onClick={() => setCreating(true)}>
                <Plus /> New request
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              isAdmin={isAdmin}
              onEdit={() => setEditing(request)}
              onDelete={() => setDeleting(request)}
              onToggleClosed={() => toggleClosed(request)}
              onPreview={setPreviewing}
              onSubmitted={(submission) =>
                setRequests((prev) =>
                  prev.map((r) =>
                    r.id === request.id ? { ...r, mySubmission: submission } : r
                  )
                )
              }
            />
          ))}
        </div>
      )}

      {isAdmin && (
        <RequestDialog
          open={creating || editing !== null}
          existing={editing}
          members={members}
          onOpenChange={(open) => {
            if (!open) {
              setCreating(false);
              setEditing(null);
            }
          }}
          onSaved={(saved) =>
            setRequests((prev) =>
              prev.some((r) => r.id === saved.id)
                ? prev.map((r) => (r.id === saved.id ? { ...r, ...saved } : r))
                : [saved, ...prev]
            )
          }
        />
      )}

      <FilePreviewDialog
        submission={previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="Every file handed in for this request is permanently deleted from storage too. This cannot be undone."
        onConfirm={handleDelete}
      />
    </AppShell>
  );
}

function RequestCard({
  request,
  isAdmin,
  onEdit,
  onDelete,
  onToggleClosed,
  onPreview,
  onSubmitted,
}: {
  request: FileRequest;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onToggleClosed: () => void;
  onPreview: (submission: Submission) => void;
  onSubmitted: (submission: Submission) => void;
}) {
  const status = documentStatusOf(request.mySubmission);
  const overdue = isOverdue(request);
  const closed = Boolean(request.closedAt);

  return (
    <article className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base leading-snug font-semibold tracking-tight text-pretty sm:text-lg">
              {isAdmin ? (
                <Link
                  href={`/documents/${request.id}`}
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
            <span>{describeTypes(allowedTypesOf(request))}</span>
            <span>Max {request.maxSizeMb} MB</span>
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
          <AdminSummary request={request} />
        ) : (
          <MemberActions
            request={request}
            status={status}
            onPreview={onPreview}
            onSubmitted={onSubmitted}
          />
        )}
      </footer>
    </article>
  );
}

function AdminSummary({ request }: { request: FileRequest }) {
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
            <span className="text-muted-foreground"> of {total} handed in</span>
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
        render={<Link href={`/documents/${request.id}`} />}
      >
        Review <ChevronRight />
      </Button>
    </div>
  );
}

function MemberActions({
  request,
  status,
  onPreview,
  onSubmitted,
}: {
  request: FileRequest;
  status: ReturnType<typeof documentStatusOf>;
  onPreview: (submission: Submission) => void;
  onSubmitted: (submission: Submission) => void;
}) {
  const submission = request.mySubmission ?? null;
  const closed = Boolean(request.closedAt);

  return (
    <div className="space-y-3">
      {submission && (
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{submission.fileName}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatBytes(submission.sizeBytes)} ·{" "}
              {format(parseISO(submission.uploadedAt), "MMM d, HH:mm")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Preview your file"
            onClick={() => onPreview(submission)}
          >
            <Eye />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download your file"
            nativeButton={false}
            render={<a href={`/api/submissions/${submission.id}/download`} />}
          >
            <Download />
          </Button>
        </div>
      )}

      {status === "rejected" && submission?.reviewNote && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">Changes needed:</span> {submission.reviewNote}
        </p>
      )}

      {closed ? (
        <p className="text-sm text-muted-foreground">
          This request is closed
          {status === "missing" ? " and you did not hand anything in." : "."}
        </p>
      ) : status === "approved" ? (
        <p className="text-sm text-muted-foreground">
          Approved — nothing more to do.
        </p>
      ) : (
        <UploadButton
          requestId={request.id}
          allowedTypes={allowedTypesOf(request)}
          maxSizeMb={request.maxSizeMb}
          hasExisting={Boolean(submission)}
          onUploaded={(saved) => onSubmitted(saved as Submission)}
          className="w-full sm:w-auto"
        />
      )}
    </div>
  );
}

function RequestDialog({
  open,
  existing,
  members,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  existing: FileRequest | null;
  members: TeamMember[];
  onOpenChange: (open: boolean) => void;
  onSaved: (request: FileRequest) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [maxSizeMb, setMaxSizeMb] = useState("10");
  const [audience, setAudience] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [tab, setTab] = useState("write");
  const [saving, setSaving] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Load on open, clear on close.
  const formKey = existing ? `edit-${existing.id}` : "new";
  if (open && loadedKey !== formKey) {
    setLoadedKey(formKey);
    setTitle(existing?.title ?? "");
    setDescription(existing?.description ?? "");
    setDueDate(existing?.dueDate ?? "");
    setMaxSizeMb(String(existing?.maxSizeMb ?? 10));
    setAudience(existing?.audience ?? "all");
    setSelected([]);
    setTypes(existing ? allowedTypesOf(existing) : TYPE_CHOICES.map((t) => t.value));
    setTab("write");
  }
  if (!open && loadedKey !== null) {
    setLoadedKey(null);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (audience === "selected" && selected.length === 0) {
      toast.error("Pick at least one member");
      return;
    }
    if (types.length === 0) {
      toast.error("Allow at least one file type");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        existing ? `/api/file-requests/${existing.id}` : "/api/file-requests",
        {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: description || undefined,
            dueDate: dueDate || undefined,
            maxSizeMb: Number(maxSizeMb),
            audience,
            assigneeIds: audience === "selected" ? selected : undefined,
            allowedTypes: types,
          }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Could not save the request");
        return;
      }
      onSaved(await res.json());
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
            {existing ? "Edit request" : "Request a document"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">What do you need?</Label>
            <Input
              id="title"
              className="h-10"
              maxLength={TITLE_MAX}
              placeholder="Signed medical release"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="description">Instructions</Label>
              <TabsList className="h-7">
                <TabsTrigger value="write" className="px-2.5 text-xs">
                  Write
                </TabsTrigger>
                <TabsTrigger value="preview" className="px-2.5 text-xs">
                  Preview
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="write" className="space-y-2">
              <Textarea
                id="description"
                className="min-h-28 font-mono text-sm"
                placeholder={"Scan **both sides**.\n\n- Parent signature required\n- Photos are fine if readable"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional. Markdown supported.
              </p>
            </TabsContent>
            <TabsContent value="preview">
              <div className="min-h-28 rounded-lg border border-border bg-muted/30 p-3">
                {description.trim() ? (
                  <Markdown>{description}</Markdown>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing to preview yet.
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                className="h-10"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxSize">Max size (MB)</Label>
              <Input
                id="maxSize"
                type="number"
                min={1}
                max={MAX_SIZE_MB_LIMIT}
                className="h-10"
                value={maxSizeMb}
                onChange={(e) => setMaxSizeMb(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Accepted file types</Label>
            <div className="grid grid-cols-2 gap-1">
              {TYPE_CHOICES.map((choice) => {
                const checked = types.includes(choice.value);
                return (
                  <label
                    key={choice.value}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-muted"
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={checked}
                      onCheckedChange={(next) =>
                        setTypes((prev) =>
                          next
                            ? [...prev, choice.value]
                            : prev.filter((t) => t !== choice.value)
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-sm leading-tight font-medium">
                        {choice.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {choice.hint}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Enforced by reading each file&apos;s header, not just its name.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Who needs to send it?</Label>
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
