import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

export interface SessionUser {
  userId: number;
  username: string;
  fullName: string;
  /** "member" | "volunteer" — see `src/lib/roles.ts`. */
  accountType: string;
  /** The jobs they hold; a plain member holds none. */
  roles: string[];
  /** Volunteers only; empty until they or a coordinator pick. */
  departments: string[];
  /** Somebody else chose their PIN, so they owe us their own. */
  mustChangePin: boolean;
}

/**
 * Loads the signed-in user. Sends anyone without a session back to the login
 * page, anyone who fails `allowed` back to Events, and anyone still on a PIN
 * somebody else picked for them to /set-pin.
 */
export function useUser(allowed?: (user: SessionUser) => boolean) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  // A predicate is a new function on every render, so it can't be a dependency
  // of the effect below without refetching the session on each one. The ref is
  // seeded with the first value and caught up after every render, in an effect
  // declared first so it has already run by the time the fetch effect does.
  const allowedRef = useRef(allowed);
  useEffect(() => {
    allowedRef.current = allowed;
  });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/me")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          router.replace("/");
          return;
        }
        const data: SessionUser = await res.json();
        if (cancelled) return;
        if (data.mustChangePin && router.pathname !== "/set-pin") {
          router.replace("/set-pin");
          return;
        }
        if (allowedRef.current && !allowedRef.current(data)) {
          router.replace("/events");
          return;
        }
        setUser(data);
      })
      .catch(() => {
        if (!cancelled) router.replace("/");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return user;
}
