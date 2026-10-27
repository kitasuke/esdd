import { describe, expect, it } from "vitest";
import { renderDigest } from "./digest.ts";
import { parseIR } from "./parse.ts";
import type { Model } from "./types.ts";

function model(source: string): Model {
  const { model, findings } = parseIR(source);
  if (!model) throw new Error(`could not parse the IR: ${JSON.stringify(findings)}`);
  return model;
}

const STATE_MACHINE = `
usecase: UC-TEST-001
name: Order
source: { spec: "https://example.com/spec", version: "v1" }
initial: A
states:
  - { id: A, label: waiting }
  - { id: B, terminal: true }
events:
  - { id: go, label: proceed, actor: operator }
  - { id: back, actor: customer }
transitions:
  - from: A
    on: go
    to: B
    outcome: ["B is reached", { surface: WEB, ui: "\\"Done\\" is shown" }]
  - from: A
    on: back
    impossible: true
    reason: a waiting order cannot go back
scenarios:
  - { id: SC-001, name: proceed, path: [go], critical: true }
`;

const STATELESS = `
usecase: UC-TEST-002
name: Totals
source: { spec: "https://example.com/spec" }
inputs:
  - { id: amount, kind: option, conditions: [zero, negative, large], na: { negative: cannot happen } }
rules:
  - id: RULE-001
    name: display
    cases:
      - { input: { amount: zero }, expected: shows 0 ASSUMED(W1), covers: amount×zero }
scenarios:
  - id: SC-001
    name: total is shown
    given: [two orders exist]
    when: [open the list]
    then:
      - "the total shows $9,000"
      - the discount shows $0
assumptions:
  - { id: W1, question: how zero is shown, proposal: "0", basis: the neighboring column }
`;

describe("renderDigest", () => {
  it("lists each state's events with their target and outcomes, and the reason for impossible cells", () => {
    const digest = renderDigest(model(STATE_MACHINE));
    expect(digest).toContain("### A (waiting) — initial");
    expect(digest).toContain('- **go (proceed) [operator]** → B\n  - B is reached\n  - [WEB] "Done" is shown');
    expect(digest).toContain("- back [customer]: impossible — a waiting order cannot go back");
  });

  it("puts each list item on its own line and never joins items with a comma", () => {
    const digest = renderDigest(model(STATELESS));
    expect(digest).toContain("- then\n  - the total shows $9,000\n  - the discount shows $0");
    expect(digest).toContain("- cases[0] amount: zero\n  - shows 0 ASSUMED(W1)");
  });

  it("tables every input cell with the case that covers it, its not-applicable reason, or that it is not covered", () => {
    const digest = renderDigest(model(STATELESS));
    expect(digest).toContain("| amount | zero | RULE-001.cases[0] |");
    expect(digest).toContain("| amount | negative | not applicable — cannot happen |");
    expect(digest).toContain("| amount | large | **not covered** |");
  });

  it("tables the assumptions that approving accepts", () => {
    const digest = renderDigest(model(STATELESS));
    expect(digest).toContain("## Assumptions (accepted by approving)");
    expect(digest).toContain("| W1 | how zero is shown | 0 | the neighboring column |");
  });

  it("renders the same IR to the same digest, so two approvals can be diffed", () => {
    expect(renderDigest(model(STATELESS))).toBe(renderDigest(model(STATELESS)));
    expect(renderDigest(model(STATE_MACHINE))).toContain("## Assumptions\n\nnone");
  });
});
