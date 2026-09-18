import Link from "next/link";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { CalendarClock, ChevronRight, ClipboardList, Lock } from "lucide-react";

import { FormFillDialog } from "@/components/documents/form-fill-dialog";
import { SubmissionStatusBadge } from "@/components/documents/submission-status-badge";
import { Button } from "@/components/ui/button";
import {
  formStatusOf,
  isOverdueForm,
  type FormRequest,
  type FormSubmission,
} from "@/lib/forms";
import { cn } from "@/lib/utils";

/**
 * A field request shown inside an announcement.
 *
 * Compact on purpose — the announcement is the main content — but a member can
 * still fill the form without leaving the page.
 */
export function LinkedForm({
  request,
  isAdmin,
  onSubmitted,
}: {
  request: FormRequest;
  isAdmin: boolean;
  onSubmitted: (requestId: number, submission: FormSubmission) => void;
}) {
  const [filling, setFilling] = useState(false);
  const status = formStatusOf(request.mySubmission);
  const closed = Boolean(request.closedAt);
  const overdue = isOverdueForm(request);
  const submission = request.mySubmission ?? null;

  return (
    <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-border">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
          <ClipboardList className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-pretty">
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
            </p>
            {closed && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" /> Closed
              </span>
            )}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
            {request.dueDate && (
              <span
                className={cn(
                  "inline-flex items-center gap-1",
                  overdue && "font-medium text-destructive"
                )}
              >
                <CalendarClock className="size-3" />
                {overdue ? "Overdue " : "Due "}
                {format(parseISO(request.dueDate), "MMM d")}
              </span>
            )}
            <span>
              {request.fields.length} field
              {request.fields.length === 1 ? "" : "s"}
            </span>
          </p>
        </div>

        {!isAdmin && <SubmissionStatusBadge status={formStatusOf(submission)} />}
      </div>

      <div className="mt-3 flex flex-col gap-2 pl-11">
        {isAdmin ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              <span className="font-heading text-sm font-semibold tabular-nums">
                {request.submittedCount ?? 0}
              </span>{" "}
              of {request.assigneeCount} filled in
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              nativeButton={false}
              render={<Link href={`/forms/${request.id}`} />}
            >
              Review <ChevronRight />
            </Button>
          </div>
        ) : status === "rejected" && submission?.reviewNote ? (
          <>
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <span className="font-medium">Changes needed:</span>{" "}
              {submission.reviewNote}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilling(true)}
              className="self-start"
            >
              Edit answers
            </Button>
          </>
        ) : closed ? (
          <p className="text-xs text-muted-foreground">
            No longer accepting answers.
          </p>
        ) : status === "approved" ? (
          <p className="text-xs text-muted-foreground">
            Approved — nothing to do.
          </p>
        ) : (
          <Button
            size="sm"
            onClick={() => setFilling(true)}
            className="self-start"
          >
            {submission ? "Edit answers" : "Fill in"}
          </Button>
        )}
      </div>

      <FormFillDialog
        request={request}
        submission={submission}
        open={filling}
        onOpenChange={(open) => !open && setFilling(false)}
        onSubmitted={(saved) => onSubmitted(request.id, saved)}
      />
    </div>
  );
}
