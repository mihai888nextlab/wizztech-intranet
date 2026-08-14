import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseFieldOptions,
  parseFormRequestInput,
  parseFormValuesInput,
} from "./form-requests";

describe("parseFieldOptions", () => {
  it("parses a JSON array of options", () => {
    assert.deepEqual(parseFieldOptions('["S","M","L"]'), ["S", "M", "L"]);
  });

  it("falls back to comma-separated text", () => {
    assert.deepEqual(parseFieldOptions("S, M, L"), ["S", "M", "L"]);
  });

  it("returns empty for null or blank", () => {
    assert.deepEqual(parseFieldOptions(null), []);
    assert.deepEqual(parseFieldOptions(""), []);
  });
});

describe("parseFormRequestInput", () => {
  const valid = {
    title: "Emergency contact",
    description: "Use a parent's number",
    audience: "all",
    dueDate: "2026-09-01",
    fields: [
      { label: "Phone", type: "text", required: true },
      { label: "Shirt size", type: "select", required: true, options: ["S", "M", "L"] },
    ],
  };

  it("accepts a valid request and trims text", () => {
    const parsed = parseFormRequestInput(valid);
    assert.ok(parsed.ok);
    assert.equal(parsed.value.title, "Emergency contact");
    assert.equal(parsed.value.description, "Use a parent's number");
    assert.equal(parsed.value.audience, "all");
    assert.equal(parsed.value.fields.length, 2);
  });

  it("rejects a missing title", () => {
    const parsed = parseFormRequestInput({ ...valid, title: "  " });
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, "Title is required");
  });

  it("requires assignees when the audience is selected", () => {
    const parsed = parseFormRequestInput({
      ...valid,
      audience: "selected",
      assigneeIds: [],
    });
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, "Select at least one member");
  });

  it("deduplicates assignee ids", () => {
    const parsed = parseFormRequestInput({
      ...valid,
      audience: "selected",
      assigneeIds: [1, 1, 2],
    });
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value.assigneeIds, [1, 2]);
  });

  it("rejects a bad due date", () => {
    const parsed = parseFormRequestInput({ ...valid, dueDate: "next week" });
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, "Due date must be a calendar date");
  });

  it("rejects a request with no fields", () => {
    const parsed = parseFormRequestInput({ ...valid, fields: [] });
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, "Add at least one field");
  });

  it("rejects a select field with fewer than two options", () => {
    const parsed = parseFormRequestInput({
      ...valid,
      fields: [{ label: "Size", type: "select", required: true, options: ["S"] }],
    });
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, '"Size" needs at least two options');
  });

  it("coerces an unknown field type to text", () => {
    const parsed = parseFormRequestInput({
      ...valid,
      fields: [{ label: "Note", type: "weird", required: true }],
    });
    assert.ok(parsed.ok);
    assert.equal(parsed.value.fields[0].type, "text");
  });
});

describe("parseFormValuesInput", () => {
  const fields = [
    { id: 1, label: "Phone", type: "text" as const, required: true, options: [] },
    { id: 2, label: "Age", type: "number" as const, required: false, options: [] },
    { id: 3, label: "Size", type: "select" as const, required: true, options: ["S", "M"] },
  ];

  it("accepts valid values", () => {
    const parsed = parseFormValuesInput(
      { values: [{ fieldId: 1, value: "0712 345 678" }, { fieldId: 2, value: "17" }, { fieldId: 3, value: "M" }] },
      fields
    );
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value, [
      { fieldId: 1, value: "0712 345 678" },
      { fieldId: 2, value: "17" },
      { fieldId: 3, value: "M" },
    ]);
  });

  it("rejects a missing required field", () => {
    const parsed = parseFormValuesInput(
      { values: [{ fieldId: 3, value: "M" }] },
      fields
    );
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, '"Phone" is required');
  });

  it("rejects a non-numeric number", () => {
    const parsed = parseFormValuesInput(
      { values: [{ fieldId: 1, value: "x" }, { fieldId: 2, value: "seventeen" }] },
      fields
    );
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, '"Age" must be a number');
  });

  it("rejects an option not in the list", () => {
    const parsed = parseFormValuesInput(
      { values: [{ fieldId: 1, value: "x" }, { fieldId: 3, value: "XL" }] },
      fields
    );
    assert.ok(!parsed.ok);
    assert.equal(parsed.error, '"Size" has an invalid choice');
  });

  it("drops unknown fields", () => {
    const parsed = parseFormValuesInput(
      { values: [{ fieldId: 99, value: "nope" }, { fieldId: 1, value: "x" }, { fieldId: 3, value: "M" }] },
      fields
    );
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.value, [
      { fieldId: 1, value: "x" },
      { fieldId: 3, value: "M" },
    ]);
  });
});
