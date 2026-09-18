import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  isVolunteerPathAllowed,
  parseAwardInput,
  rankVolunteers,
} from "@/lib/volunteers";

/*
  The allow-list is the only thing keeping volunteers out of the team's
  announcements, documents and finances, so both sides of it are pinned here.
*/

for (const path of [
  "/",
  "/events",
  "/events/12",
  "/leaderboard",
  "/points",
  "/points/",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/events",
  "/api/events/3/attendance",
  "/api/volunteers/leaderboard",
  "/api/volunteers/me",
]) {
  test(`volunteers may reach ${path}`, () => {
    assert.equal(isVolunteerPathAllowed(path), true);
  });
}

for (const path of [
  "/announcements",
  "/documents/4",
  "/lab",
  "/finance",
  "/profile",
  "/dashboard",
  "/volunteers",
  "/volunteers/3",
  "/leaderboard/extra",
  "/eventsx",
  "/api/announcements",
  "/api/leaderboard",
  "/api/finance/summary",
  "/api/users",
  "/api/volunteers",
  "/api/volunteers/3/points",
  "/api/volunteer-points/1",
  "/api/attendance/mine",
  "/api/eventsx",
  "/api/auth",
]) {
  test(`volunteers are kept out of ${path}`, () => {
    assert.equal(isVolunteerPathAllowed(path), false);
  });
}

test("an award needs whole, non-zero points and a reason", () => {
  assert.equal(parseAwardInput({ amount: 0, reason: "x" }).ok, false);
  assert.equal(parseAwardInput({ amount: 1.5, reason: "x" }).ok, false);
  assert.equal(parseAwardInput({ amount: "abc", reason: "x" }).ok, false);
  assert.equal(parseAwardInput({ amount: 5, reason: "   " }).ok, false);
  assert.equal(parseAwardInput({ amount: 5, reason: "x".repeat(201) }).ok, false);
  assert.equal(parseAwardInput({ amount: 100_000, reason: "x" }).ok, false);
  assert.equal(parseAwardInput(undefined).ok, false);
});

test("an award accepts corrections, string amounts and an optional event", () => {
  assert.deepEqual(parseAwardInput({ amount: "-3", reason: " Late ", eventId: "" }), {
    ok: true,
    value: { amount: -3, reason: "Late", eventId: null },
  });
  assert.deepEqual(parseAwardInput({ amount: 10, reason: "Setup", eventId: "7" }), {
    ok: true,
    value: { amount: 10, reason: "Setup", eventId: 7 },
  });
  assert.equal(parseAwardInput({ amount: 10, reason: "Setup", eventId: "x" }).ok, false);
});

test("ranking puts the most points first and ties share a rank", () => {
  const ranked = rankVolunteers([
    { userId: 1, fullName: "Cara", points: 5 },
    { userId: 2, fullName: "Ana", points: 20 },
    { userId: 3, fullName: "Bob", points: 5 },
    { userId: 4, fullName: "Dan", points: 0 },
  ]);
  assert.deepEqual(
    ranked.map((r) => [r.fullName, r.rank]),
    [["Ana", 1], ["Bob", 2], ["Cara", 2], ["Dan", 4]]
  );
});
