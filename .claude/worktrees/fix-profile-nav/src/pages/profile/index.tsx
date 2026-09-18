import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTheme } from "next-themes";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  ChevronRight,
  HandHeart,
  LogOut,
  Moon,
  Sun,
  Timer,
} from "lucide-react";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/empty-state";
import { NotificationsCard } from "@/components/notifications-card";
import { StandingCard } from "@/components/ranking";
import { ListCard, ListRow } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsClient } from "@/hooks/use-is-client";
import { useUser, type SessionUser } from "@/hooks/use-user";
import { formatDateRange, formatDuration, initialsOf } from "@/lib/format";
import { canManageVolunteers, isVolunteer } from "@/lib/roles";
import { cn } from "@/lib/utils";

interface AttendedEvent {
  id: number;
  signedInAt: string;
  event: {
    id: number;
    title: string;
    startDate: string;
    endDate: string;
  };
}

interface LabSession {
  id: number;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  note: string | null;
}

interface MyPoints {
  points: number;
  rank: number | null;
  total: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const user = useUser();

  if (!user) return <AuthLoading />;

  const volunteer = isVolunteer(user.role);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <ProfileHeader user={user} />

        {/* Volunteers can't reach the lab, attendance or push APIs; they get their points instead. */}
        {volunteer ? <VolunteerPanels /> : <TeamPanels />}

        {/* The way to Volunteers on a phone — it isn't in the tab bar. */}
        {canManageVolunteers(user.role, user.isVolunteerManager) && (
          <ListCard>
            <li>
              <Link
                href="/volunteers"
                className="flex items-center gap-3 px-4 py-3 transition-colors outline-none hover:bg-secondary/60 focus-visible:bg-secondary/60"
              >
                <HandHeart className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">Volunteers</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Manage volunteers and give them points.
                  </p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          </ListCard>
        )}

        {!volunteer && <NotificationsCard />}

        <AppearanceCard />

        <Button
          variant="outline"
          className="h-10 w-full rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut /> Log out
        </Button>
      </div>
    </AppShell>
  );
}

function ProfileHeader({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        <AvatarFallback className="bg-secondary font-heading text-lg font-semibold text-foreground">
          {initialsOf(user.fullName)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-heading text-xl font-semibold tracking-tight">
          {user.fullName}
        </h1>
        <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">@{user.username}</span>
          <Badge variant="outline" className="shrink-0 capitalize">
            {user.role}
          </Badge>
        </p>
      </div>
    </div>
  );
}

/** A volunteer's standing, linking through to the full points history. */
function VolunteerPanels() {
  const [data, setData] = useState<MyPoints | null>(null);

  useEffect(() => {
    fetch("/api/volunteers/me")
      .then((res) => (res.ok ? res.json() : null))
      .then(setData);
  }, []);

  if (!data) return <Skeleton className="h-22 w-full rounded-xl" />;

  return (
    <Link
      href="/points"
      className="block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <StandingCard
        rank={data.rank}
        title="Your points"
        score={data.points}
        detail={
          data.rank
            ? `${data.rank} of ${data.total} volunteers`
            : "Not ranked yet"
        }
      />
    </Link>
  );
}

function TeamPanels() {
  const [events, setEvents] = useState<AttendedEvent[]>([]);
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [hours, setHours] = useState({ totalMinutes: 0, totalSessions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/lab").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/lab/hours").then((r) =>
        r.ok ? r.json() : { totalMinutes: 0, totalSessions: 0 }
      ),
      fetch("/api/attendance/mine").then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([lab, hrs, att]) => {
        setSessions(lab);
        setHours(hrs);
        setEvents(att);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          label="Events"
          value={events.length}
          icon={CalendarDays}
        />
        <StatCard
          label="Lab hours"
          value={formatDuration(hours.totalMinutes)}
          icon={Timer}
        />
        <StatCard
          label="Sessions"
          value={hours.totalSessions}
          className="col-span-2 sm:col-span-1"
        />
      </div>

      <Tabs defaultValue="events" className="gap-4">
        <TabsList className="h-9 w-full sm:w-auto">
          <TabsTrigger value="events" className="px-4">
            Events
          </TabsTrigger>
          <TabsTrigger value="lab" className="px-4">
            Lab sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events">
          {loading ? (
            <HistorySkeleton />
          ) : events.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No events yet"
              description="Sign in at an event and it will show up here."
            />
          ) : (
            <ListCard>
              {events.map((a) => (
                <ListRow key={a.id}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {a.event.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateRange(a.event.startDate, a.event.endDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {format(parseISO(a.signedInAt), "HH:mm")}
                  </span>
                </ListRow>
              ))}
            </ListCard>
          )}
        </TabsContent>

        <TabsContent value="lab">
          {loading ? (
            <HistorySkeleton />
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={Timer}
              title="No lab sessions yet"
              description="Start the timer on the Lab Hours page."
            />
          ) : (
            <ListCard>
              {sessions.slice(0, 25).map((s) => (
                <ListRow key={s.id}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {format(parseISO(s.checkIn), "EEE, MMM d")}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.note || format(parseISO(s.checkIn), "HH:mm")}
                    </p>
                  </div>
                  <span className="shrink-0 font-heading text-sm font-medium tabular-nums">
                    {s.durationMinutes !== null
                      ? formatDuration(s.durationMinutes)
                      : "—"}
                  </span>
                </ListRow>
              ))}
            </ListCard>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  const mounted = useIsClient();

  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ] as const;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <div>
        <p className="font-heading text-sm font-medium">Appearance</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Applies to this device.
        </p>
      </div>
      <div
        className="flex shrink-0 gap-0.5 rounded-lg bg-muted p-[3px]"
        role="group"
        aria-label="Theme"
      >
        {options.map((option) => {
          const selected = mounted && theme === option.value;
          const Icon = option.icon;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => setTheme(option.value)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}
