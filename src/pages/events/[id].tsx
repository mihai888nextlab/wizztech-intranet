import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";
import { CalendarDays, Check, Clock, MapPin, Share2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ShareDialog } from "@/components/share-dialog";
import { ListCard, ListRow, Section } from "@/components/section";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useUser } from "@/hooks/use-user";
import {
  eventStatus,
  formatDateRange,
  formatTime,
  initialsOf,
} from "@/lib/format";
import { isOrganizer } from "@/lib/nav";
import { eventShareText } from "@/lib/share";
import { cn } from "@/lib/utils";

interface EventRecord {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string | null;
}

interface Attendee {
  id: number;
  userId: number;
  signedInAt: string;
  user: { fullName: string; username: string };
}

export default function EventDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const user = useUser();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/events/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/events/${id}/attendance`).then((r) => (r.ok ? r.json() : [])),
    ])
      .then(([evt, att]) => {
        setEvent(evt);
        setAttendees(att);
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (!user) return <AuthLoading />;

  const isSignedIn = attendees.some((a) => a.userId === user.userId);
  const status = event
    ? eventStatus(event.startDate, event.endDate)
    : "upcoming";

  const handleAttendance = async () => {
    setSigning(true);
    try {
      const res = await fetch(`/api/events/${id}/attendance`, {
        method: isSignedIn ? "DELETE" : "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not update attendance");
        return;
      }
      toast.success(isSignedIn ? "Signed out" : "You're signed in");
      setAttendees(
        await fetch(`/api/events/${id}/attendance`).then((r) => r.json())
      );
    } catch {
      toast.error("Connection error");
    } finally {
      setSigning(false);
    }
  };

  return (
    <AppShell user={user} back={{ href: "/events", label: "Events" }}>
      {loading ? (
        <DetailSkeleton />
      ) : !event ? (
        <EmptyState
          icon={CalendarDays}
          title="Event not found"
          description="It may have been deleted."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={status} />
                {isOrganizer(user.role) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() =>
                      setSharing(
                        eventShareText(
                          {
                            title: event.title,
                            description: event.description,
                            dateLabel: formatDateRange(
                              event.startDate,
                              event.endDate,
                              { long: true }
                            ),
                            timeLabel: `${formatTime(event.startTime)} – ${formatTime(event.endTime)}`,
                            location: event.location,
                          },
                          `${window.location.origin}/events/${event.id}`
                        )
                      )
                    }
                  >
                    <Share2 /> Share
                  </Button>
                )}
              </div>
              <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
                {event.title}
              </h1>
              {event.description && (
                <p className="text-[15px]/relaxed text-pretty text-muted-foreground">
                  {event.description}
                </p>
              )}
            </div>

            <dl className="grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-foreground/10 sm:grid-cols-2">
              <DetailItem
                icon={CalendarDays}
                label="Date"
                value={formatDateRange(event.startDate, event.endDate, {
                  long: true,
                })}
              />
              <DetailItem
                icon={Clock}
                label="Time"
                value={`${formatTime(event.startTime)} – ${formatTime(event.endTime)}`}
              />
              {event.location && (
                <DetailItem
                  icon={MapPin}
                  label="Location"
                  value={event.location}
                  className="sm:col-span-2"
                />
              )}
            </dl>

            {status !== "past" && (
              <div className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-0.5">
                  <p className="font-heading text-sm font-medium">
                    {isSignedIn ? "You're on the list" : "Attending?"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isSignedIn
                      ? "Your attendance counts toward the leaderboard."
                      : "Sign in so your attendance gets recorded."}
                  </p>
                </div>
                <Button
                  size="lg"
                  variant={isSignedIn ? "outline" : "default"}
                  className="h-11 shrink-0 rounded-xl sm:w-auto"
                  onClick={handleAttendance}
                  disabled={signing}
                >
                  {signing ? <Spinner /> : isSignedIn ? <X /> : <Check />}
                  {isSignedIn ? "Sign out" : "Sign in"}
                </Button>
              </div>
            )}
          </div>

          <Section title="Attendees" count={attendees.length}>
            {attendees.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No one yet"
                description="Be the first to sign in."
                className="py-8"
              />
            ) : (
              <ListCard>
                {attendees.map((a) => (
                  <ListRow key={a.id}>
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-secondary text-[11px] font-medium text-foreground">
                        {initialsOf(a.user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.user.fullName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{a.user.username}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {format(parseISO(a.signedInAt), "HH:mm")}
                    </span>
                  </ListRow>
                ))}
              </ListCard>
            )}
          </Section>
        </div>
      )}
      <ShareDialog
        text={sharing}
        title="Share this event"
        onOpenChange={(open) => !open && setSharing(null)}
      />
    </AppShell>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("bg-card px-4 py-3", className)}>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">{value}</dd>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}
