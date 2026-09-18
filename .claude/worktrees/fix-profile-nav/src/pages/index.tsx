import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/router";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (res.ok) router.replace("/events");
      else setChecking(false);
    });
  }, [router]);

  async function submit(pinValue: string) {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: pinValue }),
      });

      if (res.ok) {
        router.replace("/events");
        return;
      }
      const data = await res.json();
      toast.error(data.error || "Login failed");
      setPin("");
    } catch {
      toast.error("Connection error");
      setPin("");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (username.trim() && pin.length === 4) submit(pin);
  }

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Soft accent wash behind the form; purely decorative. */}
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
            <h1 className="mt-5 font-heading text-2xl font-semibold tracking-tight">
              WizzTech Intranet
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in with your username and PIN
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                placeholder="your.name"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                className="h-11 rounded-xl bg-card px-3.5 text-base"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin">PIN code</Label>
              <InputOTP
                id="pin"
                maxLength={4}
                pattern={REGEXP_ONLY_DIGITS}
                autoComplete="one-time-code"
                value={pin}
                onChange={setPin}
                onComplete={(value: string) => {
                  // The PIN is the last field, so completing it is the submit.
                  if (username.trim()) submit(value);
                }}
                containerClassName="justify-center"
                disabled={loading}
              >
                <InputOTPGroup className="gap-2.5">
                  {[0, 1, 2, 3].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="size-13 rounded-xl border border-input bg-card text-lg font-medium first:rounded-xl last:rounded-xl"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              className="h-11 w-full rounded-xl text-[15px]"
              disabled={loading || !username.trim() || pin.length !== 4}
            >
              {loading && <Spinner />}
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Trouble signing in? Ask a team organizer to reset your PIN.
          </p>
        </div>
      </main>
    </div>
  );
}
