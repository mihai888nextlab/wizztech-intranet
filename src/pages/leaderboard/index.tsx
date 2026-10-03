import { useState, useEffect } from "react";
import { CalendarDays, HandHeart, Timer, Trophy } from "lucide-react";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/empty-state";
import { RankRow, StandingCard } from "@/components/ranking";
import { ListCard } from "@/components/section";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/use-user";
import { formatDuration } from "@/lib/format";
import { isVolunteer } from "@/lib/roles";
import {
  DEPARTMENT_LABELS,
  OVERALL_BOARD,
  VOLUNTEER_DEPARTMENTS,
  type LeaderboardBoard,
} from "@/lib/volunteers";

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

interface VolunteerEntry {
  rank: number;
  userId: number;
  fullName: string;
  points: number;
}

export default function LeaderboardPage() {
  const user = useUser();

  if (!user) return <AuthLoading />;

  // Volunteers only ever see their own ranking; the team's isn't theirs to see.
  if (isVolunteer(user.accountType)) {
    return (
      <AppShell
        user={user}
        title="Leaderboard"
        description="Volunteers ranked by points, overall and by department."
      >
        <VolunteerBoard userId={user.userId} />
      </AppShell>
    );
  }

  return (
    <AppShell
      user={user}
      title="Leaderboard"
      description="Ranked by events attended and hours in the lab."
    >
      <Tabs defaultValue="team" className="gap-5">
        <TabsList className="h-9 w-full sm:w-auto">
          <TabsTrigger value="team" className="px-4">
            Team
          </TabsTrigger>
          <TabsTrigger value="volunteers" className="px-4">
            Volunteers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="team">
          <TeamBoard userId={user.userId} />
        </TabsContent>
        <TabsContent value="volunteers">
          <VolunteerBoard userId={user.userId} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function TeamBoard({ userId }: { userId: number }) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((res) => (res.ok ? res.json() : []))
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const mine = entries.find((e) => e.userId === userId);

  return (
    <div className="space-y-6">
      {mine && (
        <StandingCard
          rank={mine.rank}
          title="Your standing"
          score={mine.score}
          detail={
            <>
              {mine.rank} of {entries.length} · {mine.eventsAttended} event
              {mine.eventsAttended === 1 ? "" : "s"} ·{" "}
              {formatDuration(mine.totalMinutes)} in the lab
            </>
          }
        />
      )}

      {loading ? (
        <ListSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Nothing to rank yet"
          description="Scores appear once the team starts logging events and lab hours."
        />
      ) : (
        <ListCard>
          {entries.map((entry) => (
            <RankRow
              key={entry.userId}
              rank={entry.rank}
              fullName={entry.fullName}
              isYou={entry.userId === userId}
              score={entry.score}
              detail={
                <>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <CalendarDays className="size-3" />
                    {entry.eventsAttended}
                  </span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Timer className="size-3" />
                    {formatDuration(entry.totalMinutes)}
                  </span>
                </>
              }
            />
          ))}
        </ListCard>
      )}
    </div>
  );
}

/**
 * Five boards: everyone's total, then one per department counting only the
 * points earned in it. Each is fetched when its tab is first opened rather
 * than all five up front.
 */
function VolunteerBoard({ userId }: { userId: number }) {
  const [board, setBoard] = useState<LeaderboardBoard>(OVERALL_BOARD);

  return (
    <Tabs
      value={board}
      onValueChange={(value) => value && setBoard(value as LeaderboardBoard)}
      className="gap-5"
    >
      {/* Five tabs don't fit a phone, so the strip scrolls rather than wraps. */}
      <TabsList className="h-9 w-full justify-start overflow-x-auto">
        <TabsTrigger value={OVERALL_BOARD} className="shrink-0 px-4">
          Overall
        </TabsTrigger>
        {VOLUNTEER_DEPARTMENTS.map((department) => (
          <TabsTrigger key={department} value={department} className="shrink-0 px-4">
            {DEPARTMENT_LABELS[department]}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value={OVERALL_BOARD}>
        <DepartmentBoard board={OVERALL_BOARD} userId={userId} />
      </TabsContent>
      {VOLUNTEER_DEPARTMENTS.map((department) => (
        <TabsContent key={department} value={department}>
          <DepartmentBoard board={department} userId={userId} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function DepartmentBoard({
  board,
  userId,
}: {
  board: LeaderboardBoard;
  userId: number;
}) {
  const [entries, setEntries] = useState<VolunteerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Each tab renders its own DepartmentBoard, so `board` never changes for a
  // given instance and `loading` can simply start true — no need to reset it.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/volunteers/leaderboard?board=${board}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [board]);

  const mine = entries.find((e) => e.userId === userId);
  const label = board === OVERALL_BOARD ? "" : ` in ${DEPARTMENT_LABELS[board]}`;

  return (
    <div className="space-y-6">
      {mine && (
        <StandingCard
          rank={mine.rank}
          title={board === OVERALL_BOARD ? "Your standing" : `Your ${DEPARTMENT_LABELS[board]} standing`}
          score={mine.points}
          detail={
            mine.rank === null
              ? `No points yet${label}`
              : `${mine.rank} of ${entries.length} volunteers${label}`
          }
        />
      )}

      {loading ? (
        <ListSkeleton />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={HandHeart}
          title={
            board === OVERALL_BOARD
              ? "No volunteers yet"
              : `Nobody in ${DEPARTMENT_LABELS[board]} yet`
          }
          description={
            board === OVERALL_BOARD
              ? "Volunteers appear here once a volunteer manager adds them."
              : "Volunteers show up here once they join this department or earn points in it."
          }
        />
      ) : (
        <ListCard>
          {entries.map((entry) => (
            <RankRow
              key={entry.userId}
              rank={entry.rank}
              fullName={entry.fullName}
              isYou={entry.userId === userId}
              score={entry.points}
            />
          ))}
        </ListCard>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
