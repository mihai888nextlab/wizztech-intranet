import {
  CalendarDays,
  FileText,
  LayoutDashboard,
  Megaphone,
  Timer,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  /** Shown under the icon in the mobile tab bar, where space is tight. */
  short: string;
  icon: LucideIcon;
}

/**
 * The everyday destinations, filling the mobile tab bar. Dashboard is not here
 * — it lives in the account menu so the bar stays at six slots.
 */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/events", label: "Events", short: "Events", icon: CalendarDays },
  {
    href: "/announcements",
    label: "Announcements",
    short: "News",
    icon: Megaphone,
  },
  { href: "/documents", label: "Documents", short: "Docs", icon: FileText },
  { href: "/lab", label: "Lab", short: "Lab", icon: Timer },
  { href: "/leaderboard", label: "Leaderboard", short: "Ranks", icon: Trophy },
  { href: "/profile", label: "Profile", short: "You", icon: User },
];

export const DASHBOARD_NAV: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  short: "Admin",
  icon: LayoutDashboard,
};

export function isOrganizer(role: string) {
  return role === "admin" || role === "organizer";
}

/** Wide screens have room for Dashboard alongside the primary items. */
export function topBarNavFor(role: string): NavItem[] {
  return isOrganizer(role) ? [...PRIMARY_NAV, DASHBOARD_NAV] : PRIMARY_NAV;
}

/** A nav item owns a route when the path is the item or a child of it. */
export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
