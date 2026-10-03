import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";
import {
  CalendarClock,
  Check,
  ClipboardList,
  Lock,
  Pencil,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { FormFillDialog } from "@/components/documents/form-fill-dialog";
import { SubmissionStatusBadge } from "@/components/documents/submission-status-badge";
import { EmptyState } from "@/components/empty-state";
import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { Markdown } from "@/components/markdown";
import { ListCard, ListRow } from "@/components/section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/use-user";
import {
  formStatusOf,
  isOverdueForm,
  valueOf,
  type FormRequest,
  type FormRosterEntry,
  type FormSubmission,
} from "@/lib/forms";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isAdmin as hasAdminRole } from "@/lib/roles";

type Detail = FormRequest & { roster?: FormRosterEntry[] };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "missing", label: "Missing" },
  { value: "submitted", label: "To review" },
  { value: "approved", label: "Approved" },
] as const;

export default function FormRequestPage() {
  const router = useRouter();
  const { id } = router.query;
  const user = useUser();
  const [request, setRequest] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [rejecting, setRejecting] = useState<FormSubmission | null>(null);
  const [viewing, setViewing] = useState<{
    submission: FormSubmission;
    ownerName: string;
  } | null>(null);
  const [filling, setFilling] = useState(false);

  const isAdmin = hasAdminRole(user?.roles);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/form-requests/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setRequest)
      .finally(() => setLoading(false));
  }, [id]);

  if (!user) return <AuthLoading />;

  const patchSubmission = (updated: FormSubmission) =>
    setRequest((prev) =>
      prev
        ? {
            ...prev,
            mySubmission:
              prev.mySubmission?.id === updated.id ? updated : prev.mySubmission,
            roster: prev.roster?.map((entry) =>
              entry.submission?.id === updated.id
                ? { ...entry, submission: updated }
                : entry
            ),
          }
        : prev
    );

  const review = async (
    submission: FormSubmission,
    status: "approved" | "rejected",
    reviewNote?: string
  ) => {
    const res = await fetch(`/api/form-submissions/${submission.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote }),
    });
    if (!res.ok) {
      toast.error("Could not save that review");
      return false;
    }
    patchSubmission(await res.json());
    toast.success(status === "approved" ? "Approved" : "Changes requested");
    return true;
  };

  const roster = request?.roster ?? [];
  const counts = {
    all: roster.length,
    missing: roster.filter((e) => formStatusOf(e.submission) === "missing").length,
    submitted: roster.filter((e) => formStatusOf(e.submission) === "submitted").length,
    approved: roster.filter((e) => formStatusOf(e.submission) === "approved").length,
  };
  const visible =
    filter === "all"
      ? roster
      : roster.filter((e) => formStatusOf(e.submission) === filter);

  return (
    <AppShell
      user={user}
      back={{ href: "/documents?tab=fields", label: "Documents" }}
    >
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : !request ? (
        <EmptyState
          icon={ClipboardList}
          title="Request not found"
          description="It may have been deleted."
        />
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {request.closedAt && (
                <Badge variant="secondary" className="gap-1.5 text-muted-foreground">
                  <Lock aria-hidden="true" /> Closed
                </Badge>
              )}
              {isOverdueForm(request) && (
                <Badge className="bg-destructive/12 text-destructive">Overdue</Badge>
              )}
            </div>
            <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
              {request.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {request.dueDate && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  Due {format(parseISO(request.dueDate), "MMM d, yyyy")}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" />
                {request.audience === "all" ? "Whole team" : "Selected members"}
              </span>
              <span>
                {request.fields.length} field
                {request.fields.length === 1 ? "" : "s"}
              </span>
            </div>
            {request.description && (
              <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
                <Markdown className="text-sm/relaxed">{request.description}</Markdown>
              </div>
            )}
          </div>

          {!isAdmin ? (
            <MemberPanel
              request={request}
              onFill={() => setFilling(true)}
            />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={filter === f.value}
                    onClick={() => setFilter(f.value)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      filter === f.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                    <span className="tabular-nums opacity-70">
                      {counts[f.value as keyof typeof counts]}
                    </span>
                  </button>
                ))}
              </div>

              {visible.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Nobody here"
                  description="No member matches this filter."
                  className="py-8"
                />
              ) : (
                <ListCard>
                  {visible.map((entry) => (
                    <RosterRow
                      key={entry.user.id}
                      entry={entry}
                      onView={() =>
                        entry.submission &&
                        setViewing({
                          submission: entry.submission,
                          ownerName: entry.user.fullName,
                        })
                      }
                      onApprove={() =>
                        entry.submission && review(entry.submission, "approved")
                      }
                      onReject={() =>
                        entry.submission && setRejecting(entry.submission)
                      }
                    />
                  ))}
                </ListCard>
              )}
            </div>
          )}
        </div>
      )}

      <AnswersDialog
        request={request}
        viewing={viewing}
        onOpenChange={(open) => !open && setViewing(null)}
      />

      <RejectDialog
        submission={rejecting}
        onOpenChange={(open) => !open && setRejecting(null)}
        onConfirm={async (note) => {
          if (!rejecting) return;
          if (await review(rejecting, "rejected", note)) setRejecting(null);
        }}
      />

      <FormFillDialog
        request={request}
        submission={request?.mySubmission ?? null}
        open={filling}
        onOpenChange={(open) => !open && setFilling(false)}
        onSubmitted={(saved) => {
          setRequest((prev) => (prev ? { ...prev, mySubmission: saved } : prev));
          toast.success("Answers saved");
        }}
      />
    </AppShell>
  );
}

function RosterRow({
  entry,
  onView,
  onApprove,
  onReject,
}: {
  entry: FormRosterEntry;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const status = formStatusOf(entry.submission);
  const submission = entry.submission;

  return (
    <ListRow className="flex-wrap gap-y-3">
      <Avatar className="size-8">
        <AvatarFallback className="bg-secondary text-[11px] font-medium text-foreground">
          {initialsOf(entry.user.fullName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.user.fullName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {submission
            ? `Answered ${format(parseISO(submission.submittedAt), "MMM d, HH:mm")}`
            : `@${entry.user.username}`}
        </p>
      </div>

      <SubmissionStatusBadge status={status} />

      {submission && (
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`View ${entry.user.fullName}'s answers`}
            onClick={onView}
          >
            <ClipboardList />
          </Button>
          {status !== "approved" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Approve"
              className="text-success hover:bg-success/10"
              onClick={onApprove}
            >
              <Check />
            </Button>
          )}
          {status !== "rejected" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Request changes"
              className="text-destructive hover:bg-destructive/10"
              onClick={onReject}
            >
              <X />
            </Button>
          )}
        </div>
      )}
    </ListRow>
  );
}

