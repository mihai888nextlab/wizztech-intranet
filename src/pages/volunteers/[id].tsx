import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import { format, parseISO } from "date-fns";
import { HandHeart, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  PointsHistory,
  type PointsAward,
} from "@/components/volunteers/points-history";
import { BadgeCard } from "@/components/volunteers/badge-card";
import { DepartmentCheckboxes } from "@/components/volunteers/department-checkboxes";
import { useUser } from "@/hooks/use-user";
import { formatDateRange } from "@/lib/format";
import { canManageVolunteers } from "@/lib/roles";
import {
  DEFAULT_PIN,
  departmentLabel,
  MAX_REASON_LENGTH,
  type VolunteerDepartment,
} from "@/lib/volunteers";

interface VolunteerDetail {
  userId: number;
  username: string;
  fullName: string;
  departments: string[];
  /** Still on the PIN a coordinator chose for them. */
  mustChangePin: boolean;
  createdAt: string;
  points: number;
  history: PointsAward[];
}

interface EventOption {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
}

/** Select needs a non-empty value for "nothing chosen". */
const NO_EVENT = "none";

export default function VolunteerDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const user = useUser();
  const [volunteer, setVolunteer] = useState<VolunteerDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [awarding, setAwarding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deletingVolunteer, setDeletingVolunteer] = useState(false);
  const [deletingAward, setDeletingAward] = useState<PointsAward | null>(null);
  const allowed = user
    ? canManageVolunteers(user.roles)
    : false;

  const load = useCallback(
    () =>
      fetch(`/api/volunteers/${id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: VolunteerDetail | null) => {
          setVolunteer(data);
          setNotFound(data === null);
        }),
    [id]
  );

  useEffect(() => {
    if (!user || !id) return;
    if (!allowed) {
      router.replace("/events");
      return;
    }
    fetch(`/api/volunteers/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: VolunteerDetail | null) => {
        setVolunteer(data);
        setNotFound(data === null);
      });
    fetch("/api/events")
      .then((res) => (res.ok ? res.json() : []))
      .then(setEvents);
  }, [user, id, allowed, router, load]);

  if (!user || !allowed) return <AuthLoading />;

  const deleteAward = async () => {
    if (!deletingAward) return;
    const res = await fetch(`/api/volunteer-points/${deletingAward.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("Could not remove those points");
      throw new Error("delete failed");
    }
    toast.success("Points removed");
    setDeletingAward(null);
    await load();
  };

  const deleteVolunteer = async () => {
    const res = await fetch(`/api/volunteers/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove that volunteer");
      throw new Error("delete failed");
    }
    toast.success("Volunteer removed");
    router.replace("/volunteers");
  };

  return (
    <AppShell
      user={user}
      back={{ href: "/volunteers", label: "Volunteers" }}
      title={volunteer?.fullName}
      description={
        volunteer &&
        `@${volunteer.username} · ${departmentLabel(volunteer.departments)} · since ${format(parseISO(volunteer.createdAt), "MMM d, yyyy")}`
      }
      action={
        volunteer && (
          <div className="flex items-center gap-1">
            <Button size="lg" onClick={() => setAwarding(true)}>
              <Plus /> <span className="hidden sm:inline">Give points</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground"
                    aria-label="Volunteer actions"
                  />
                }
              >
                <MoreHorizontal />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDeletingVolunteer(true)}
                >
                  <Trash2 /> Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      }
    >
      {notFound ? (
        <EmptyState
          icon={HandHeart}
          title="Volunteer not found"
          description="They may have been removed."
        />
      ) : !volunteer ? (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* The same badge the volunteer sees, so a coordinator can print the
              crew's badges ahead of an event. */}
          <BadgeCard
            fullName={volunteer.fullName}
            username={volunteer.username}
            departments={volunteer.departments}
            points={volunteer.points}
            qrSrc={`/api/volunteers/${volunteer.userId}/qr`}
          />
          {volunteer.mustChangePin && (
            <p className="text-xs text-muted-foreground">
              They&apos;re still on the PIN {DEFAULT_PIN} and will be asked to
              choose their own the next time they sign in.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Points" value={volunteer.points} />
            <StatCard label="Awards" value={volunteer.history.length} />
          </div>
          <Section title="History" count={volunteer.history.length}>
            <PointsHistory
              awards={volunteer.history}
              onDelete={setDeletingAward}
              emptyDescription="Use Give points to record their first contribution."
            />
          </Section>
        </div>
      )}

      {volunteer && (
        <>
          <GivePointsDialog
            open={awarding}
            onOpenChange={setAwarding}
            volunteer={volunteer}
            events={events}
            onAwarded={load}
          />
          <EditVolunteerDialog
            open={editing}
            onOpenChange={setEditing}
            volunteer={volunteer}
            onSaved={load}
          />
        </>
      )}
      <ConfirmDialog
        open={deletingAward !== null}
        onOpenChange={(open) => !open && setDeletingAward(null)}
        title="Remove these points?"
        description={
          deletingAward
            ? `${deletingAward.amount > 0 ? "+" : ""}${deletingAward.amount} for "${deletingAward.reason}" will come off their total.`
            : undefined
        }
        confirmLabel="Remove"
        onConfirm={deleteAward}
      />
      <ConfirmDialog
        open={deletingVolunteer}
        onOpenChange={setDeletingVolunteer}
        title={`Remove ${volunteer?.fullName ?? "this volunteer"}?`}
        description="Their login, points and event attendance are deleted. This can't be undone."
        confirmLabel="Remove"
        onConfirm={deleteVolunteer}
      />
    </AppShell>
  );
}

