"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { PageLayout } from "@/components/layout/page-layout";
import { Calendar, MapPin, Clock, Plus, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";

interface User {
  userId: number;
  fullName: string;
  username: string;
  role: string;
}

interface Event {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string | null;
  createdBy: number;
  createdAt: string;
}

export default function EventsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/");
      else res.json().then(setUser);
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/events").then((res) => {
      if (res.ok) res.json().then(setEvents);
    }).finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = events.filter((e) => e.endDate >= today);
  const past = events.filter((e) => e.endDate < today);

  const canCreate = user.role === "admin" || user.role === "organizer";

  return (
    <>
      <Navbar user={user} />
      <PageLayout title="Events" description="Upcoming team events and activities">
        <div className="flex justify-end">
          {canCreate && (
            <Button onClick={() => router.push("/dashboard?tab=events")}>
              <Plus /> New Event
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-lg font-semibold mb-3">Upcoming</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming events.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {upcoming.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Past Events</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </PageLayout>
    </>
  );
}

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return format(parseISO(startDate), "EEE, MMM d, yyyy");
  }
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
}

function EventCard({ event }: { event: Event }) {
  const today = new Date().toISOString().slice(0, 10);
  const isOngoing = event.startDate <= today && event.endDate >= today;
  const isPast = event.endDate < today;

  return (
    <Link href={`/events/${event.id}`}>
      <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{event.title}</CardTitle>
            {isOngoing && <Badge variant="default">Ongoing</Badge>}
            {isPast && <Badge variant="secondary">Past</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatDateRange(event.startDate, event.endDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>{event.startTime.slice(0, 5)} - {event.endTime.slice(0, 5)}</span>
          </div>
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              <span>{event.location}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
