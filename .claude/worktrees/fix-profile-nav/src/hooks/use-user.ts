import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export interface SessionUser {
  userId: number;
  username: string;
  fullName: string;
  role: string;
  /** May create volunteers and give them points; admins may regardless. */
  isVolunteerManager: boolean;
}

/**
 * Loads the signed-in user. Sends anyone without a session back to the login
 * page, and anyone without one of `allowedRoles` back to Events.
 */
export function useUser(allowedRoles?: string[]) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const roleKey = allowedRoles?.join(",");

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
        if (roleKey && !roleKey.split(",").includes(data.role)) {
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
  }, [router, roleKey]);

  return user;
}
