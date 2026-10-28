import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runChecks } from "./checks.ts";
import { parseIR } from "./parse.ts";
import { suggestPaths } from "./paths.ts";
import type { Finding } from "./types.ts";

const PILOT = join(
  import.meta.dirname,
  "../examples/order-cancel.usecase.yaml",
);

function check(source: string): Finding[] {
  const { model, findings } = parseIR(source);
  if (!model) return findings;
  return [...findings, ...runChecks(model)];
}

function errorsOf(findings: Finding[], checkName?: string): Finding[] {
  return findings.filter(
    (f) => f.level === "error" && (!checkName || f.check === checkName),
  );
}

const MINIMAL = `
usecase: UC-TEST-001
name: Test
source: { spec: "https://example.com" }
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
    outcome: ["reaches B"]
scenarios:
  - { id: SC-001, name: happy path, path: [go] }
`;

describe("parse + checks", () => {
  it("a minimal valid IR passes all checks", () => {
    expect(check(MINIMAL)).toEqual([]);
  });

  it("the example (order cancellation) passes all checks", () => {
    const findings = check(readFileSync(PILOT, "utf8"));
    expect(errorsOf(findings)).toEqual([]);
    expect(findings.filter((f) => f.level === "warn")).toEqual([]);
  });

  it("exhaustiveness: reports undeclared cells as errors", () => {
    const src = MINIMAL.replace(
      "events:",
      `events:
  - { id: stop, actor: staff }`,
    );
    const findings = check(src);
    // A × stop is undeclared
    expect(errorsOf(findings, "exhaustiveness").length).toBe(1);
    expect(errorsOf(findings, "exhaustiveness")[0]!.message).toContain("A × stop");
  });

  it("determinism: reports duplicate declarations for the same cell as errors", () => {
    const src = MINIMAL.replace(
      "scenarios:",
      `  - from: A
    on: go
    impossible: true
    reason: duplicate for the test
scenarios:`,
    );
    expect(errorsOf(check(src), "determinism").length).toBe(1);
  });

  it("reachability: reports unreachable states as errors", () => {
    const src = MINIMAL.replace(
      "events:",
      `  - { id: ORPHAN }
events:`,
    );
    const findings = check(src);
    expect(errorsOf(findings, "reachability").some((f) => f.message.includes("ORPHAN"))).toBe(
      true,
    );
  });

  it("escapability: reports states that cannot reach a terminal as errors", () => {
    const src = `
usecase: UC-TEST-002
name: Dead-end test
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: TRAP }
  - { id: B, terminal: true }
events:
  - { id: go, actor: operator }
  - { id: fall, actor: operator }
transitions:
  - { from: A, on: go, to: B, outcome: ["reaches B"] }
  - { from: A, on: fall, to: TRAP, outcome: ["reaches TRAP"] }
  - { from: TRAP, on: [go, fall], impossible: true, reason: no way out }
scenarios:
  - { id: SC-001, name: happy path, path: [go] }
`;
    const findings = check(src);
    expect(errorsOf(findings, "escapability").some((f) => f.message.includes("TRAP"))).toBe(
      true,
    );
  });

  it("race obligation: requires a races declaration for event pairs of different actors", () => {
    const src = `
usecase: UC-TEST-003
name: Race test
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
  - { id: C, terminal: true }
events:
  - { id: accept, actor: staff }
  - { id: cancel, actor: operator }
transitions:
  - { from: A, on: accept, to: B, outcome: ["reaches B"] }
  - { from: A, on: cancel, to: C, outcome: ["reaches C"] }
scenarios:
  - { id: SC-001, name: accepted, path: [accept] }
  - { id: SC-002, name: canceled, path: [cancel] }
`;
    const findings = check(src);
    expect(errorsOf(findings, "races").length).toBe(1);
    // declaring the race makes it pass
    const declared = src.replace(
      "scenarios:",
      `races:
  - { state: A, between: [accept, cancel], winner: cancel, outcome: ["reaches C"] }
scenarios:`,
    );
    expect(errorsOf(check(declared), "races")).toEqual([]);
  });

  it("races: one declaration can name several states, and one event against every event of another actor", () => {
    const src = `
usecase: UC-TEST-008
name: trip
source: { spec: "https://example.com" }
initial: GOING
states:
  - { id: GOING }
  - { id: THERE }
  - { id: DONE, terminal: true }
  - { id: CANCELED, terminal: true }
events:
  - { id: arrive, actor: driver }
  - { id: finish, actor: driver }
  - { id: expire, actor: system }
  - { id: cancel, actor: operator }
transitions:
  - { from: GOING, on: arrive, to: THERE, outcome: ["there"] }
  - { from: THERE, on: finish, to: DONE, outcome: ["done"] }
  - { from: GOING, on: expire, to: CANCELED, outcome: ["expired"] }
  - { from: [GOING, THERE], on: cancel, to: CANCELED, outcome: ["canceled"] }
  - { from: GOING, on: finish, impossible: true, reason: "not there yet" }
  - { from: THERE, on: [arrive, expire], impossible: true, reason: "already there" }
races:
RACES
scenarios:
  - { id: SC-001, name: trip, path: [arrive, finish] }
`;
    const run = (races: string) => {
      const { model, findings } = parseIR(src.replace("RACES", races));
      return { model, errors: errorsOf([...findings, ...(model ? runChecks(model) : [])]) };
    };
    // cancel vs every driver event: arrive in GOING, finish in THERE. expire is the system's, left out by against
    const driver = run(`  - { state: [GOING, THERE], between: [cancel], against: driver, winner: cancel, outcome: ["canceled"] }
  - { state: GOING, between: [arrive, expire], winner: first, outcome: ["first wins"] }`);
    expect(driver.model!.ir.races!.map((r) => `${r.state} ${r.between.join("×")} ${r.declaration}`)).toEqual([
      "GOING cancel×arrive 0",
      "THERE cancel×finish 0",
      "GOING arrive×expire 1",
    ]);
    expect(driver.errors.map((f) => f.message)).toEqual([
      'GOING: system\'s expire and operator\'s cancel can race. Declare in races "if they happen almost simultaneously, which one wins, and what does the user see?"',
    ]);
    // without against, cancel races the system's expire too, and nothing is left undeclared
    expect(
      run(`  - { state: [GOING, THERE], between: [cancel], winner: cancel, outcome: ["canceled"] }
  - { state: GOING, between: [arrive, expire], winner: first, outcome: ["first wins"] }`).errors,
    ).toEqual([]);
    // the same race declared twice, and a winner outside the one event
    expect(
      run(`  - { state: [GOING, THERE], between: [cancel], winner: cancel, outcome: ["canceled"] }
  - { state: GOING, between: [arrive, cancel], winner: cancel, outcome: ["canceled"] }
  - { state: GOING, between: [arrive, expire], winner: first, outcome: ["first wins"] }`).errors.map((f) => f.message),
    ).toEqual(["races[1]: arrive vs cancel in GOING is already declared in races[0]"]);
    expect(run(`  - { state: GOING, between: [cancel], winner: arrive, outcome: ["x"] }`).errors.map((f) => f.message)).toEqual([
      "races[0]: winner must be cancel or first",
    ]);
  });

  it("races: winner: first declares a race decided by arrival order; an event outside between cannot win", () => {
    const src = `
usecase: UC-TEST-003
name: race
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
  - { id: C, terminal: true }
events:
  - { id: accept, actor: driver }
  - { id: cancel, actor: operator }
transitions:
  - { from: A, on: accept, to: B, outcome: ["B is reached"] }
  - { from: A, on: cancel, to: C, outcome: ["C is reached"] }
races:
  - { state: A, between: [accept, cancel], winner: WINNER, outcome: ["the first to arrive decides"] }
scenarios:
  - { id: SC-001, name: accept, path: [accept] }
  - { id: SC-002, name: cancel, path: [cancel] }
`;
    expect(errorsOf(check(src.replace("WINNER", "first")), "races")).toEqual([]);
    expect(errorsOf(check(src.replace("WINNER", "other")), "races").length).toBe(1);
  });

  it("ignored: an event that arrives but changes nothing needs only a reason and creates no race or coverage obligation", () => {
    const src = `
usecase: UC-TEST-003
name: ignore
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
events:
  - { id: accept, actor: driver }
  - { id: resend, actor: system }
transitions:
  - { from: A, on: accept, to: B, outcome: ["B is reached"] }
  - { from: A, on: resend, ignored: true, reason: a resent notice is ignored }
scenarios:
  - { id: SC-001, name: accept, path: [accept] }
`;
    expect(check(src).filter((f) => f.level === "error")).toEqual([]);
    expect(check(src).filter((f) => f.check === "coverage")).toEqual([]);
    const withOutcome = src.replace("ignored: true, reason: a resent notice is ignored", "ignored: true, to: A, outcome: [unchanged]");
    expect(errorsOf(check(withOutcome), "structure").map((f) => f.message)).toEqual([
      "transitions[1]: ignored requires a reason",
      "transitions[1]: ignored cannot be combined with to/outcome",
    ]);
  });

  it("path validity: reports unexecutable paths as errors", () => {
    const src = MINIMAL.replace("path: [go]", "path: [go, go]");
    const findings = check(src);
    expect(errorsOf(findings, "paths").length).toBe(1);
  });

  it("coverage: reports unexercised transitions as warns", () => {
    const src = `
usecase: UC-TEST-004
name: Coverage test
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
  - { id: C, terminal: true }
events:
  - { id: go, actor: operator }
  - { id: alt, actor: operator }
transitions:
  - { from: A, on: go, to: B, outcome: ["reaches B"] }
  - { from: A, on: alt, to: C, outcome: ["reaches C"] }
scenarios:
  - { id: SC-001, name: happy path, path: [go] }
`;
    const findings = check(src);
    const warns = findings.filter((f) => f.level === "warn" && f.check === "coverage");
    expect(warns.length).toBe(1);
    expect(warns[0]!.message).toContain("A × alt");
  });

  it("path suggestion: proposes paths that exercise uncovered transitions", () => {
    const { model } = parseIR(`
usecase: UC-TEST-005
name: Suggestion test
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B }
  - { id: DONE, terminal: true }
events:
  - { id: next, actor: operator }
  - { id: finish, actor: operator }
transitions:
  - { from: A, on: next, to: B, outcome: ["reaches B"] }
  - { from: A, on: finish, impossible: true, reason: must go through B }
  - { from: B, on: next, impossible: true, reason: one-shot }
  - { from: B, on: finish, to: DONE, outcome: ["done"] }
scenarios:
  - { id: SC-001, name: partway, path: [next] }
`);
    const paths = suggestPaths(model!);
    // B → finish is uncovered. The suggestion is an executable sequence from initial
    expect(paths.length).toBe(1);
    expect(paths[0]).toEqual(["next", "finish"]);
  });

  it("leftover TBD/TODO markers produce a pending warn", () => {
    const src = `
usecase: UC-TEST-007
name: Unanswered question test
source: { spec: "https://example.com" }
scenarios:
  - id: SC-001
    name: form submission
    given: [the form is open]
    when: [submit]
    then: [the completion screen is shown]
rules:
  - id: RULE-001
    name: option behavior
    cases:
      - { input: { notify: true }, expected: "TBD: notification target not specified in the spec" }
`;
    const findings = check(src);
    const pending = findings.filter((f) => f.check === "pending");
    expect(pending.length).toBe(1);
    expect(pending[0]!.level).toBe("warn");
    expect(pending[0]!.message).toContain("rules[RULE-001].cases[0]");
  });

  it("no markers means no pending findings", () => {
    const findings = check(readFileSync(PILOT, "utf8"));
    expect(findings.filter((f) => f.check === "pending")).toEqual([]);
  });

  it("inputs: uncovered cells become errors, worded as questions to the spec", () => {
    const src = `
usecase: UC-TEST-008
name: Input axis test
source: { spec: "https://example.com" }
inputs:
  - { id: customer, kind: field }
  - { id: arrival_notice, kind: option }
scenarios:
  - id: SC-001
    name: happy path
    given: [the form is open]
    when: [submit]
    then: [completes]
rules:
  - id: RULE-001
    name: validation
    cases:
      - { input: { field: customer, value: empty }, expected: shows an error, covers: customer×empty }
`;
    const findings = check(src);
    const errors = errorsOf(findings, "inputs").map((f) => f.message);
    // three cells are uncovered: customer×boundary / arrival_notice×default / arrival_notice×set
    expect(errors.length).toBe(3);
    expect(errors.some((m) => m.includes("customer × boundary"))).toBe(true);
    expect(errors.some((m) => m.includes("arrival_notice × default"))).toBe(true);
    expect(errors.some((m) => m.includes("arrival_notice × set"))).toBe(true);
  });

  it("inputs: passes when every cell takes a stance via na and covers", () => {
    const src = `
usecase: UC-TEST-009
name: Input axis test
source: { spec: "https://example.com" }
inputs:
  - id: customer
    kind: field
    na:
      boundary: selected from a list, so no boundary exists
  - id: arrival_notice
    kind: option
scenarios:
  - id: SC-001
    name: happy path
    given: [the form is open]
    when: [submit]
    then: [completes]
    covers: [arrival_notice×default]
rules:
  - id: RULE-001
    name: validation
    cases:
      - { input: { field: customer, value: empty }, expected: shows an error, covers: customer×empty }
      - { input: { option: arrival_notice, value: true }, expected: notice is sent, covers: arrival_notice×set }
`;
    const findings = check(src);
    expect(errorsOf(findings, "inputs")).toEqual([]);
  });

  it("inputs: typos in covers input ids and conditions become errors", () => {
    const src = `
usecase: UC-TEST-010
name: Input axis test
source: { spec: "https://example.com" }
inputs:
  - { id: customer, kind: field }
scenarios:
  - id: SC-001
    name: happy path
    given: [the form is open]
    when: [submit]
    then: [completes]
rules:
  - id: RULE-001
    name: validation
    cases:
      - { input: {}, expected: shows an error, covers: customer×emtpy }
      - { input: {}, expected: shows an error, covers: custmer×empty }
`;
    const errors = errorsOf(check(src), "inputs").map((f) => f.message);
    expect(errors.some((m) => m.includes('condition "emtpy"'))).toBe(true);
    expect(errors.some((m) => m.includes("not declared in inputs: custmer"))).toBe(true);
  });

  it("use cases without a state machine require given/when/then", () => {
    const src = `
usecase: UC-TEST-006
name: Form test
source: { spec: "https://example.com" }
scenarios:
  - { id: SC-001, name: success }
`;
    const findings = check(src);
    expect(errorsOf(findings, "structure").some((f) => f.message.includes("given"))).toBe(
      true,
    );
  });
});

