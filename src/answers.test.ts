import { afterEach, describe, expect, it } from "vitest";
import { applyAnswers, describeApplied, parseLedger } from "./answers.ts";
import { checkPending } from "./checks.ts";
import { configure } from "./config.ts";
import { parseIR } from "./parse.ts";

const IR = `
usecase: UC-TEST-001
name: Order
source: { spec: "https://example.com/spec", version: "v1" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
events:
  - { id: go, actor: customer }
  - { id: late, actor: system }
transitions:
  - from: A
    on: go
    to: B
    outcome: ["TBD(Q1: what is shown after go?)"]   # the owner has not said
  - from: A
    on: late
    to: A
    outcome: ["the request is kept ASSUMED(W1)", "a notice is shown ASSUMED(W2)"]
rules:
  - id: RULE-001
    name: amount
    cases:
      - { input: { amount: zero }, expected: "shows 0: TBD(Q1)" }
scenarios:
  - { id: SC-001, name: go, path: [go], critical: true }
assumptions:
  - { id: W1, question: Is a late request kept?, proposal: it is kept, basis: the existing late handling }
  - { id: W2, question: Is a notice shown?, proposal: a notice is shown, basis: the existing late handling }
`;

const LEDGER = `
answers:
  - { id: Q1, answer: "the order is marked done", by: owner, at: 2026-01-02 }
  - { id: W1, accepted: true, by: owner, at: 2026-01-02 }
  - { id: W2, answer: "nothing is shown: the customer finds out on the next visit", by: owner, at: 2026-01-02 }
  - { id: Q9, answer: "an answer nothing refers to" }
`;

function ledger(source: string) {
  const { ledger, errors } = parseLedger(source);
  if (!ledger) throw new Error(errors.join(" / "));
  return ledger;
}

describe("parseLedger", () => {
  it("requires an id and either an answer or accepted: true", () => {
    const { errors } = parseLedger("answers:\n  - { answer: x }\n  - { id: Q1 }\n  - { id: Q1, answer: a, accepted: true }\n");
    expect(errors).toEqual([
      "answers[0]: id is required (the question id, e.g. Q4 or W7)",
      "answers[1] (Q1): give an answer, or accepted: true for an assumption that stands",
      "answers[2]: duplicate answer for Q1",
      "answers[2] (Q1): either an answer or accepted: true, not both",
    ]);
    expect(parseLedger("answers: 3\n").errors).toEqual(["ledger: answers must be a list"]);
  });
});

describe("applyAnswers", () => {
  it("replaces every TBD of an answered question, keeps the text around it, and keeps the comment", () => {
    const { source, applied } = applyAnswers(IR, ledger(LEDGER));
    expect(source).toContain('outcome: [ "the order is marked done" ] # the owner has not said');
    expect(source).toContain('expected: "shows 0: the order is marked done"');
    expect(source).not.toContain("TBD(");
    expect(applied).toContainEqual({
      id: "Q1",
      kind: "replaced_pending",
      places: 2,
      replaced: [
        { at: "transitions[0].outcome[0]", before: "TBD(Q1: what is shown after go?)", after: "the order is marked done" },
        { at: "rules[RULE-001].cases[0].expected", before: "shows 0: TBD(Q1)", after: "shows 0: the order is marked done" },
      ],
    });
  });

  it("replaces the applied text of a replaced assumption and removes its declaration; an accepted one stands", () => {
    const { source, applied } = applyAnswers(IR, ledger(LEDGER));
    expect(source).toContain('"the request is kept ASSUMED(W1)"');
    expect(source).toContain('"nothing is shown: the customer finds out on the next visit"');
    expect(source).not.toContain("ASSUMED(W2)");
    expect(source).toContain("{ id: W1,");
    expect(source).not.toContain("{ id: W2,");
    expect(applied).toContainEqual({ id: "W1", kind: "accepted", places: 1, replaced: [] });
    expect(applied).toContainEqual({
      id: "W2",
      kind: "replaced_assumption",
      places: 1,
      declaration_removed: true,
      replaced: [{ at: "transitions[1].outcome[1]", before: "a notice is shown ASSUMED(W2)", after: "nothing is shown: the customer finds out on the next visit" }],
    });
  });

  it("names the ledger ids no marker refers to", () => {
    expect(applyAnswers(IR, ledger(LEDGER)).unmatched).toEqual(["Q9"]);
  });

  it("leaves an IR the checker still parses, with the pending warns gone", () => {
    const before = parseIR(IR);
    expect(checkPending(before.model!).length).toBeGreaterThan(0);
    const { model, findings } = parseIR(applyAnswers(IR, ledger(LEDGER)).source);
    expect(findings.filter((f: { level: string }) => f.level === "error")).toEqual([]);
    expect(checkPending(model!)).toEqual([]);
  });

  it("drops the assumptions key when the last declaration goes", () => {
    const { source } = applyAnswers(IR, ledger("answers:\n  - { id: W1, answer: dropped }\n  - { id: W2, answer: dropped }\n"));
    expect(source).not.toContain("assumptions:");
  });
  it("lists each place a replaced assumption's one answer went into, with the text it had", () => {
    const ir = IR.replace('"a notice is shown ASSUMED(W2)"', '"a notice is shown ASSUMED(W1)"');
    const result = applyAnswers(ir, ledger("answers:\n  - { id: W1, answer: the request is dropped }\n"));
    const lines = describeApplied("t.yaml", result);
    expect(lines).toEqual([
      "t.yaml:",
      "  W1: proposal replaced by the answer — 2 places, declaration removed; the same answer went into each — check it holds in every place:",
      '    transitions[1].outcome[0]: was "the request is kept ASSUMED(W1)"',
      '    transitions[1].outcome[1]: was "a notice is shown ASSUMED(W1)"',
    ]);
  });
});

describe("applyAnswers with the project's pending markers", () => {
  afterEach(() => configure({}));

  const CONFIGURED = IR.replace("TBD(Q1: what is shown after go?)", "OPEN(Q1)");

  it("replaces a configured marker as it replaces TBD", () => {
    configure({ pendingMarkers: ["OPEN"] });
    const { ledger } = parseLedger(LEDGER);
    const result = applyAnswers(CONFIGURED, ledger!);
    expect(result.source).not.toContain("OPEN(Q1)");
    expect(result.applied.find((a) => a.id === "Q1")?.places).toBe(2);
  });

  it("leaves a marker the project did not configure", () => {
    const { ledger } = parseLedger(LEDGER);
    const result = applyAnswers(CONFIGURED, ledger!);
    expect(result.source).toContain("OPEN(Q1)");
  });
});
