import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { checkScope, runChecks } from "./checks.ts";
import { renderDigest } from "./digest.ts";
import { parseIR } from "./parse.ts";
import { parseSteps, runStepsChecks } from "./steps.ts";
import { type Layer, runTrace, type TestCaseResult } from "./trace.ts";
import type { Finding, Model } from "./types.ts";

const RACY = `
usecase: UC-TEST-KIND
name: Rule kinds
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
races:
  - { state: A, between: [accept, cancel], winner: cancel, outcome: ["reaches C"] }
scenarios:
  - { id: SC-001, name: accepted, path: [accept] }
  - { id: SC-002, name: canceled, path: [cancel] }
`;

const NEVER_RULE = `rules:
  - id: RULE-001
    name: an item is never both accepted and canceled
    kind: never
    property: "an item never ends both accepted and canceled"
    cases:
      - { input: "cancel commits first", expected: "the item is canceled only" }
      - { input: "accept commits first", expected: "the item is accepted only" }
`;

function parsed(source: string): { model: Model; findings: Finding[] } {
  const { model, findings } = parseIR(source);
  if (!model) throw new Error(`parse failed: ${findings.map((f) => f.message).join("; ")}`);
  return { model, findings };
}

function check(source: string): Finding[] {
  const { model, findings } = parseIR(source);
  return model ? [...findings, ...runChecks(model)] : findings;
}

const ruleKinds = (findings: Finding[]) => findings.filter((f) => f.check === "rule-kinds");

describe("rule kinds", () => {
  it("declared races without a never rule ask what must never come out of them", () => {
    const findings = ruleKinds(check(RACY));
    expect(findings).toHaveLength(1);
    expect(findings[0]!.level).toBe("warn");
    expect(findings[0]!.message).toContain("what must never happen");
  });

  it("a never rule answers the question", () => {
    expect(ruleKinds(check(RACY + NEVER_RULE))).toEqual([]);
  });

  it("rule_kinds_na.never with a reason answers the question", () => {
    expect(ruleKinds(check(`${RACY}rule_kinds_na:\n  never: "the winner's outcome is the only result"\n`))).toEqual([]);
  });

  it("an IR without races is not asked", () => {
    const noRace = RACY.replace(/races:\n.*\n/, "");
    expect(ruleKinds(check(noRace))).toEqual([]);
  });

  it("shape: kind must be known, needs property, and rule_kinds_na needs known kinds with reasons", () => {
    const errors = (src: string) => check(src).filter((f) => f.level === "error").map((f) => f.message);
    expect(errors(RACY + NEVER_RULE.replace("kind: never", "kind: always"))).toEqual(
      expect.arrayContaining([expect.stringContaining("kind must be one of")]),
    );
    expect(errors(RACY + NEVER_RULE.replace(/ {4}property: .*\n/, ""))).toEqual(
      expect.arrayContaining([expect.stringContaining("needs property")]),
    );
    expect(errors(`${RACY}rule_kinds_na:\n  always: "x"\n  never: ""\n`)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("always is not a rule kind"),
        expect.stringContaining("rule_kinds_na.never: needs the reason"),
      ]),
    );
  });

  it("a rule of kind order needs cases for both directions even when its words do not say so", () => {
    const order = `${RACY}rule_kinds_na:\n  never: "x"\nrules:
  - id: RULE-002
    name: list
    kind: order
    property: "newer items come first"
    cases:
      - { input: "two items", expected: "the newer one first" }
      - { input: "one item", expected: "the item" }
`;
    expect(check(order).filter((f) => f.check === "rules" && f.message.includes("both directions"))).toHaveLength(1);
  });

  it("the digest shows a rule's kind and property for the approver", () => {
    expect(renderDigest(parsed(RACY + NEVER_RULE).model)).toContain("never: an item never ends both accepted and canceled");
  });
});

describe("check scope", () => {
  it("says what the run looked at and what it cannot see", () => {
    const scope = checkScope(parsed(RACY + NEVER_RULE).model);
    expect(scope.checked).toEqual([
      "state machine: 3 states × 2 events, 1 race(s) between two events",
      "rules: 1 with 2 case(s), kinds never",
      "scenarios: 2",
    ]);
    expect(scope.not_checked).toEqual(
      expect.arrayContaining([expect.stringContaining("the implementation"), "orders of more than two events"]),
    );
  });
});

describe("test layer of a rule's cases", () => {
  const tc = (node: string, layer: Layer): TestCaseResult => ({ layer, source: "x.xml", classname: "", name: `UC-TEST-KIND__${node}`, status: "Green" });
  const others = ["SC-001", "SC-002", "RACE-A-accept-cancel", "RACE-A-accept-cancel-outcome"].map((id) => tc(id, "backend"));
  const ruleKindWarns = (source: string, layer: Layer) =>
    runTrace(parsed(source).model, [...others, tc("RULE-001-c1", layer), tc("RULE-001-c2", layer)])
      .findings.filter((f) => f.check === "trace-rule-kind")
      .map((f) => f.message.split(" ")[0]);

  it("a server-kept rule (kind never) confirmed only by unit or fake-server tests is asked to move to backend", () => {
    expect(ruleKindWarns(RACY + NEVER_RULE, "unit")).toEqual(["RULE-001-c1", "RULE-001-c2"]);
    expect(ruleKindWarns(RACY + NEVER_RULE, "integration")).toEqual(["RULE-001-c1", "RULE-001-c2"]);
  });

  it("a server-kept rule confirmed at backend passes", () => {
    expect(ruleKindWarns(RACY + NEVER_RULE, "backend")).toEqual([]);
  });

  it("a rule without a kind, or of a client kind (limit / order), stays at unit", () => {
    expect(ruleKindWarns(RACY + NEVER_RULE.replace(/ {4}kind: never\n/, ""), "unit")).toEqual([]);
    expect(ruleKindWarns(RACY + NEVER_RULE.replace("kind: never", "kind: limit"), "unit")).toEqual([]);
  });

  it("step definitions do not need a pure function for a server-kept rule", () => {
    const examples = join(import.meta.dirname, "../examples");
    const read = (name: string) => readFileSync(join(examples, name), "utf8");
    const steps = parse(read("order-cancel.steps.yaml"));
    delete steps.rules["RULE-001"];
    const missing = (ir: string) => {
      const { doc } = parseSteps(stringify(steps));
      return runStepsChecks(doc!, { model: parsed(ir).model })
        .filter((f) => f.level === "error" && f.message.includes("RULE-001"))
        .map((f) => f.message);
    };
    const ir = read("order-cancel.usecase.yaml");
    expect(missing(ir)).toEqual(["rule RULE-001 has no step definition"]);
    const serverKept = ir.replace("    name: cancellation fee\n", '    name: cancellation fee\n    kind: never\n    property: "a fee is never charged twice"\n');
    expect(missing(serverKept)).toEqual([]);
  });
});
