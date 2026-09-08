import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Clock,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Timer,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { ListCard, ListRow } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useUser } from "@/hooks/use-user";
import {
  eventStatus,
  formatDateRange,
  formatTime,
  initialsOf,
} from "@/lib/format";
import { USER_ROLES } from "@/lib/roles";

interface AppUser {
  id: number;
  username: string;
  fullName: string;
  role: string;
  createdAt: string;
}

interface AppEvent {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string | null;
}

interface DashboardStats {
  totalUsers?: number;
  totalEvents: number;
  totalAttendance: number;
  totalLabHours: number;
  activeLabSessions: number;
  userRoleCounts?: { role: string; count: number }[];
  upcomingEvents: AppEvent[];
}

export default function DashboardPage() {
  const router = useRouter();
  const user = useUser(["admin", "organizer"]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);

  const isAdmin = user?.role === "admin";
  // The URL is the source of truth for the tab, so /dashboard?tab=events links work.
  const tab =
    typeof router.query.tab === "string" ? router.query.tab : "overview";

  useEffect(() => {
    if (!user) return;
    fetch("/api/dashboard/stats").then(async (r) => {
      if (r.ok) setStats(await r.json());
    });
    fetch("/api/events").then(async (r) => {
      if (r.ok) setEvents(await r.json());
    });
    if (user.role === "admin") {
      fetch("/api/users").then(async (r) => {
        if (r.ok) setUsers(await r.json());
      });
    }
  }, [user]);

  if (!user) return <AuthLoading />;

  const changeTab = (value: string) => {
    router.replace(
      value === "overview" ? "/dashboard" : `/dashboard?tab=${value}`,
      undefined,
      { shallow: true }
    );
  };

  // A non-admin landing on ?tab=users has nothing to show there.
  const activeTab = tab === "users" && !isAdmin ? "overview" : tab;

  return (
    <AppShell
      user={user}
      title="Dashboard"
      description="Team activity, members and events."
      wide
    >
      <Tabs value={activeTab} onValueChange={changeTab} className="gap-5">
        <TabsList className="h-9 w-full sm:w-auto">
          <TabsTrigger value="overview" className="px-4">
            Overview
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="users" className="px-4">
              Members
            </TabsTrigger>
          )}
          <TabsTrigger value="events" className="px-4">
            Events
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab stats={stats} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="users">
            <UsersTab users={users} setUsers={setUsers} currentUserId={user.userId} />
          </TabsContent>
        )}

        <TabsContent value="events">
          <EventsTab events={events} setEvents={setEvents} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function OverviewTab({ stats }: { stats: DashboardStats | null }) {
  if (!stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.totalUsers !== undefined && (
          <StatCard label="Members" value={stats.totalUsers} icon={Users} />
        )}
        <StatCard
          label="Events"
          value={stats.totalEvents}
          icon={CalendarDays}
          hint={`${stats.totalAttendance} sign-ins`}
        />
        <StatCard
          label="Lab hours"
          value={`${stats.totalLabHours}h`}
          icon={Timer}
        />
        <StatCard
          label="In the lab now"
          value={stats.activeLabSessions}
          icon={Clock}
        />
      </div>

      {stats.userRoleCounts && stats.userRoleCounts.length > 0 && (
        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <p className="font-heading text-sm font-medium">Members by role</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.userRoleCounts.map((r) => (
              <Badge
                key={r.role}
                variant="outline"
                className="h-7 gap-1.5 px-2.5 capitalize"
              >
                {r.role}
                <span className="font-semibold tabular-nums">{r.count}</span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-heading text-sm font-semibold tracking-tight">
          Upcoming events
        </h2>
        {stats.upcomingEvents.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nothing scheduled"
            description="Create an event from the Events tab."
          />
        ) : (
          <ListCard>
            {stats.upcomingEvents.map((e) => (
              <ListRow key={e.id}>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/events/${e.id}`}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {e.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateRange(e.startDate, e.endDate)} ·{" "}
                    {formatTime(e.startTime)}–{formatTime(e.endTime)}
                  </p>
                </div>
                <StatusBadge status={eventStatus(e.startDate, e.endDate)} />
              </ListRow>
            ))}
          </ListCard>
        )}
      </div>
    </div>
  );
}

function UsersTab({
  users,
  setUsers,
  currentUserId,
}: {
  users: AppUser[];
  setUsers: (u: AppUser[]) => void;
  currentUserId: number;
}) {
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/users/${deleting.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(users.filter((u) => u.id !== deleting.id));
      toast.success("Member removed");
    } else {
      toast.error("Could not remove that member");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateUserDialog
          onCreated={(newUser) => setUsers([...users, newUser])}
        />
      </div>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members yet"
          description="Add your teammates so they can sign in."
        />
      ) : (
        <ListCard>
          {users.map((u) => (
            <ListRow key={u.id}>
              <Avatar className="size-8">
                <AvatarFallback className="bg-secondary text-[11px] font-medium text-foreground">
                  {initialsOf(u.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{u.fullName}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  @{u.username} · joined{" "}
                  {format(parseISO(u.createdAt), "MMM d, yyyy")}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 capitalize">
                {u.role}
              </Badge>
              <RowMenu
                onEdit={() => setEditing(u)}
                onDelete={u.id === currentUserId ? undefined : () => setDeleting(u)}
              />
            </ListRow>
          ))}
        </ListCard>
      )}

      <EditUserDialog
        user={editing}
        onOpenChange={(open) => !open && setEditing(null)}
        onUpdated={(updated) =>
          setUsers(users.map((u) => (u.id === updated.id ? updated : u)))
        }
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Remove ${deleting?.fullName ?? ""}?`}
        description="Their attendance records and lab sessions are deleted too. This cannot be undone."
        confirmLabel="Remove"
        onConfirm={handleDelete}
      />
    </div>
  );
}

function EventsTab({
  events,
  setEvents,
}: {
  events: AppEvent[];
  setEvents: (e: AppEvent[]) => void;
}) {
  const [deleting, setDeleting] = useState<AppEvent | null>(null);

  const handleDelete = async () => {
    if (!deleting) return;
    const res = await fetch(`/api/events/${deleting.id}`, { method: "DELETE" });
    if (res.ok) {
      setEvents(events.filter((e) => e.id !== deleting.id));
      toast.success("Event deleted");
    } else {
      toast.error("Could not delete that event");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateEventDialog
          onCreated={(newEvent) => setEvents([newEvent, ...events])}
        />
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No events yet"
          description="Create the first one so the team can sign in."
        />
      ) : (
        <ListCard>
          {events.map((e) => (
            <ListRow key={e.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/events/${e.id}`}
                    className="truncate text-sm font-medium hover:text-primary"
                  >
                    {e.title}
                  </Link>
                  <StatusBadge status={eventStatus(e.startDate, e.endDate)} />
                </div>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                  <span>{formatDateRange(e.startDate, e.endDate)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatTime(e.startTime)}–{formatTime(e.endTime)}
                  </span>
                  {e.location && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {e.location}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <RowMenu onDelete={() => setDeleting(e)} />
            </ListRow>
          ))}
        </ListCard>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete "${deleting?.title ?? ""}"?`}
        description="Attendance recorded for this event is deleted too. This cannot be undone."
        onConfirm={handleDelete}
      />
    </div>
  );
}

function RowMenu({
  onEdit,
  onDelete,
}: {
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 size-9 shrink-0 text-muted-foreground"
            aria-label="Row actions"
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil /> Edit
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RoleSelect({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  id: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v as string)}>
      <SelectTrigger id={id} className="h-10 w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {USER_ROLES.map((role) => (
          <SelectItem key={role} value={role} className="capitalize">
            {role}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CreateUserDialog({
  onCreated,
}: {
  onCreated: (user: AppUser) => void;
}) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>("member");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, fullName, password, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not create that member");
        return;
      }
      onCreated(await res.json());
      toast.success("Member added");
      setOpen(false);
      setUsername("");
      setFullName("");
      setPassword("");
      setRole("member");
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <UserPlus /> Add member
      </DialogTrigger>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              className="h-10"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              className="h-10"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pin">PIN (4 digits)</Label>
            <Input
              id="pin"
              className="h-10 tracking-[0.4em] tabular-nums"
              inputMode="numeric"
              maxLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <RoleSelect id="role" value={role} onChange={setRole} />
          </div>
          <Button
            type="submit"
            className="h-10 w-full rounded-xl"
            disabled={saving}
          >
            {saving && <Spinner />}
            Add member
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onOpenChange,
  onUpdated,
}: {
  user: AppUser | null;
  onOpenChange: (open: boolean) => void;
  onUpdated: (user: AppUser) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>("member");
  const [saving, setSaving] = useState(false);
  const [loadedId, setLoadedId] = useState<number | null>(null);

  // Load the form whenever a different member is opened.
  if (user && user.id !== loadedId) {
    setLoadedId(user.id);
    setFullName(user.fullName);
    setRole(user.role);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, role }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not save changes");
        return;
      }
      const updated = await res.json();
      onUpdated({ ...user, fullName: updated.fullName, role: updated.role });
      toast.success("Member updated");
      onOpenChange(false);
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>Edit {user?.username}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="editFullName">Full name</Label>
            <Input
              id="editFullName"
              className="h-10"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="editRole">Role</Label>
            <RoleSelect id="editRole" value={role} onChange={setRole} />
          </div>
          <Button
            type="submit"
            className="h-10 w-full rounded-xl"
            disabled={saving}
          >
            {saving && <Spinner />}
            Save changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateEventDialog({
  onCreated,
}: {
  onCreated: (event: AppEvent) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          startDate,
          // A single-day event only needs a start date.
          endDate: endDate || startDate,
          startTime,
          endTime,
          location: location || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not create that event");
        return;
      }
      onCreated(await res.json());
      toast.success("Event created");
      setOpen(false);
      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setStartTime("09:00");
      setEndTime("17:00");
      setLocation("");
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <Plus /> New event
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] gap-5 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create an event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              className="h-10"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Starts</Label>
              <Input
                id="startDate"
                type="date"
                className="h-10"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Ends</Label>
              <Input
                id="endDate"
                type="date"
                className="h-10"
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startTime">From</Label>
              <Input
                id="startTime"
                type="time"
                className="h-10"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">To</Label>
              <Input
                id="endTime"
                type="time"
                className="h-10"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              className="h-10"
              placeholder="Optional"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="h-10 w-full rounded-xl"
            disabled={saving}
          >
            {saving && <Spinner />}
            Create event
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
