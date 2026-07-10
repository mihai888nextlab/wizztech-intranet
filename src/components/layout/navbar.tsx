"use client";

import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Settings, Menu, X } from "lucide-react";
import { useState } from "react";

interface NavbarProps {
  user: {
    fullName: string;
    username: string;
    role: string;
  };
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  const isAdmin = user.role === "admin";
  const isOrganizer = user.role === "admin" || user.role === "organizer";

  const navLinks = [
    { href: "/events", label: "Events" },
    { href: "/lab", label: "Lab Hours" },
    { href: "/profile", label: "Profile" },
    ...(isOrganizer ? [{ href: "/dashboard", label: "Dashboard" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4 max-w-7xl mx-auto">
        <Link href="/events" className="font-bold text-lg tracking-tight mr-4 shrink-0">
          WizzTech
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant={router.pathname.startsWith(link.href) ? "secondary" : "ghost"}
              size="sm"
              onClick={() => router.push(link.href)}
            >
              {link.label}
            </Button>
          ))}
        </nav>

        <div className="flex-1" />

        <DropdownMenu>
          <DropdownMenuTrigger>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user.fullName}</span>
                <span className="text-xs text-muted-foreground capitalize">@{user.username} &middot; {user.role}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/profile")}>
              <User /> Profile
            </DropdownMenuItem>
            {isAdmin && (
              <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                <Settings /> Dashboard
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t p-2 flex flex-col gap-1">
          {navLinks.map((link) => (
            <Button
              key={link.href}
              variant={router.pathname.startsWith(link.href) ? "secondary" : "ghost"}
              size="sm"
              className="justify-start"
              onClick={() => { router.push(link.href); setMobileOpen(false); }}
            >
              {link.label}
            </Button>
          ))}
        </div>
      )}
    </header>
  );
}
