"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Navbar } from "@/components/layout/navbar";
import { PageLayout } from "@/components/layout/page-layout";
import { Calendar, Clock, Loader2 } from "lucide-react";
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
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
}

interface AttendRecord {
  id: number;
  eventId: number;
  signedInAt: string;
  event: Event;
}

interface LabSession {
  id: number;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  note: string | null;
}

interface HoursSummary {
  totalMinutes: number;
  totalSessions: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [attendedEvents, setAttendedEvents] = useState<AttendRecord[]>([]);
  const [labSessions, setLabSessions] = useState<LabSession[]>([]);
  const [hours, setHours] = useState<HoursSummary>({ totalMinutes: 0, totalSessions: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/");
      else res.json().then(setUser);
    });
  }, [router]);

  useEffect(() => {
    Promise.all([
      fetch("/api/lab").then((r) => r.ok ? r.json() : []),
      fetch("/api/lab/hours").then((r) => r.ok ? r.json() : { totalMinutes: 0, totalSessions: 0 }),
      fetch("/api/attendance/mine").then((r) => r.ok ? r.json() : []),
    ]).then(([lab, hrs, att]) => {
      setLabSessions(lab);
      setHours(hrs);
      setAttendedEvents(att);
    }).finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <>
      <Navbar user={user} />
      <PageLayout title="Profile">
        <div className="grid gap-6 md:grid-cols-4">
          <Card className="md:col-span-1">
            <CardContent className="pt-6 text-center space-y-3">
              <Avatar className="h-20 w-20 mx-auto">
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-lg font-bold">{user.fullName}</h2>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
              <Badge variant="outline" className="capitalize">{user.role}</Badge>
            </CardContent>
          </Card>

          <div className="md:col-span-3 grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attendedEvents.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Lab Hours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(hours.totalMinutes)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{hours.totalSessions}</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {attendedEvents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Events Attended</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Signed In</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendedEvents.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.event.title}</TableCell>
                      <TableCell>{a.event.startDate === a.event.endDate ? format(parseISO(a.event.startDate), "MMM d, yyyy") : `${format(parseISO(a.event.startDate), "MMM d")} - ${format(parseISO(a.event.endDate), "MMM d, yyyy")}`}</TableCell>
                      <TableCell>{format(parseISO(a.signedInAt), "h:mm a")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lab Session History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : labSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No lab sessions yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labSessions.slice(0, 20).map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{format(parseISO(s.checkIn), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {s.durationMinutes ? formatDuration(s.durationMinutes) : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate">
                        {s.note || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    </>
  );
}
