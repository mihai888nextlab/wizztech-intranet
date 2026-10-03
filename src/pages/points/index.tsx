import { useEffect, useState } from "react";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { StandingCard } from "@/components/ranking";
import { Section } from "@/components/section";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PointsHistory,
  type PointsAward,
} from "@/components/volunteers/points-history";
import { useUser } from "@/hooks/use-user";
import { isVolunteer } from "@/lib/roles";

interface MyPoints {
  points: number;
  rank: number | null;
  total: number;
  history: PointsAward[];
}

export default function PointsPage() {
  const user = useUser((u) => isVolunteer(u.accountType));
  const [data, setData] = useState<MyPoints | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch("/api/volunteers/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setData);
  }, [user]);

  if (!user) return <AuthLoading />;

  return (
    <AppShell
      user={user}
      title="My points"
      description="Points you've earned volunteering with the team."
    >
      {!data ? (
        <div className="space-y-6">
          <Skeleton className="h-22 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <StandingCard
            rank={data.rank}
            title="Your total"
            score={data.points}
            detail={
              data.rank
                ? `${data.rank} of ${data.total} volunteers`
                : "Not ranked yet"
            }
          />
          <Section title="History" count={data.history.length}>
            <PointsHistory
              awards={data.history}
              emptyDescription="Points a volunteer manager gives you will show up here."
            />
          </Section>
        </div>
      )}
    </AppShell>
  );
}
