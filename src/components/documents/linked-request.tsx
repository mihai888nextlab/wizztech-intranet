import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarClock, ChevronRight, FileText, Lock } from "lucide-react";

import {
  documentStatusOf,
  SubmissionStatusBadge,
} from "@/components/documents/submission-status-badge";
import { UploadButton } from "@/components/documents/upload-button";
import { Button } from "@/components/ui/button";
import {
  allowedTypesOf,
  describeTypes,
  isOverdue,
  type FileRequest,
  type Submission,
} from "@/lib/documents";
import { cn } from "@/lib/utils";

/**
 * A document request shown inside an announcement.
 *
 * Compact on purpose — the announcement is the main content — but a member can
 * still upload without leaving the page, which is the whole point of linking.
 */
export function LinkedRequest({
  request,
  isAdmin,
  onSubmitted,
}: {
  request: FileRequest;
  isAdmin: boolean;
  onSubmitted: (requestId: number, submission: Submission) => void;
}) {
  const status = documentStatusOf(request.mySubmission);
  const closed = Boolean(request.closedAt);
  const overdue = isOverdue(request);

  return (
    <div className="rounded-lg bg-muted/40 p-3 ring-1 ring-border">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
          <FileText className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-pretty">
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
            <span>{describeTypes(allowedTypesOf(request))}</span>
            <span>Max {request.maxSizeMb} MB</span>
          </p>
        </div>

        {!isAdmin && <SubmissionStatusBadge status={status} />}
      </div>

      <div className="mt-3 flex items-center gap-2 pl-11">
        {isAdmin ? (
          <>
            <span className="text-xs text-muted-foreground">
              <span className="font-heading text-sm font-semibold tabular-nums">
                {request.submittedCount ?? 0}
              </span>{" "}
              of {request.assigneeCount} handed in
            </span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              nativeButton={false}
              render={<Link href={`/documents/${request.id}`} />}
            >
              Review <ChevronRight />
            </Button>
          </>
        ) : closed || status === "approved" ? (
          <p className="text-xs text-muted-foreground">
            {closed ? "No longer accepting uploads." : "Approved — nothing to do."}
          </p>
        ) : (
          <UploadButton
            requestId={request.id}
            allowedTypes={allowedTypesOf(request)}
            maxSizeMb={request.maxSizeMb}
            hasExisting={Boolean(request.mySubmission)}
            onUploaded={(saved) => onSubmitted(request.id, saved as Submission)}
            className="w-full sm:w-auto"
          />
        )}
      </div>
    </div>
  );
}
