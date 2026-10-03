import type { ReactNode } from "react";

import { ListRow } from "@/components/section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
  The pieces of a leaderboard, shared by the team ranking and the volunteer
  ranking so the two read as one design.
*/

const MEDALS: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-600 ring-amber-500/25 dark:text-amber-400",
  2: "bg-zinc-400/15 text-zinc-600 ring-zinc-400/25 dark:text-zinc-300",
  3: "bg-orange-700/15 text-orange-700 ring-orange-700/25 dark:text-orange-400",
};

export function RankRow({
  rank,
  fullName,
  isYou,
  detail,
  score,
}: {
  /** Null for someone yet to score; shown as "–" and never medalled. */
  rank: number | null;
  fullName: string;
  isYou: boolean;
  /** Small line under the name, e.g. events and lab hours. */
  detail?: ReactNode;
  score: number;
}) {
  return (
    <ListRow className={cn("gap-3", isYou && "bg-primary/5")}>
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-1 ring-inset",
          (rank !== null && MEDALS[rank]) ??
            "bg-muted text-muted-foreground ring-transparent"
        )}
      >
        {rank ?? "–"}
      </span>

      <Avatar className="hidden size-8 sm:flex">
        <AvatarFallback className="bg-secondary text-[11px] font-medium text-foreground">
          {initialsOf(fullName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {fullName}
          {isYou && (
            <span className="ml-1.5 text-xs font-normal text-primary">you</span>
          )}
        </p>
        {detail && (
          <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
            {detail}
          </p>
        )}
      </div>

      <span className="shrink-0 font-heading text-base font-semibold tabular-nums">
        {score}
      </span>
    </ListRow>
  );
}

/** The signed-in person's own rank and score, above a ranking. */
export function StandingCard({
  rank,
  title,
  detail,
  score,
}: {
  rank: number | null;
  title: string;
  detail: ReactNode;
  score: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
        <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">
          Rank
        </span>
        <span className="font-heading text-xl leading-none font-semibold tabular-nums">
          {rank ?? "–"}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-2xl leading-none font-semibold tabular-nums">
          {score}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">points</p>
      </div>
    </div>
  );
}
