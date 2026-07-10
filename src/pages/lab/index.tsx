"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/layout/navbar";
import { PageLayout } from "@/components/layout/page-layout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, Play, Square, Plus, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface User {
  userId: number;
  fullName: string;
  username: string;
  role: string;
}

interface LabSession {
  id: number;
  userId: number;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  note: string | null;
}

export default function LabPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [activeSession, setActiveSession] = useState<LabSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [totalHours, setTotalHours] = useState(0);

  // Manual entry form
  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualStart, setManualStart] = useState("09:00");
  const [manualEnd, setManualEnd] = useState("17:00");
  const [manualNote, setManualNote] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/");
      else res.json().then(setUser);
    });
  }, [router]);

  const loadData = () => {
    Promise.all([
      fetch("/api/lab").then((r) => r.ok ? r.json() : []),
      fetch("/api/lab/active").then((r) => r.ok ? r.json() : { active: false, session: null }),
      fetch("/api/lab/hours").then((r) => r.ok ? r.json() : { totalMinutes: 0 }),
    ]).then(([sessions, active, hours]) => {
      setSessions(sessions);
      setActiveSession(active.session);
      setTotalHours(hours.totalMinutes);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    if (!activeSession) return;
    const interval = setInterval(() => {
      const diff = Date.now() - new Date(activeSession.checkIn).getTime();
      const h = Math.floor(diff / 3600000).toString().padStart(2, "0");
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, "0");
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession]);

  if (!user) return null;

  const handleToggle = async () => {
    setToggling(true);
    try {
      const action = activeSession ? "check_out" : "check_in";
      const res = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(activeSession ? "Checked out!" : "Checked in!");
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setToggling(false);
    }
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setManualLoading(true);
    try {
      const res = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual",
          checkIn: `${manualDate}T${manualStart}:00`,
          checkOut: `${manualDate}T${manualEnd}:00`,
          note: manualNote || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Lab session recorded!");
        setManualOpen(false);
        setManualNote("");
        loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setManualLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  return (
    <>
      <Navbar user={user} />
      <PageLayout title="Lab Hours" description="Track your time in the lab building the robot">
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {activeSession ? "Active Session" : "No Active Session"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeSession && (
                <div className="text-center py-4">
                  <div className="text-4xl font-mono font-bold tracking-wider tabular-nums">
                    {elapsed}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Since {format(parseISO(activeSession.checkIn), "h:mm a")}
                  </p>
                </div>
              )}
              <Button
                size="lg"
                variant={activeSession ? "destructive" : "default"}
                className="w-full"
                onClick={handleToggle}
                disabled={toggling}
              >
                {toggling ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : activeSession ? (
                  <Square className="mr-2 h-5 w-5" />
                ) : (
                  <Play className="mr-2 h-5 w-5" />
                )}
                {activeSession ? "Check Out" : "Check In"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Total Hours</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatDuration(totalHours)}</div>
              <p className="text-sm text-muted-foreground mt-1">
                Across {sessions.length} session{sessions.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogTrigger>
                <Button variant="outline">
                  <Plus /> Manual Entry
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Lab Session Manually</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="manualDate">Date</Label>
                  <Input id="manualDate" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="manualStart">Start Time</Label>
                    <Input id="manualStart" type="time" value={manualStart} onChange={(e) => setManualStart(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="manualEnd">End Time</Label>
                    <Input id="manualEnd" type="time" value={manualEnd} onChange={(e) => setManualEnd(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manualNote">Note (optional)</Label>
                  <Textarea id="manualNote" value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="What did you work on?" />
                </div>
                <Button type="submit" className="w-full" disabled={manualLoading}>
                  {manualLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Session
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No lab sessions recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>{format(parseISO(s.checkIn), "MMM d, yyyy")}</TableCell>
                      <TableCell>{format(parseISO(s.checkIn), "h:mm a")}</TableCell>
                      <TableCell>
                        {s.checkOut ? format(parseISO(s.checkOut), "h:mm a") : <Badge variant="outline">Active</Badge>}
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">
                        {s.durationMinutes ? formatDuration(s.durationMinutes) : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
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
