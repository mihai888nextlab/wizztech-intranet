import { useState, useEffect, useCallback, FormEvent } from "react";
import { format, parseISO, startOfWeek } from "date-fns";
import { CalendarPlus, Play, Square, Timer } from "lucide-react";
import { toast } from "sonner";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ListCard, ListRow, Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/use-user";
import { formatDuration, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LabSession {
  id: number;
  userId: number;
  checkIn: string;
  checkOut: string | null;
  durationMinutes: number | null;
  note: string | null;
}

function elapsedSince(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default function LabPage() {
  const user = useUser();
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [active, setActive] = useState<LabSession | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");
  const [timedSessionId, setTimedSessionId] = useState<number | null>(null);

  const loadData = useCallback(() => {
    return Promise.all([
      fetch("/api/lab").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/lab/active").then((r) =>
        r.ok ? r.json() : { session: null }
      ),
      fetch("/api/lab/hours").then((r) => (r.ok ? r.json() : { totalMinutes: 0 })),
    ])
      .then(([list, activeRes, hours]) => {
        setSessions(list);
        setActive(activeRes.session);
        setTotalMinutes(Number(hours.totalMinutes) || 0);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(
      () => setElapsed(elapsedSince(active.checkIn)),
      1000
    );
    return () => clearInterval(interval);
  }, [active]);

  // Show the right time on the first frame instead of waiting a full tick.
  if (active && active.id !== timedSessionId) {
    setTimedSessionId(active.id);
    setElapsed(elapsedSince(active.checkIn));
  }

  if (!user) return <AuthLoading />;

  const handleToggle = async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: active ? "check_out" : "check_in" }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not update the timer");
        return;
      }
      toast.success(active ? "Checked out" : "Timer started");
      await loadData();
    } catch {
      toast.error("Connection error");
    } finally {
      setToggling(false);
    }
  };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekMinutes = sessions
    .filter((s) => new Date(s.checkIn) >= weekStart)
    .reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  return (
    <AppShell
      user={user}
      title="Lab Hours"
      description="Track the time you spend building."
      action={<ManualEntryDialog onSaved={loadData} />}
    >
      <div className="space-y-6">
        <TimerCard
          active={active}
          elapsed={elapsed}
          toggling={toggling}
          onToggle={handleToggle}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="All time" value={formatDuration(totalMinutes)} />
          <StatCard label="This week" value={formatDuration(weekMinutes)} />
          <StatCard
            label="Sessions"
            value={sessions.length}
            className="col-span-2 sm:col-span-1"
          />
        </div>

        <Section title="History" count={loading ? undefined : sessions.length}>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <EmptyState
              icon={Timer}
              title="No sessions yet"
              description="Check in when you arrive at the lab, or add a past session manually."
            />
          ) : (
            <ListCard>
              {sessions.map((s) => (
                <ListRow key={s.id} className="gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {format(parseISO(s.checkIn), "EEE, MMM d")}
                      </p>
                      {!s.checkOut && (
                        <Badge className="gap-1.5 bg-success/12 text-success">
                          <span
                            className="size-1.5 rounded-full bg-current"
                            aria-hidden="true"
                          />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {format(parseISO(s.checkIn), "HH:mm")} –{" "}
                      {s.checkOut ? format(parseISO(s.checkOut), "HH:mm") : "now"}
                      {s.note && ` · ${s.note}`}
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
        </Section>
      </div>
    </AppShell>
  );
}

function TimerCard({
  active,
  elapsed,
  toggling,
  onToggle,
}: {
  active: LabSession | null;
  elapsed: string;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-6 text-center ring-1 transition-colors sm:p-8",
        active
          ? "bg-primary/6 ring-primary/25"
          : "bg-card ring-foreground/10"
      )}
    >
      <p className="inline-flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {active && (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
        )}
        {active ? "Checked in" : "Lab timer"}
      </p>

      <p
        className={cn(
          "mt-4 font-heading font-semibold tracking-tight tabular-nums",
          active
            ? "text-5xl text-foreground sm:text-6xl"
            : "text-4xl text-muted-foreground/50 sm:text-5xl"
        )}
      >
        {active ? elapsed : "00:00:00"}
      </p>

      <p className="mt-2 text-sm text-muted-foreground">
        {active
          ? `Since ${format(parseISO(active.checkIn), "HH:mm")}`
          : "Start the clock when you get to the lab"}
      </p>

      <Button
        size="lg"
        variant={active ? "outline" : "default"}
        className="mt-6 h-12 w-full rounded-xl text-[15px] sm:w-56"
        onClick={onToggle}
        disabled={toggling}
      >
        {toggling ? <Spinner /> : active ? <Square /> : <Play />}
        {active ? "Check out" : "Check in"}
      </Button>
    </div>
  );
}

function ManualEntryDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manual",
          checkIn: `${date}T${start}:00`,
          checkOut: `${date}T${end}:00`,
          note: note || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not save the session");
        return;
      }
      toast.success("Session recorded");
      setOpen(false);
      setNote("");
      onSaved();
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <CalendarPlus /> Add
      </DialogTrigger>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>Add a past session</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              className="h-10"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="time"
                className="h-10"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="time"
                className="h-10"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="What did you work on?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="h-10 w-full rounded-xl"
            disabled={saving}
          >
            {saving && <Spinner />}
            Save session
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
