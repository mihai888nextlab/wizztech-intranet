import { useState, type FormEvent } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

/**
 * Four PIN slots, sized to match the login screen's. Pulled out because the
 * change-PIN form needs three of them and /set-pin needs two.
 */
export function PinInput({
  id,
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <InputOTP
      id={id}
      maxLength={4}
      pattern={REGEXP_ONLY_DIGITS}
      autoComplete="off"
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      containerClassName="justify-center"
      disabled={disabled}
      autoFocus={autoFocus}
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
  );
}

/**
 * Changing your own PIN, wherever you are: the Profile page for the team, the
 * badge page for volunteers. Knowing the current PIN is required, so a phone
 * left unlocked on a desk can't be used to take someone's account.
 */
export function ChangePinCard() {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      toast.error("Those two PINs don't match");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Could not change your PIN");
        return;
      }
      toast.success("PIN changed");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  const ready =
    currentPin.length === 4 && newPin.length === 4 && confirmPin.length === 4;

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
    >
      <div className="flex items-start gap-3">
        <KeyRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-heading text-sm font-medium">Change your PIN</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Four digits, and it&apos;s how you sign in — keep it to yourself.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="currentPin" className="text-xs">
            Current PIN
          </Label>
          <PinInput id="currentPin" value={currentPin} onChange={setCurrentPin} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="newPin" className="text-xs">
            New PIN
          </Label>
          <PinInput id="newPin" value={newPin} onChange={setNewPin} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPin" className="text-xs">
            New PIN again
          </Label>
          <PinInput id="confirmPin" value={confirmPin} onChange={setConfirmPin} />
        </div>
      </div>

      <Button
        type="submit"
        variant="outline"
        className="h-10 w-full rounded-xl"
        disabled={saving || !ready}
      >
        {saving && <Spinner />}
        Change PIN
      </Button>
    </form>
  );
}
