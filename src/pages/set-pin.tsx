import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/router";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand";
import { PinInput } from "@/components/change-pin-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_PIN } from "@/lib/volunteers";

/**
 * The screen a volunteer lands on while still using the PIN they were handed.
 * No shell and no nav on purpose: everyone starts on the same four digits, so
 * until they pick their own, any volunteer could sign in as any other.
 *
 * It's a gate on the way in rather than a lock on the API — the old PIN keeps
 * working against /api until it's replaced. Making it absolute would mean a
 * database read on every single request, which isn't a trade worth making for
 * a four-digit PIN; nobody arrives here except through the app.
 */
export default function SetPinPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me").then(async (res) => {
      if (!res.ok) {
        router.replace("/");
        return;
      }
      const data = await res.json();
      // Nobody should sit on this screen once they've chosen a PIN, including
      // by typing the URL in.
      if (!data.mustChangePin) {
        router.replace("/events");
        return;
      }
      setChecking(false);
    });
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      toast.error("Those two PINs don't match");
      setConfirmPin("");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No current PIN: signing in already proved they know it.
        body: JSON.stringify({ newPin }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not set your PIN");
        setNewPin("");
        setConfirmPin("");
        return;
      }
      toast.success("That's your PIN now — don't share it");
      router.replace("/events");
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Soft accent wash, matching the login screen; purely decorative. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--primary)_0%,transparent_70%)] opacity-[0.12]"
      />

      <div className="flex justify-end p-4">
        <ThemeToggle className="size-9" />
      </div>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <BrandMark className="h-12" />
            <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight text-balance">
              Choose your PIN
            </h1>
            <p className="mt-1.5 text-sm text-pretty text-muted-foreground">
              Your PIN was set for you — volunteers all start on {DEFAULT_PIN}.
              Pick four digits of your own and your account is yours alone.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="newPin">New PIN</Label>
              <PinInput
                id="newPin"
                value={newPin}
                onChange={setNewPin}
                disabled={saving}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPin">New PIN again</Label>
              <PinInput
                id="confirmPin"
                value={confirmPin}
                onChange={setConfirmPin}
                disabled={saving}
              />
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-[15px]"
              disabled={saving || newPin.length !== 4 || confirmPin.length !== 4}
            >
              {saving && <Spinner />}
              Save my PIN
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Forgotten it later? A coordinator can reset it for you.
          </p>
        </div>
      </main>
    </div>
  );
}
