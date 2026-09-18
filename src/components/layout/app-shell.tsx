import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowLeft,
  HandHeart,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
} from "lucide-react";

import { BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import type { SessionUser } from "@/hooks/use-user";
import { initialsOf } from "@/lib/format";
import {
  canManageVolunteers,
  isActive,
  isOrganizer,
  isVolunteer,
  tabBarNavFor,
  topBarNavFor,
} from "@/lib/nav";
import { cn } from "@/lib/utils";

interface AppShellProps {
  user: SessionUser;
  title?: ReactNode;
  description?: ReactNode;
  /** Primary control for the page, shown beside the title. */
  action?: ReactNode;
  back?: { href: string; label: string };
  children: ReactNode;
  wide?: boolean;
}

export function AppShell({
  user,
  title,
  description,
  action,
  back,
  children,
  wide,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar user={user} />

      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 pt-5 pb-28 sm:px-6 md:pt-8 lg:pb-16",
          wide ? "max-w-6xl" : "max-w-5xl"
        )}
      >
        {back && (
          <Link
            href={back.href}
            className="mb-4 -ml-1 inline-flex items-center gap-1.5 rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {back.label}
          </Link>
        )}

        {(title || action) && (
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              {title && (
                <h1 className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-[28px]">
                  {title}
                </h1>
              )}
              {description && (
                <p className="text-sm text-pretty text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>
        )}

        {children}
      </main>

      <TabBar user={user} />
    </div>
  );
}

function TopBar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const items = topBarNavFor(user);

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 chrome-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:px-6 md:h-16">
        <Link
          href="/events"
          className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark />
          <span className="font-heading text-[15px] font-semibold tracking-tight">
            WizzTech
          </span>
        </Link>

        {/* Eight items don't fit at md, so the tab bar covers tablets too. */}
        <nav className="ml-6 hidden items-center gap-0.5 lg:flex">
          {items.map((item) => {
            const active = isActive(router.pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle className="size-9" />
          <AccountMenu user={user} />
        </div>
      </div>
    </header>
  );
}

function AccountMenu({ user }: { user: SessionUser }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Account menu"
          />
        }
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-secondary text-xs font-medium text-foreground">
            {initialsOf(user.fullName)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="py-1.5">
          <span className="block truncate text-sm font-medium text-foreground">
            {user.fullName}
          </span>
          <span className="block truncate text-xs font-normal text-muted-foreground capitalize">
            @{user.username} · {user.role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* Volunteers have no profile page; their points page stands in for it. */}
        {!isVolunteer(user.role) && (
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            <UserIcon /> Profile
          </DropdownMenuItem>
        )}
        {/* Dashboard is here too — on phones it also appears in the tab bar. */}
        {isOrganizer(user.role) && (
          <DropdownMenuItem onClick={() => router.push("/dashboard")}>
            <LayoutDashboard /> Dashboard
          </DropdownMenuItem>
        )}
        {/* The only way to Volunteers on a phone — it isn't in the tab bar. */}
        {canManageVolunteers(user.role, user.isVolunteerManager) && (
          <DropdownMenuItem onClick={() => router.push("/volunteers")}>
            <HandHeart /> Volunteers
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleLogout}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Fixed bottom navigation — the primary way around the app on a phone. */
function TabBar({ user }: { user: SessionUser }) {
  const router = useRouter();
  const items = tabBarNavFor(user.role);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 chrome-blur pb-safe lg:hidden">
      <ul
        className="grid"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = isActive(router.pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon
                  className={cn("size-5", active && "stroke-[2.25]")}
                  aria-hidden="true"
                />
                {item.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Shown while the session is being resolved, before the shell can render. */
export function AuthLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
