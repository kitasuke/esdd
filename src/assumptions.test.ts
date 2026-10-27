import { describe, expect, it } from "vitest";
import { checkApproved } from "./approval.ts";
import { checkAssumptions } from "./assumptions.ts";
import { runChecks } from "./checks.ts";
import { parseIR } from "./parse.ts";
import type { Model } from "./types.ts";

const ASSUMPTION = `
  - id: W4
    question: What does the customer see when the late request is rejected?
    proposal: "\\"This request can no longer be accepted\\" is shown"
    basis: the existing rejection message for expired requests`;

function ir(opts: { outcome?: string; assumptions?: string; approval?: string }): string {
  return `
usecase: UC-TEST-001
name: Test
source:
  spec: "https://example.com/spec"
  version: "2026-10-20"${opts.approval ?? ""}
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
events:
  - { id: go, actor: customer }
transitions:
  - from: A
    on: go
    to: B
    outcome: ["${opts.outcome ?? "B is shown"}"]
scenarios:
  - { id: SC-001, name: happy path, path: [go] }
${opts.assumptions ? `assumptions:${opts.assumptions}` : ""}
`;
}

function model(source: string): Model {
  const { model, findings } = parseIR(source);
  if (!model) throw new Error(`could not parse the IR: ${JSON.stringify(findings)}`);
  return model;
}

const messages = (src: string) => checkAssumptions(model(src)).map((f) => `${f.level}: ${f.message}`);

describe("checkAssumptions", () => {
  it("accepts a declared assumption that IR text marks with ASSUMED(<id>)", () => {
    expect(messages(ir({ outcome: "the rejection message is shown ASSUMED(W4)", assumptions: ASSUMPTION }))).toEqual([]);
  });

  it("does not raise a pending warning for an applied assumption (the IR is complete)", () => {
    const findings = runChecks(model(ir({ outcome: "the rejection message is shown ASSUMED(W4)", assumptions: ASSUMPTION })));
    expect(findings.filter((f) => f.check === "pending")).toEqual([]);
  });

  it("rejects a marker that points at an undeclared assumption", () => {
    expect(messages(ir({ outcome: "the rejection message is shown ASSUMED(W9)" }))).toEqual([
      "error: transitions[0]: ASSUMED(W9) refers to an assumption that is not declared in assumptions",
    ]);
  });

  it("warns about a declared assumption that no IR text uses", () => {
    expect(messages(ir({ assumptions: ASSUMPTION }))).toEqual([
      "warn: assumptions (W4): declared but no IR text carries ASSUMED(W4) — apply it or remove it",
    ]);
  });

  it("requires question, proposal and basis so the assumption can be reviewed", () => {
    const errors = messages(
      ir({ outcome: "x ASSUMED(W4)", assumptions: `
  - id: W4
    proposal: shown` }),
    );
    expect(errors).toHaveLength(2);
    expect(errors.join("\n")).toMatch(/question is required/);
    expect(errors.join("\n")).toMatch(/basis is required/);
  });

  it("rejects duplicate assumption ids", () => {
    expect(messages(ir({ outcome: "x ASSUMED(W4)", assumptions: ASSUMPTION + ASSUMPTION }))).toContain(
      "error: assumptions[1]: duplicate assumption id: W4",
    );
  });
});

describe("checkApproved with assumptions", () => {
  it("does not throw when assumptions is not a list; reports it as a finding", () => {
    const src = ir({ approval: approval("[W4]") }) + "\nassumptions: { W4: oops }\n";
    expect(() => checkApproved(model(src), "UC-TEST-001.usecase.yaml")).not.toThrow();
    expect(checkAssumptions(model(src)).map((f) => f.message)).toContain("assumptions must be a list");
  });

  const approval = (accepted?: string) => `
  approval:
    approved_by: "spec owner"
    approved_at: "2026-10-21"
    record: "https://example.com/issues/1#comment-1"${accepted ? `\n    assumptions_accepted: ${accepted}` : ""}`;
  const approvedErrors = (src: string) => checkApproved(model(src), "UC-TEST-001.usecase.yaml").map((f) => f.message);

  it("accepts an approval that names every applied assumption", () => {
    expect(
      approvedErrors(ir({ outcome: "x ASSUMED(W4)", assumptions: ASSUMPTION, approval: approval("[W4]") })),
    ).toEqual([]);
  });

  it("rejects an approval that does not accept an applied assumption", () => {
    expect(approvedErrors(ir({ outcome: "x ASSUMED(W4)", assumptions: ASSUMPTION, approval: approval() }))).toEqual([
      "assumption W4 is applied but not accepted: add it to source.approval.assumptions_accepted, or replace it with the owner's answer",
    ]);
  });

  it("rejects an approval that accepts an assumption the IR does not declare", () => {
    expect(approvedErrors(ir({ approval: approval("[W4]") }))).toEqual([
      "source.approval.assumptions_accepted names W4, which is not declared in assumptions",
    ]);
  });

  it("rejects assumptions_accepted that is not a list of ids", () => {
    expect(approvedErrors(ir({ approval: approval('"all"') }))).toEqual([
      "source.approval.assumptions_accepted must be a list of assumption ids",
    ]);
  });
});
