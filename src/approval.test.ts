import { describe, expect, it } from "vitest";
import { checkApproved, escalatePending } from "./approval.ts";
import { runChecks } from "./checks.ts";
import { parseIR } from "./parse.ts";
import type { Finding, Model } from "./types.ts";

function irWith(source: string, outcome = "B is shown"): string {
  return `
usecase: UC-TEST-001
name: Test
source: ${source}
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
events:
  - { id: go, actor: operator }
transitions:
  - from: A
    on: go
    to: B
    outcome: ["${outcome}"]
scenarios:
  - { id: SC-001, name: happy path, path: [go] }
`;
}

const APPROVED_SOURCE = `
  spec: "https://example.com/spec"
  version: "2026-10-20T09:00:00.000Z"
  approval:
    approved_by: "spec owner"
    approved_at: "2026-10-21"
    record: "https://example.com/issues/1#comment-abc"`;

function model(source: string): Model {
  const { model, findings } = parseIR(source);
  if (!model) throw new Error(`could not parse the IR: ${JSON.stringify(findings)}`);
  return model;
}

function approvalErrors(source: string, file: string): string[] {
  return checkApproved(model(source), file).map((f) => f.message);
}

describe("checkApproved", () => {
  it("accepts an IR with an approval record, a spec version and a file name matching the usecase id", () => {
    expect(approvalErrors(irWith(APPROVED_SOURCE), "orders/UC-TEST-001.usecase.yaml")).toEqual([]);
  });

  it("rejects a file name that differs from the usecase id", () => {
    expect(approvalErrors(irWith(APPROVED_SOURCE), "orders/cancel.usecase.yaml")).toEqual([
      "the file name must match the usecase id: UC-TEST-001.usecase.yaml",
    ]);
  });

  it("rejects an IR without an approval record", () => {
    expect(
      approvalErrors(irWith(`{ spec: "https://example.com/spec", version: "v1" }`), "UC-TEST-001.usecase.yaml"),
    ).toEqual(["source.approval (approved_by / approved_at / record) is required"]);
  });

  it("reports each missing piece of the spec version and the approval record", () => {
    const errors = approvalErrors(
      irWith(`
  spec: "https://example.com/spec"
  approval:
    approved_at: "10/21"
    record: "issue comment"`),
      "UC-TEST-001.usecase.yaml",
    );
    expect(errors).toHaveLength(4);
    expect(errors.join("\n")).toMatch(/source\.version/);
    expect(errors.join("\n")).toMatch(/approved_by/);
    expect(errors.join("\n")).toMatch(/approved_at/);
    expect(errors.join("\n")).toMatch(/record/);
  });

  it("rejects audit fields that are not strings", () => {
    const errors = approvalErrors(
      irWith(`
  spec: "https://example.com/spec"
  version: 20261020
  approval:
    approved_by: 123
    approved_at: {}
    record: ["https://example.com/issues/1"]`),
      "UC-TEST-001.usecase.yaml",
    );
    expect(errors).toHaveLength(4);
  });

  it("rejects an approval that is not a mapping", () => {
    expect(
      approvalErrors(
        irWith(`{ spec: "https://example.com/spec", version: "v1", approval: "approved" }`),
        "UC-TEST-001.usecase.yaml",
      ),
    ).toEqual(["source.approval (approved_by / approved_at / record) is required"]);
  });
});

describe("escalatePending", () => {
  it("turns unanswered question markers into errors and leaves other warnings alone", () => {
    const m = model(irWith(APPROVED_SOURCE, "TBD: the displayed text"));
    const before = runChecks(m);
    expect(before.some((f) => f.check === "pending" && f.level === "warn")).toBe(true);
    const after: Finding[] = escalatePending([...before, { level: "warn", check: "races", message: "other" }]);
    expect(after.filter((f) => f.check === "pending").every((f) => f.level === "error")).toBe(true);
    expect(after.find((f) => f.check === "races")?.level).toBe("warn");
  });
});
