import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ChevronRight, HandHeart, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/empty-state";
import { ListCard } from "@/components/section";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useUser } from "@/hooks/use-user";
import { initialsOf } from "@/lib/format";
import { canManageVolunteers } from "@/lib/roles";

interface Volunteer {
  userId: number;
  username: string;
  fullName: string;
  points: number;
  rank: number;
  awards: number;
}

export default function VolunteersPage() {
  const router = useRouter();
  const user = useUser();
  const [volunteers, setVolunteers] = useState<Volunteer[] | null>(null);
  const allowed = user
    ? canManageVolunteers(user.role, user.isVolunteerManager)
    : false;

  useEffect(() => {
    if (!user) return;
    if (!allowed) {
      router.replace("/events");
      return;
    }
    fetch("/api/volunteers")
      .then((res) => (res.ok ? res.json() : []))
      .then(setVolunteers);
  }, [user, allowed, router]);

  if (!user || !allowed) return <AuthLoading />;

  return (
    <AppShell
      user={user}
      title="Volunteers"
      description="Add volunteers and give them points for the work they put in."
      action={
        <AddVolunteerDialog
          onCreated={(id) => router.push(`/volunteers/${id}`)}
        />
      }
    >
      {!volunteers ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : volunteers.length === 0 ? (
        <EmptyState
          icon={HandHeart}
          title="No volunteers yet"
          description="Add a volunteer to give them a login. They'll see events, their points and the volunteer leaderboard."
        />
      ) : (
        <ListCard>
          {volunteers.map((v) => (
            <li key={v.userId}>
              <Link
                href={`/volunteers/${v.userId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-secondary text-[11px] font-medium text-foreground">
                    {initialsOf(v.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.fullName}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    @{v.username} · #{v.rank} · {v.awards} award
                    {v.awards === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="shrink-0 font-heading text-base font-semibold tabular-nums">
                  {v.points}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ListCard>
      )}
    </AppShell>
  );
}

function AddVolunteerDialog({ onCreated }: { onCreated: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, fullName, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not add that volunteer");
        return;
      }
      toast.success("Volunteer added");
      setOpen(false);
      onCreated(data.userId);
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="lg" />}>
        <UserPlus /> <span className="hidden sm:inline">Add volunteer</span>
      </DialogTrigger>
      <DialogContent className="gap-5">
        <DialogHeader>
          <DialogTitle>Add a volunteer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="volFullName">Full name</Label>
            <Input
              id="volFullName"
              className="h-10"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="volUsername">Username</Label>
            <Input
              id="volUsername"
              className="h-10"
              autoCapitalize="none"
              autoCorrect="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="volPin">PIN (4 digits)</Label>
            <Input
              id="volPin"
              className="h-10 tracking-[0.4em] tabular-nums"
              inputMode="numeric"
              maxLength={4}
              value={password}
              onChange={(e) => setPassword(e.target.value.replace(/\D/g, ""))}
              required
            />
            <p className="text-xs text-muted-foreground">
              They sign in with this username and PIN.
            </p>
          </div>
          <Button type="submit" className="h-10 w-full rounded-xl" disabled={saving}>
            {saving && <Spinner />}
            Add volunteer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
