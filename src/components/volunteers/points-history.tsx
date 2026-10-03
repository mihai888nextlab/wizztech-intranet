import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarDays, Medal, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { ListCard, ListRow } from "@/components/section";
import { Button } from "@/components/ui/button";
import { departmentLabel } from "@/lib/volunteers";
import { cn } from "@/lib/utils";

export interface PointsAward {
  id: number;
  amount: number;
  reason: string;
  /** Which department board these points landed on. */
  department: string;
  createdAt: string;
  event: { id: number; title: string } | null;
  /** Only sent to managers. */
  awardedBy?: string | null;
}

/** A volunteer's awards, newest first. Managers get a delete button per row. */
export function PointsHistory({
  awards,
  onDelete,
  emptyDescription,
}: {
  awards: PointsAward[];
  onDelete?: (award: PointsAward) => void;
  emptyDescription: string;
}) {
  if (awards.length === 0) {
    return (
      <EmptyState
        icon={Medal}
        title="No points yet"
        description={emptyDescription}
        className="py-8"
      />
    );
  }

  return (
    <ListCard>
      {awards.map((award) => (
        <ListRow key={award.id}>
          <span
            className={cn(
              "flex h-8 min-w-12 shrink-0 items-center justify-center rounded-lg px-2 font-heading text-sm font-semibold tabular-nums",
              award.amount > 0
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {award.amount > 0 ? `+${award.amount}` : award.amount}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{award.reason}</p>
            <p className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
              <span className="shrink-0 tabular-nums">
                {format(parseISO(award.createdAt), "d MMM yyyy")}
              </span>
              <span className="shrink-0">{departmentLabel([award.department])}</span>
              {award.event && (
                <Link
                  href={`/events/${award.event.id}`}
                  className="inline-flex min-w-0 items-center gap-1 hover:text-foreground"
                >
                  <CalendarDays className="size-3 shrink-0" />
                  <span className="truncate">{award.event.title}</span>
                </Link>
              )}
              {award.awardedBy && (
                <span className="hidden truncate sm:inline">
                  by {award.awardedBy}
                </span>
              )}
            </p>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label="Remove these points"
              onClick={() => onDelete(award)}
            >
              <Trash2 />
            </Button>
          )}
        </ListRow>
      ))}
    </ListCard>
  );
}
