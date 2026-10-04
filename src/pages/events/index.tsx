import { useState, useEffect } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Users,
} from "lucide-react";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUser } from "@/hooks/use-user";
import {
  eventStatus,
  formatDateRange,
  formatTime,
  todayISO,
} from "@/lib/format";
import { isFull, spotsLeft } from "@/lib/events";
import { isOrganizer, isVolunteer } from "@/lib/nav";
import { departmentLabel } from "@/lib/volunteers";

interface EventRecord {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string | null;
  forVolunteers: boolean;
  capacity: number | null;
  attendeeCount: number;
}

export default function EventsPage() {
  const user = useUser();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => (res.ok ? res.json() : []))
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  if (!user) return <AuthLoading />;

  // For a volunteer every event they can see is one that was opened to them,
  // so the badge would be on all of them — noise rather than information.
  const showAudience = !isVolunteer(user.accountType);
  const today = todayISO();
  const upcoming = events.filter((e) => e.endDate >= today);
  const past = events.filter((e) => e.endDate < today).reverse();

  return (
    <AppShell
      user={user}
      title="Events"
      description="Competitions, meetings and workshops."
      action={
        isOrganizer(user.roles) && (
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href="/dashboard?tab=events" />}
          >
            <Plus /> New
          </Button>
        )
      }
    >
      {/* A volunteer's landing page, so their badge is one tap from it. */}
      {!showAudience && (
        <Link
          href="/badge"
          className="mb-5 flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-all outline-none hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div className="shrink-0 rounded-md bg-white p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/volunteers/me/qr" alt="" className="size-10" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user.fullName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {departmentLabel(user.departments)} · Open my badge
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <Tabs defaultValue="upcoming" className="gap-5">
        <TabsList className="h-9 w-full sm:w-auto">
          <TabsTrigger value="upcoming" className="px-4">
            Upcoming
            <span className="text-muted-foreground tabular-nums">
              {upcoming.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="past" className="px-4">
            Past
            <span className="text-muted-foreground tabular-nums">
              {past.length}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {loading ? (
            <EventGridSkeleton />
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming events"
              description="Nothing on the calendar yet. Check back soon."
            />
          ) : (
            <EventGrid events={upcoming} showAudience={showAudience} />
          )}
        </TabsContent>

        <TabsContent value="past">
          {loading ? (
            <EventGridSkeleton />
          ) : past.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No past events"
              description="Events show up here once they have wrapped."
            />
          ) : (
            <EventGrid events={past} showAudience={showAudience} />
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function EventGrid({
  events,
  showAudience,
}: {
  events: EventRecord[];
  showAudience: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {events.map((event) => (
        <EventCard key={event.id} event={event} showAudience={showAudience} />
      ))}
    </div>
  );
}

function EventCard({
  event,
  showAudience,
}: {
  event: EventRecord;
  showAudience: boolean;
}) {
  const status = eventStatus(event.startDate, event.endDate);
  const start = parseISO(event.startDate);
  const multiDay = event.startDate !== event.endDate;
  const full = isFull(event.capacity, event.attendeeCount);
  const left = spotsLeft(event.capacity, event.attendeeCount);

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-all outline-none hover:ring-foreground/20 focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
    >
      <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg bg-muted text-center">
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
          {format(start, "MMM")}
        </span>
        <span className="font-heading text-lg leading-none font-semibold tabular-nums">
          {format(start, "d")}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-heading leading-snug font-medium text-pretty transition-colors group-hover:text-primary">
            {event.title}
          </h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {showAudience && event.forVolunteers && (
              <Badge variant="secondary">Volunteers</Badge>
            )}
            {full && status !== "past" && (
              <Badge variant="outline" className="text-muted-foreground">
                Full
              </Badge>
            )}
            <StatusBadge status={status} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {multiDay
              ? formatDateRange(event.startDate, event.endDate)
              : `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`}
          </span>
          {event.location && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              <span className="truncate">{event.location}</span>
            </span>
          )}
          {/* Only while there is still something to say about it. */}
          {left !== null && left > 0 && status !== "past" && (
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5 shrink-0" />
              <span className="tabular-nums">{left} left</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function EventGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <Skeleton className="size-12 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2 py-0.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
