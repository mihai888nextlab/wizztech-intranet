import { Badge } from "@/components/ui/badge";
import type { EventStatus } from "@/lib/format";

/** Ongoing events get a live dot; upcoming ones stay unbadged to reduce noise. */
export function StatusBadge({ status }: { status: EventStatus }) {
  if (status === "ongoing") {
    return (
      <Badge className="shrink-0 gap-1.5 bg-success/12 text-success">
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
        Live
      </Badge>
    );
  }
  if (status === "past") {
    return (
      <Badge variant="secondary" className="shrink-0 text-muted-foreground">
        Past
      </Badge>
    );
  }
  return null;
}
