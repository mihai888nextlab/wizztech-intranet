"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Navbar } from "@/components/layout/navbar";
import { PageLayout } from "@/components/layout/page-layout";
import { Trophy, Medal, Loader2 } from "lucide-react";

interface User {
  userId: number;
  fullName: string;
  username: string;
  role: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  fullName: string;
  role: string;
  eventsAttended: number;
  totalMinutes: number;
  score: number;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me").then((res) => {
      if (!res.ok) router.push("/");
      else res.json().then(setUser);
    });
  }, [router]);

  useEffect(() => {
    fetch("/api/leaderboard").then((res) => {
      if (res.ok) res.json().then(setEntries);
    }).finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-700" />;
    return null;
  };

  return (
    <>
      <Navbar user={user} />
      <PageLayout title="Leaderboard" description="Who contributes the most? Ranked by events attended and lab hours.">
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No data yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Events</TableHead>
                    <TableHead className="text-right">Lab Hours</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const initials = entry.fullName
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2);

                    const isMe = entry.userId === user.userId;

                    return (
                      <TableRow
                        key={entry.userId}
                        className={isMe ? "bg-muted/50" : undefined}
                      >
                        <TableCell>
                          <div className="flex items-center justify-center">
                            {getRankIcon(entry.rank) || (
                              <span className="text-sm font-mono text-muted-foreground">
                                {entry.rank}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{entry.fullName}</p>
                              <p className="text-xs text-muted-foreground">@{entry.username}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">{entry.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {entry.eventsAttended}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {formatDuration(entry.totalMinutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-bold font-mono tabular-nums">{entry.score}</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </PageLayout>
    </>
  );
}
