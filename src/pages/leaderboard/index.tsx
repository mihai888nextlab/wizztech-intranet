import { useState, useEffect } from "react";
import { CalendarDays, Timer, Trophy } from "lucide-react";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ListCard, ListRow } from "@/components/section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";
import { formatDuration, initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  fullName: string;
  role: string;
  eventsAttended: number;
  totalMinutes: number;
  score: number;
}

const MEDALS: Record<number, string> = {
  1: "bg-amber-400/15 text-amber-600 ring-amber-500/25 dark:text-amber-400",
  2: "bg-zinc-400/15 text-zinc-600 ring-zinc-400/25 dark:text-zinc-300",
  3: "bg-orange-700/15 text-orange-700 ring-orange-700/25 dark:text-orange-400",
};

export default function LeaderboardPage() {
  const user = useUser();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => (res.ok ? res.json() : []))
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  if (!user) return <AuthLoading />;

  const mine = entries.find((e) => e.userId === user.userId);

  return (
    <AppShell
      user={user}
      title="Leaderboard"
      description="Ranked by events attended and hours in the lab."
    >
      <div className="space-y-6">
        {mine && <YourStanding entry={mine} total={entries.length} />}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Nothing to rank yet"
            description="Scores appear once the team starts logging events and lab hours."
          />
        ) : (
          <ListCard>
            {entries.map((entry) => (
              <ListRow
                key={entry.userId}
                className={cn(
                  "gap-3",
                  entry.userId === user.userId && "bg-primary/5"
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ring-1 ring-inset",
                    MEDALS[entry.rank] ??
                      "bg-muted text-muted-foreground ring-transparent"
                  )}
                >
                  {entry.rank}
                </span>

                <Avatar className="hidden size-8 sm:flex">
                  <AvatarFallback className="bg-secondary text-[11px] font-medium text-foreground">
                    {initialsOf(entry.fullName)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {entry.fullName}
                    {entry.userId === user.userId && (
                      <span className="ml-1.5 text-xs font-normal text-primary">
                        you
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <CalendarDays className="size-3" />
                      {entry.eventsAttended}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Timer className="size-3" />
                      {formatDuration(entry.totalMinutes)}
                    </span>
                  </p>
                </div>

                <span className="shrink-0 font-heading text-base font-semibold tabular-nums">
                  {entry.score}
                </span>
              </ListRow>
            ))}
          </ListCard>
        )}
      </div>
    </AppShell>
  );
}

function YourStanding({
  entry,
  total,
}: {
  entry: LeaderboardEntry;
  total: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/10 text-primary">
        <span className="text-[10px] font-medium tracking-wide uppercase opacity-70">
          Rank
        </span>
        <span className="font-heading text-xl leading-none font-semibold tabular-nums">
          {entry.rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-medium">Your standing</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {entry.rank} of {total} · {entry.eventsAttended} event
          {entry.eventsAttended === 1 ? "" : "s"} ·{" "}
          {formatDuration(entry.totalMinutes)} in the lab
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-heading text-2xl leading-none font-semibold tabular-nums">
          {entry.score}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">points</p>
      </div>
    </div>
  );
}
