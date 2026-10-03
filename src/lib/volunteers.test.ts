import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  departmentLabel,
  isLeaderboardBoard,
  isValidPin,
  isVolunteerDepartment,
  isVolunteerPathAllowed,
  parseAwardInput,
  parseDepartments,
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
  "/set-pin",
  "/badge",
  "/api/volunteers/me/badge",
  "/api/volunteers/me/qr",
  "/api/auth/pin",
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
  // Another volunteer's badge must not be reachable by swapping "me" for an id.
  "/api/volunteers/3/qr",
  "/api/volunteers/7",
  "/api/volunteer-points/1",
  "/badgex",
  "/badge/3",
  "/api/attendance/mine",
  "/api/eventsx",
  "/api/auth",
]) {
  test(`volunteers are kept out of ${path}`, () => {
    assert.equal(isVolunteerPathAllowed(path), false);
  });
}

const AWARD = { amount: 5, reason: "Setup", department: "media" };

test("an award needs whole, non-zero points and a reason", () => {
  assert.equal(parseAwardInput({ ...AWARD, amount: 0 }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, amount: 1.5 }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, amount: "abc" }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, reason: "   " }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, reason: "x".repeat(201) }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, amount: 100_000 }).ok, false);
  assert.equal(parseAwardInput(undefined).ok, false);
});

test("an award must name a department, so every point lands on a board", () => {
  assert.equal(parseAwardInput({ amount: 5, reason: "Setup" }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, department: "catering" }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, department: "Media" }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, department: null }).ok, false);
  assert.equal(parseAwardInput({ ...AWARD, department: ["media"] }).ok, false);
  assert.equal(parseAwardInput(AWARD).ok, true);
});

test("an award accepts corrections, string amounts and an optional event", () => {
  assert.deepEqual(
    parseAwardInput({ amount: "-3", reason: " Late ", department: "media", eventId: "" }),
    {
      ok: true,
      value: { amount: -3, reason: "Late", department: "media", eventId: null },
    }
  );
  assert.deepEqual(
    parseAwardInput({ amount: 10, reason: "Setup", department: "engineering", eventId: "7" }),
    {
      ok: true,
      value: { amount: 10, reason: "Setup", department: "engineering", eventId: 7 },
    }
  );
  assert.equal(parseAwardInput({ ...AWARD, eventId: "x" }).ok, false);
});

test("the leaderboard accepts overall and the four departments, nothing else", () => {
  assert.equal(isLeaderboardBoard("overall"), true);
  for (const d of ["engineering", "programming", "media", "marketing"]) {
    assert.equal(isLeaderboardBoard(d), true);
  }
  assert.equal(isLeaderboardBoard("team"), false);
  assert.equal(isLeaderboardBoard(""), false);
  assert.equal(isLeaderboardBoard(undefined), false);
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
    [["Ana", 1], ["Bob", 2], ["Cara", 2], ["Dan", null]]
  );
});

test("nobody on zero is ranked, however many of them there are", () => {
  // The common case on a department board that nobody has scored in yet:
  // ranking them would read as a four-way tie for first.
  const ranked = rankVolunteers([
    { userId: 1, fullName: "Cara", points: 0 },
    { userId: 2, fullName: "Ana", points: 0 },
    { userId: 3, fullName: "Bob", points: 0 },
  ]);
  assert.deepEqual(ranked.map((r) => r.rank), [null, null, null]);
  // They are still listed, alphabetically, so each can find themselves.
  assert.deepEqual(ranked.map((r) => r.fullName), ["Ana", "Bob", "Cara"]);
});

test("a rank still counts positions, not scorers", () => {
  const ranked = rankVolunteers([
    { userId: 1, fullName: "Ana", points: 20 },
    { userId: 2, fullName: "Bob", points: 10 },
    { userId: 3, fullName: "Cara", points: 0 },
    { userId: 4, fullName: "Dan", points: -5 },
  ]);
  assert.deepEqual(
    ranked.map((r) => [r.fullName, r.rank]),
    [["Ana", 1], ["Bob", 2], ["Cara", null], ["Dan", 4]]
  );
});

test("a PIN is exactly four digits", () => {
  assert.equal(isValidPin("0000"), true);
  assert.equal(isValidPin("4821"), true);
  assert.equal(isValidPin("123"), false);
  assert.equal(isValidPin("12345"), false);
  assert.equal(isValidPin("12a4"), false);
  assert.equal(isValidPin(1234), false);
  assert.equal(isValidPin(undefined), false);
});

test("only the four real departments are accepted", () => {
  for (const department of ["engineering", "programming", "media", "marketing"]) {
    assert.equal(isVolunteerDepartment(department), true);
  }
  assert.equal(isVolunteerDepartment("Engineering"), false);
  assert.equal(isVolunteerDepartment("finance"), false);
  assert.equal(isVolunteerDepartment(null), false);
});

test("departments combine, and parseDepartments refuses the rest", () => {
  assert.deepEqual(parseDepartments([]), []);
  assert.deepEqual(parseDepartments(["media"]), ["media"]);
  // A volunteer can hold several — the whole point of the array.
  assert.deepEqual(parseDepartments(["media", "engineering"]), [
    "engineering",
    "media",
  ]);
  // Canonical order and no duplicates, whatever came in.
  assert.deepEqual(parseDepartments(["marketing", "engineering", "marketing"]), [
    "engineering",
    "marketing",
  ]);
  assert.equal(parseDepartments(["media", "catering"]), null);
  assert.equal(parseDepartments("media"), null);
  assert.equal(parseDepartments(null), null);
});

test("departments read as a list, and say something when empty", () => {
  assert.equal(departmentLabel([]), "No department");
  assert.equal(departmentLabel(null), "No department");
  assert.equal(departmentLabel(["programming"]), "Programming");
  assert.equal(
    departmentLabel(["media", "engineering"]),
    "Engineering · Media"
  );
  // An unknown slug left over in a row must not render as a blank chip.
  assert.equal(departmentLabel(["catering"]), "No department");
});