/** Members reaching this route directly see their own answers, nothing else. */
function MemberPanel({
  request,
  onFill,
}: {
  request: Detail;
  onFill: () => void;
}) {
  const submission = request.mySubmission ?? null;
  const status = formStatusOf(submission);

  return (
    <div className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-medium">Your answers</p>
        <SubmissionStatusBadge status={status} />
      </div>

      {request.fields.map((field) => (
        <div key={field.id} className="border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {field.label}
          </p>
          <p className="mt-1 text-sm text-pretty">
            {submission ? valueOf(submission, field.id) || "—" : "—"}
          </p>
        </div>
      ))}

      {status === "rejected" && submission?.reviewNote && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="font-medium">Changes needed:</span>{" "}
          {submission.reviewNote}
        </p>
      )}

      {request.closedAt ? (
        <p className="text-sm text-muted-foreground">This request is closed.</p>
      ) : status === "approved" ? (
        <p className="text-sm text-muted-foreground">
          Approved — nothing more to do.
        </p>
      ) : (
        <Button size="lg" onClick={onFill} variant={submission ? "outline" : "default"}>
          <Pencil /> {submission ? "Edit answers" : "Fill in"}
        </Button>
      )}
    </div>
  );
}

/** Admin view of one member's submitted answers. */
function AnswersDialog({
  request,
  viewing,
  onOpenChange,
}: {
  request: Detail | null;
  viewing: { submission: FormSubmission; ownerName: string } | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={viewing !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{viewing?.ownerName}&apos;s answers</DialogTitle>
          {viewing && (
            <div className="flex items-center gap-2">
              <SubmissionStatusBadge status={formStatusOf(viewing.submission)} />
              {viewing.submission.reviewNote && (
                <span className="text-xs text-destructive">
                  {viewing.submission.reviewNote}
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="space-y-3">
          {request?.fields.map((field) => (
            <div key={field.id} className="rounded-lg bg-muted/40 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">
                {field.label}
              </p>
              <p className="mt-1 text-sm text-pretty">
                {viewing
                  ? valueOf(viewing.submission, field.id) || "—"
                  : "—"}
              </p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  submission,
  onOpenChange,
  onConfirm,
}: {
  submission: FormSubmission | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => Promise<void>;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  if (submission && submission.id !== loadedId) {
    setLoadedId(submission.id);
    setNote(submission.reviewNote ?? "");
  }
  if (!submission && loadedId !== null) {
    setLoadedId(null);
  }

  return (
    <Dialog open={submission !== null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>Request changes</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="formReviewNote">What needs fixing?</Label>
            <Textarea
              id="formReviewNote"
              placeholder="The contact number looks wrong — please double-check it."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Shown to the member so they know what to change.
            </p>
          </div>
          <Button
            className="h-10 w-full rounded-xl"
            variant="destructive"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm(note);
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving && <Spinner />}
            Request changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
