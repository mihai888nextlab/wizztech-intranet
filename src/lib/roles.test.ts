import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  canEditFinance,
  canManageVolunteers,
  isAccountType,
  isAdmin,
  isOrganizer,
  isTeamRole,
  isVolunteer,
  parseRoles,
  roleSummary,
} from "@/lib/roles";

/*
  Roles are a set, so the thing worth pinning is that holding one job never
  quietly grants another — and that admin grants all of them.
*/

test("each role grants only its own job", () => {
  assert.equal(isOrganizer(["organizer"]), true);
  assert.equal(canEditFinance(["organizer"]), false);
  assert.equal(canManageVolunteers(["organizer"]), false);

  assert.equal(canEditFinance(["finance"]), true);
  assert.equal(isOrganizer(["finance"]), false);

  assert.equal(canManageVolunteers(["coordinator"]), true);
  assert.equal(isOrganizer(["coordinator"]), false);
  assert.equal(canEditFinance(["coordinator"]), false);
});

test("admin holds everything", () => {
  assert.equal(isAdmin(["admin"]), true);
  assert.equal(isOrganizer(["admin"]), true);
  assert.equal(canEditFinance(["admin"]), true);
  assert.equal(canManageVolunteers(["admin"]), true);
});

test("a plain member holds nothing", () => {
  for (const roles of [[], undefined]) {
    assert.equal(isAdmin(roles), false);
    assert.equal(isOrganizer(roles), false);
    assert.equal(canEditFinance(roles), false);
    assert.equal(canManageVolunteers(roles), false);
  }
});

test("roles combine — the whole point of the array", () => {
  const roles = ["organizer", "coordinator"];
  assert.equal(isOrganizer(roles), true);
  assert.equal(canManageVolunteers(roles), true);
  assert.equal(canEditFinance(roles), false);
  assert.equal(isAdmin(roles), false);
});

test("a volunteer is an account type, never a role", () => {
  assert.equal(isVolunteer("volunteer"), true);
  assert.equal(isVolunteer("member"), false);
  assert.equal(isVolunteer(undefined), false);
  // "volunteer" was a role before the split; it must not be one now.
  assert.equal(isTeamRole("volunteer"), false);
  assert.equal(isTeamRole("member"), false);
  assert.equal(isAccountType("organizer"), false);
});

test("parseRoles refuses anything it doesn't recognise", () => {
  assert.deepEqual(parseRoles([]), []);
  assert.deepEqual(parseRoles(["admin"]), ["admin"]);
  assert.equal(parseRoles(["admin", "wizard"]), null);
  assert.equal(parseRoles(["volunteer"]), null);
  assert.equal(parseRoles("admin"), null);
  assert.equal(parseRoles(undefined), null);
});

test("parseRoles returns the canonical order and drops duplicates", () => {
  assert.deepEqual(parseRoles(["admin", "organizer"]), ["organizer", "admin"]);
  assert.deepEqual(parseRoles(["finance", "finance"]), ["finance"]);
});

test("roleSummary always says something", () => {
  assert.equal(roleSummary("member", []), "Member");
  assert.equal(roleSummary("volunteer", []), "Volunteer");
  assert.equal(roleSummary("member", ["admin"]), "Admin");
  assert.equal(
    roleSummary("member", ["coordinator", "organizer"]),
    "Organizer · Volunteer coordinator"
  );
});
