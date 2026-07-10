"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Navbar } from "@/components/layout/navbar";
import { PageLayout } from "@/components/layout/page-layout";
import { Calendar, MapPin, Clock, ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

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

interface Attendee {
  id: number;
  userId: number;
  eventId: number;
  signedInAt: string;
  user: { fullName: string; username: string };
}

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return format(parseISO(startDate), "EEEE, MMMM d, yyyy");
  }
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
  }
  return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
}

export default function EventDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [user, setUser] = useState<User | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/");
      else res.json().then(setUser);
    });
  }, [router]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/events/${id}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/events/${id}/attendance`).then((r) => r.ok ? r.json() : []),
    ]).then(([evt, att]) => {
      setEvent(evt);
      setAttendees(att);
    }).finally(() => setLoading(false));
  }, [id]);

  if (!user || !id) return null;

  const isSignedIn = attendees.some((a) => a.userId === user.userId);
  const today = new Date().toISOString().slice(0, 10);
  const isPast = event && event.endDate < today;
  const isOngoing = event && event.startDate <= today && event.endDate >= today;

  const handleAttendance = async () => {
    setSigning(true);
    try {
      const res = await fetch(`/api/events/${id}/attendance`, {
        method: isSignedIn ? "DELETE" : "POST",
      });
      if (res.ok) {
        toast.success(isSignedIn ? "Signed out" : "Signed in!");
        const att = await fetch(`/api/events/${id}/attendance`).then((r) => r.json());
        setAttendees(att);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setSigning(false);
    }
  };

  return (
    <>
      <Navbar user={user} />
      <PageLayout>
        <Button variant="ghost" size="sm" onClick={() => router.push("/events")}>
          <ArrowLeft /> Back to events
        </Button>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !event ? (
          <p className="text-muted-foreground">Event not found.</p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <div>
                <div className="flex items-start gap-3">
                  <h1 className="text-2xl font-bold">{event.title}</h1>
                  {isPast && <Badge variant="secondary">Past</Badge>}
                  {isOngoing && <Badge>Ongoing</Badge>}
                </div>
                {event.description && (
                  <p className="text-muted-foreground mt-2">{event.description}</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{formatDateRange(event.startDate, event.endDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>{event.startTime.slice(0, 5)} - {event.endTime.slice(0, 5)}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{event.location}</span>
                  </div>
                )}
              </div>

              {!isPast && (
                <>
                  <Separator />
                  <Button
                    size="lg"
                    variant={isSignedIn ? "outline" : "default"}
                    onClick={handleAttendance}
                    disabled={signing}
                    className="w-full sm:w-auto"
                  >
                    {signing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isSignedIn ? (
                      <XCircle className="mr-2 h-4 w-4" />
                    ) : (
                      <CheckCircle className="mr-2 h-4 w-4" />
                    )}
                    {isSignedIn ? "Sign Out" : "Sign In"}
                  </Button>
                </>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Attendees ({attendees.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {attendees.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No one signed in yet.</p>
                ) : (
                  attendees.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-[10px]">
                          {a.user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm">
                        <p className="font-medium">{a.user.fullName}</p>
                        <p className="text-xs text-muted-foreground">
                          Signed in at {format(parseISO(a.signedInAt), "h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </PageLayout>
    </>
  );
}
