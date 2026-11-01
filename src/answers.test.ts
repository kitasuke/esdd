import { describe, expect, it } from "vitest";
import { applyAnswers, parseLedger } from "./answers.ts";
import { checkPending } from "./checks.ts";
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
    expect(applied).toContainEqual({ id: "Q1", kind: "replaced_pending", places: 2 });
  });

  it("replaces the applied text of a replaced assumption and removes its declaration; an accepted one stands", () => {
    const { source, applied } = applyAnswers(IR, ledger(LEDGER));
    expect(source).toContain('"the request is kept ASSUMED(W1)"');
    expect(source).toContain('"nothing is shown: the customer finds out on the next visit"');
    expect(source).not.toContain("ASSUMED(W2)");
    expect(source).toContain("{ id: W1,");
    expect(source).not.toContain("{ id: W2,");
    expect(applied).toContainEqual({ id: "W1", kind: "accepted", places: 1 });
    expect(applied).toContainEqual({ id: "W2", kind: "replaced_assumption", places: 1, declaration_removed: true });
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
});
