import {
  CalendarDays,
  HandHeart,
  Medal,
  FileText,
  LayoutDashboard,
  Megaphone,
  QrCode,
  Timer,
  Trophy,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { canManageVolunteers, isOrganizer, isVolunteer } from "@/lib/roles";

export interface NavItem {
  href: string;
  label: string;
  /** Shown under the icon in the mobile tab bar, where space is tight. */
  short: string;
  icon: LucideIcon;
}

/** What the nav needs to know about whoever is looking at it. */
interface NavUser {
  accountType: string;
  roles: readonly string[];
}

/**
 * The everyday destinations, filling the mobile tab bar. Dashboard is appended
 * by `topBarNavFor` for organizers, so it stays out of the way for members.
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
  { href: "/finance", label: "Finance", short: "Money", icon: Wallet },
  { href: "/profile", label: "Profile", short: "You", icon: User },
];

export const DASHBOARD_NAV: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  short: "Admin",
  icon: LayoutDashboard,
};

export const VOLUNTEERS_NAV: NavItem = {
  href: "/volunteers",
  label: "Volunteers",
  short: "Crew",
  icon: HandHeart,
};

/** Everything a volunteer can reach — see `isVolunteerPathAllowed`. */
export const VOLUNTEER_NAV: NavItem[] = [
  { href: "/events", label: "Events", short: "Events", icon: CalendarDays },
  { href: "/badge", label: "My badge", short: "Badge", icon: QrCode },
  { href: "/points", label: "My points", short: "Points", icon: Medal },
  { href: "/leaderboard", label: "Leaderboard", short: "Ranks", icon: Trophy },
];

export { canManageVolunteers, isOrganizer, isVolunteer };

/** The mobile tab bar: Dashboard is appended for organizers. */
export function tabBarNavFor(user: NavUser): NavItem[] {
  if (isVolunteer(user.accountType)) return VOLUNTEER_NAV;
  return isOrganizer(user.roles) ? [...PRIMARY_NAV, DASHBOARD_NAV] : PRIMARY_NAV;
}

/**
 * Wide screens also have room for Volunteers. On phones it lives in the
 * account menu instead — the tab bar is already full.
 */
export function topBarNavFor(user: NavUser): NavItem[] {
  const items = tabBarNavFor(user);
  return canManageVolunteers(user.roles) ? [...items, VOLUNTEERS_NAV] : items;
}

/** A nav item owns a route when the path is the item or a child of it. */
export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
