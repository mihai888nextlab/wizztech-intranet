import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, AuthLoading } from "@/components/layout/app-shell";
import { ChangePinCard } from "@/components/change-pin-card";
import { BadgeCard } from "@/components/volunteers/badge-card";
import { DepartmentCheckboxes } from "@/components/volunteers/department-checkboxes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/hooks/use-user";
import { isVolunteer } from "@/lib/roles";
import { type VolunteerDepartment } from "@/lib/volunteers";

interface MyBadge {
  fullName: string;
  username: string;
  departments: string[];
  points: number;
  rank: number | null;
  total: number;
}

/**
 * A volunteer's own page: who they are at an event, which team they're on, and
 * their PIN. Team members have /profile; this stands in for it.
 */
export default function BadgePage() {
  const user = useUser((u) => isVolunteer(u.accountType));
  const [badge, setBadge] = useState<MyBadge | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch("/api/volunteers/me/badge")
      .then((res) => (res.ok ? res.json() : null))
      .then(setBadge);
  }, [user]);

  const saveDepartments = async (departments: VolunteerDepartment[]) => {
    // Shown straight away, then reverted if the save fails: ticking a box and
    // waiting for a round trip before it moves feels broken.
    const previous = badge?.departments ?? [];
    setBadge((current) => (current ? { ...current, departments } : current));
    setSaving(true);
    try {
      const res = await fetch("/api/volunteers/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departments }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not save your departments");
        setBadge((current) => (current ? { ...current, departments: previous } : current));
        return;
      }
    } catch {
      toast.error("Connection error");
      setBadge((current) => (current ? { ...current, departments: previous } : current));
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <AuthLoading />;

  return (
    <AppShell
      user={user}
      title="My badge"
      description="Show this at an event so the team knows who you are."
      action={
        <Button
          variant="outline"
          className="h-10 rounded-xl print:hidden"
          onClick={() => window.print()}
        >
          Print
        </Button>
      }
    >
      {!badge ? (
        <div className="space-y-6">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <BadgeCard
            fullName={badge.fullName}
            username={badge.username}
            departments={badge.departments}
            points={badge.points}
            qrSrc="/api/volunteers/me/qr"
          />

          <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10 print:hidden">
            <p className="font-heading text-sm font-medium">Your departments</p>
            <p className="text-xs text-muted-foreground">
              Which sides of the team you help on — tick as many as apply.
              Saved as you go.
            </p>
            <div className="pt-1">
              <DepartmentCheckboxes
                value={badge.departments}
                onChange={saveDepartments}
                disabled={saving}
              />
            </div>
          </div>

          <div className="print:hidden">
            <ChangePinCard />
          </div>
        </div>
      )}
    </AppShell>
  );
}
