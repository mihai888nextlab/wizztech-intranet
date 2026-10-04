import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  blockMessage,
  isFull,
  MAX_CAPACITY,
  parseCapacity,
  parseEventRules,
  parseExclusionIds,
  spotsLeft,
} from "@/lib/events";

/*
  Two rules gate a sign-in, and both are off a request body, so the parsing is
  what stands between a typo and an event nobody can join.
*/

test("an empty participant limit means no limit", () => {
  for (const blank of [undefined, null, ""]) {
    assert.deepEqual(parseCapacity(blank), { ok: true, value: null });
  }
});

test("a participant limit must be a whole number of at least one", () => {
  assert.deepEqual(parseCapacity(20), { ok: true, value: 20 });
  // The form sends strings.
  assert.deepEqual(parseCapacity("20"), { ok: true, value: 20 });
  assert.deepEqual(parseCapacity(" 7 "), { ok: true, value: 7 });
  assert.equal(parseCapacity(0).ok, false);
  assert.equal(parseCapacity(-5).ok, false);
  assert.equal(parseCapacity(2.5).ok, false);
  assert.equal(parseCapacity("abc").ok, false);
  assert.equal(parseCapacity(MAX_CAPACITY).ok, true);
  assert.equal(parseCapacity(MAX_CAPACITY + 1).ok, false);
});

test("exclusions are ids, deduplicated, and never the event itself", () => {
  assert.deepEqual(parseExclusionIds(undefined), { ok: true, value: [] });
  assert.deepEqual(parseExclusionIds([3, 1]), { ok: true, value: [3, 1] });
  assert.deepEqual(parseExclusionIds(["3", "1"]), { ok: true, value: [3, 1] });
  // Ticking the same event twice is the same rule.
  assert.deepEqual(parseExclusionIds([3, 3]), { ok: true, value: [3] });
  // Excluding its own attendees says nothing — you can't attend twice anyway.
  assert.equal(parseExclusionIds([3, 7], 7).ok, false);
  assert.equal(parseExclusionIds([0]).ok, false);
  assert.equal(parseExclusionIds([-1]).ok, false);
  assert.equal(parseExclusionIds(["x"]).ok, false);
  assert.equal(parseExclusionIds("3").ok, false);
});

test("both rules come off one body, and a bad one refuses the lot", () => {
  assert.deepEqual(parseEventRules({ capacity: "12", exclusionEventIds: [4] }), {
    ok: true,
    value: { capacity: 12, exclusionIds: [4] },
  });
  // An event with neither rule is the default, not an error.
  assert.deepEqual(parseEventRules({}), {
    ok: true,
    value: { capacity: null, exclusionIds: [] },
  });
  assert.equal(parseEventRules({ capacity: 0 }).ok, false);
  assert.equal(parseEventRules({ exclusionEventIds: [9] }, 9).ok, false);
});

test("places left never goes negative, and null means uncapped", () => {
  assert.equal(spotsLeft(null, 50), null);
  assert.equal(spotsLeft(20, 0), 20);
  assert.equal(spotsLeft(20, 19), 1);
  assert.equal(spotsLeft(20, 20), 0);
  // The capacity can be lowered under a roster that already exceeds it.
  assert.equal(spotsLeft(20, 25), 0);
});

test("an uncapped event is never full, and a capped one is at the line", () => {
  assert.equal(isFull(null, 10_000), false);
  assert.equal(isFull(20, 19), false);
  assert.equal(isFull(20, 20), true);
  assert.equal(isFull(20, 21), true);
});

test("a refusal names the event that caused it", () => {
  assert.equal(blockMessage({ reason: "full" }), "This event is full.");
  assert.equal(
    blockMessage({ reason: "excluded", events: ["Saturday session"] }),
    "You can't sign in because you attended Saturday session."
  );
  assert.equal(
    blockMessage({ reason: "excluded", events: ["Saturday", "Sunday"] }),
    "You can't sign in because you attended Saturday and Sunday."
  );
  // Past two it stops listing rather than running on.
  assert.equal(
    blockMessage({ reason: "excluded", events: ["A", "B", "C"] }),
    "You can't sign in because you attended A and 2 other events."
  );
});
