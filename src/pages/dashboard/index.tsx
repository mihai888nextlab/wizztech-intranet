"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Navbar } from "@/components/layout/navbar";
import { PageLayout } from "@/components/layout/page-layout";
import {
  Users, Calendar, Clock, UserPlus, Plus, Trash2, Pencil, Loader2,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";

interface User {
  userId: number;
  fullName: string;
  username: string;
  role: string;
}

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
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string | null;
  description: string | null;
  createdBy: number;
  createdAt: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("tab") || "overview";
    }
    return "overview";
  });
  const [stats, setStats] = useState<DashboardStats | null>(null);

  // Users state
  const [appUsers, setAppUsers] = useState<AppUser[]>([]);

  // Events state
  const [appEvents, setAppEvents] = useState<AppEvent[]>([]);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/");
      else res.json().then((u) => {
        if (u.role !== "admin" && u.role !== "organizer") router.push("/events");
        setUser(u);
      });
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;
    fetch("/api/dashboard/stats").then(async (r) => { if (r.ok) setStats(await r.json()); });
    if (user.role === "admin") {
      fetch("/api/users").then(async (r) => { if (r.ok) setAppUsers(await r.json()); });
    }
    fetch("/api/events").then(async (r) => { if (r.ok) setAppEvents(await r.json()); });
  }, [user]);

  if (!user) return null;

  const isAdmin = user.role === "admin";

  const tabs = [
    { id: "overview", label: "Overview" },
    ...(isAdmin ? [{ id: "users", label: "Users" }] : []),
    { id: "events", label: "Events" },
  ];

  return (
    <>
      <Navbar user={user} />
      <PageLayout title="Dashboard">
        <div className="flex gap-1 border-b pb-1">
          {tabs.map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab stats={stats} />}
        {tab === "users" && isAdmin && <UsersTab users={appUsers} setUsers={setAppUsers} />}
        {tab === "events" && <EventsTab events={appEvents} setEvents={setAppEvents} />}
      </PageLayout>
    </>
  );
}

function OverviewTab({ stats }: { stats: DashboardStats | null }) {
  if (!stats) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.totalUsers !== undefined && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" /> Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Lab Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalLabHours}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Active in Lab
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeLabSessions}</div>
          </CardContent>
        </Card>
      </div>

      {stats.userRoleCounts && (
        <Card>
          <CardHeader><CardTitle className="text-base">Members by Role</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-3 flex-wrap">
              {stats.userRoleCounts.map((r) => (
                <Badge key={r.role} variant="secondary" className="text-sm px-3 py-1 capitalize">
                  {r.role}: {r.count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {stats.upcomingEvents.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Upcoming Events</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.upcomingEvents.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell>{format(parseISO(e.startDate), "MMM d, yyyy")}</TableCell>
                    <TableCell>{e.startTime.slice(0, 5)} - {e.endTime.slice(0, 5)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function UsersTab({ users, setUsers }: { users: AppUser[]; setUsers: (u: AppUser[]) => void }) {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("member");
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState("member");
  const [loading, setLoading] = useState(false);
  const [editLoading, setEditLoading] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, fullName, password, role }),
      });
      if (res.ok) {
        const newUser = await res.json();
        setUsers([...users, newUser]);
        toast.success("User created!");
        setOpen(false);
        setUsername("");
        setFullName("");
        setPassword("");
        setRole("member");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this user?")) return;
    const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(users.filter((u) => u.id !== id));
      toast.success("User deleted");
    } else {
      toast.error("Failed to delete");
    }
  };

  const openEdit = (u: AppUser) => {
    setEditUser(u);
    setEditFullName(u.fullName);
    setEditRole(u.role);
    setEditOpen(true);
  };

  const handleEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: editFullName, role: editRole }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(users.map((u) => u.id === updated.id ? { ...u, fullName: updated.fullName, role: updated.role } : u));
        toast.success("User updated");
        setEditOpen(false);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button><UserPlus /> Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">PIN (4 digits)</Label>
                <Input
                  id="password"
                  type="password"
                  maxLength={4}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={(v) => v && setRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="organizer">Organizer</SelectItem>
                    <SelectItem value="volunteer">Volunteer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={editUser?.username || ""} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editFullName">Full Name</Label>
                <Input id="editFullName" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editRole">Role</Label>
                <Select value={editRole} onValueChange={(v) => v && setEditRole(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="organizer">Organizer</SelectItem>
                    <SelectItem value="volunteer">Volunteer</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={editLoading}>
                {editLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-sm">{u.username}</TableCell>
                  <TableCell>{u.fullName}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{u.role}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(parseISO(u.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(u.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EventsTab({ events, setEvents }: {
  events: AppEvent[];
  setEvents: (e: AppEvent[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, startDate, endDate, startTime, endTime, location: location || undefined }),
      });
      if (res.ok) {
        const newEvent = await res.json();
        setEvents([newEvent, ...events]);
        toast.success("Event created!");
        setOpen(false);
        setTitle("");
        setDescription("");
        setStartDate("");
        setEndDate("");
        setStartTime("09:00");
        setEndTime("17:00");
        setLocation("");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed");
      }
    } catch {
      toast.error("Connection error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this event?")) return;
    const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      setEvents(events.filter((e) => e.id !== id));
      toast.success("Event deleted");
    } else {
      toast.error("Failed to delete");
    }
  };

  const isPast = (endDate: string) => endDate < new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger>
            <Button><Plus /> New Event</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Event</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description (optional)</Label>
                <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start">Start Time</Label>
                  <Input id="start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end">End Time</Label>
                  <Input id="end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location (optional)</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Event
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {e.title}
                    {isPast(e.endDate) && <Badge variant="secondary" className="ml-2">Past</Badge>}
                  </TableCell>
                  <TableCell>{e.startDate === e.endDate ? format(parseISO(e.startDate), "MMM d, yyyy") : `${format(parseISO(e.startDate), "MMM d")} - ${format(parseISO(e.endDate), "MMM d, yyyy")}`}</TableCell>
                  <TableCell className="font-mono text-sm">{e.startTime.slice(0, 5)} - {e.endTime.slice(0, 5)}</TableCell>
                  <TableCell className="text-muted-foreground">{e.location || "-"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No events yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