describe("structure: comma splits in flow collections", () => {
  const STATELESS = (thenLine: string) => `
usecase: UC-TEST-001
name: Test
source: { spec: "https://example.com" }
scenarios:
  - id: SC-003
    name: running total
    given: [signed in]
    when: [opens the summary]
${thenLine}
`;

  it("reports an amount split by the comma", () => {
    const errors = errorsOf(
      check(STATELESS("    then: [the running total (pre-tax) shows $9,000]")),
      "structure",
    ).filter((f) => f.message.includes("split a number"));
    // the 000 split off is also a number, not a string, which is reported on its own
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain("scenarios[0] (SC-003).then[0..1]");
  });

  it("also checks transitions outcome and rules expected", () => {
    const src = MINIMAL.replace(
      'outcome: ["reaches B"]',
      "outcome: [the total shows 4,000 USD]",
    ).concat(`rules:
  - id: RULE-001
    name: rounding
    cases:
      - { input: 1, expected: [shows 1,500 USD] }
`);
    const messages = errorsOf(check(src), "structure").map((f) => f.message);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toContain("transitions[0].outcome[0..1]");
    expect(messages[1]).toContain(
      "rules[0] (RULE-001).cases[0].expected[0..1]",
    );
  });

  it("also checks races outcome", () => {
    const src = MINIMAL.concat(`races:
  - state: A
    between: [go, go]
    winner: go
    outcome: [the total shows 4,000 USD]
`);
    const messages = errorsOf(check(src), "structure").map((f) => f.message);
    expect(messages).toContainEqual(
      expect.stringContaining("races[0].outcome[0..1]: a comma"),
    );
  });

  it("reports items with an unclosed bracket pair", () => {
    const errors = errorsOf(
      check(STATELESS("    then: [the Done button (blue, enabled) is shown]")),
      "structure",
    );
    expect(errors.map((f) => f.message)).toEqual([
      expect.stringContaining(
        'then[0]: item "the Done button (blue" in the flow sequence [...] has an unclosed ()',
      ),
      expect.stringContaining("then[1]"),
    ]);
  });

  it("reports a value split inside a flow mapping", () => {
    const src = MINIMAL.replace(
      'outcome: ["reaches B"]',
      "outcome: [{ surface: WEB, ui: the total shows $9,000 }]",
    );
    const errors = errorsOf(check(src), "structure");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message).toContain(
      "transitions[0].outcome[0]: a comma split a value in the flow mapping",
    );
  });

  it("does not report block sequences, quoted strings or number lists", () => {
    const block = STATELESS(`    then:
      - the running total (pre-tax) shows $9,000`);
    const quoted = STATELESS(
      '    then: ["the running total (pre-tax) shows $9,000"]',
    );
    const separate = STATELESS("    then: [A is shown, B is shown]");
    const numbers = MINIMAL.concat(`rules:
  - id: RULE-001
    name: range
    cases:
      - { input: 1, expected: [1, 200] }
`);
    for (const src of [block, quoted, separate, numbers]) {
      expect(errorsOf(check(src))).toEqual([]);
    }
  });
});