function GivePointsDialog({
  open,
  onOpenChange,
  volunteer,
  events,
  onAwarded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteer: VolunteerDetail;
  events: EventOption[];
  onAwarded: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [eventId, setEventId] = useState(NO_EVENT);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/volunteers/${volunteer.userId}/points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          reason,
          eventId: eventId === NO_EVENT ? null : eventId,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not give those points");
        return;
      }
      toast.success(`Points given to ${volunteer.fullName}`);
      onOpenChange(false);
      setAmount("");
      setReason("");
      setEventId(NO_EVENT);
      await onAwarded();
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const eventLabel = (value: unknown) => {
    const event = events.find((ev) => String(ev.id) === value);
    return event ? event.title : "No event";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>Give points to {volunteer.fullName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="awardAmount">Points</Label>
            <Input
              id="awardAmount"
              className="h-10 tabular-nums"
              type="number"
              step={1}
              inputMode="numeric"
              placeholder="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Use a negative number to correct a mistake.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="awardReason">Reason</Label>
            <Input
              id="awardReason"
              className="h-10"
              placeholder="Helped set up the pit"
              maxLength={MAX_REASON_LENGTH}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="awardEvent">Event (optional)</Label>
            <Select
              value={eventId}
              onValueChange={(v) => setEventId((v as string) || NO_EVENT)}
            >
              <SelectTrigger id="awardEvent" className="h-10 w-full">
                <SelectValue>{eventLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_EVENT}>No event</SelectItem>
                {events.map((ev) => (
                  <SelectItem key={ev.id} value={String(ev.id)}>
                    <span className="truncate">{ev.title}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {formatDateRange(ev.startDate, ev.endDate)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="h-10 w-full rounded-xl" disabled={saving}>
            {saving && <Spinner />}
            Give points
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditVolunteerDialog({
  open,
  onOpenChange,
  volunteer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volunteer: VolunteerDetail;
  onSaved: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(volunteer.fullName);
  const [password, setPassword] = useState("");
  const [departments, setDepartments] = useState<VolunteerDepartment[]>(
    volunteer.departments as VolunteerDepartment[]
  );
  const [saving, setSaving] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  // Start from the saved values each time it opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setFullName(volunteer.fullName);
      setPassword("");
      setDepartments(volunteer.departments as VolunteerDepartment[]);
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/volunteers/${volunteer.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          password: password || undefined,
          departments,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not save changes");
        return;
      }
      toast.success("Volunteer updated");
      onOpenChange(false);
      await onSaved();
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>Edit {volunteer.username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editVolName">Full name</Label>
            <Input
              id="editVolName"
              className="h-10"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Departments</Label>
            <DepartmentCheckboxes value={departments} onChange={setDepartments} />
            <p className="text-xs text-muted-foreground">
              As many as apply. They can change these themselves from their badge.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="editVolPin">Reset their PIN</Label>
            <Input
              id="editVolPin"
              className="h-10 tracking-[0.4em] tabular-nums"
              inputMode="numeric"
              maxLength={4}
              placeholder="Leave empty to keep"
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-xs text-muted-foreground">
              Use {DEFAULT_PIN} for a fresh start. Either way they&apos;ll be asked
              to choose their own next time they sign in.
            </p>
          </div>
          <Button type="submit" className="h-10 w-full rounded-xl" disabled={saving}>
            {saving && <Spinner />}
            Save changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
