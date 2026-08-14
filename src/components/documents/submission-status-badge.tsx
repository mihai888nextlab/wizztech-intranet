import { Check, Clock, FileWarning, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Includes "missing", which is the absence of a submission rather than a row. */
export type DocumentStatus = "missing" | "submitted" | "approved" | "rejected";

export function documentStatusOf(
  submission: { status: string } | null | undefined
): DocumentStatus {
  if (!submission) return "missing";
  if (submission.status === "approved") return "approved";
  if (submission.status === "rejected") return "rejected";
  return "submitted";
}

const LOOKS = {
  missing: { label: "Not submitted", icon: Upload, className: "bg-muted text-muted-foreground" },
  submitted: { label: "Awaiting review", icon: Clock, className: "bg-primary/12 text-primary" },
  approved: { label: "Approved", icon: Check, className: "bg-success/12 text-success" },
  rejected: { label: "Changes needed", icon: FileWarning, className: "bg-destructive/12 text-destructive" },
} as const;

export function SubmissionStatusBadge({
  status,
  className,
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const look = LOOKS[status];
  const Icon = look.icon;
  return (
    <Badge className={cn("shrink-0 gap-1.5", look.className, className)}>
      <Icon aria-hidden="true" />
      {look.label}
    </Badge>
  );
}
