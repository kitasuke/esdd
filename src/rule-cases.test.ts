import { afterEach, describe, expect, it } from "vitest";
import { runChecks } from "./checks.ts";
import { configure } from "./config.ts";
import { parseIR } from "./parse.ts";
import type { Finding } from "./types.ts";

function check(source: string): Finding[] {
  const { model, findings } = parseIR(source);
  if (!model) return findings;
  return [...findings, ...runChecks(model)];
}

const messagesOf = (findings: Finding[], name: string) =>
  findings.filter((f) => f.level === "error" && f.check === name).map((f) => f.message);

const FORM = (extra: string) => `
usecase: UC-TEST-001
name: Test
source: { spec: "https://example.com" }
scenarios:
  - id: SC-001
    name: open the card
    given: [the card is open]
    when: [open it]
    then: [the card is shown]
${extra}`;

describe("checkRuleCases", () => {
  it("rejects a rule whose cases all expect the same thing, and accepts two different answers", () => {
    const one = FORM(`rules:
  - id: RULE-001
    name: owner name
    cases:
      - { input: the owner is known, expected: the owner's name }
      - { input: the owner is known again, expected: the owner's name }`);
    expect(messagesOf(check(one), "rules")).toEqual([
      expect.stringContaining("rules[RULE-001]: needs at least two cases whose expected differ"),
    ]);
    const two = FORM(`rules:
  - id: RULE-001
    name: owner name
    cases:
      - { input: the owner is known, expected: the owner's name }
      - { input: the owner cannot be read, expected: '"Unknown"' }`);
    expect(messagesOf(check(two), "rules")).toEqual([]);
  });

  it("skips a rule while a case still waits for the owner's answer", () => {
    const pending = FORM(`rules:
  - id: RULE-001
    name: owner name
    cases:
      - { input: the owner is known, expected: "TBD(Q1: what is shown)" }`);
    expect(messagesOf(check(pending), "rules")).toEqual([]);
  });

  it("asks an ordering or paging rule for both directions", () => {
    const rule = (a: string, b: string) =>
      FORM(`rules:
  - id: RULE-001
    name: list sort
    cases:
      - { input: "${a}", expected: first }
      - { input: "${b}", expected: second }`);
    expect(messagesOf(check(rule("newest first", "newest first, same time")), "rules")).toEqual([
      expect.stringContaining("needs cases for both directions"),
    ]);
    expect(messagesOf(check(rule("newest first", "oldest first")), "rules")).toEqual([]);
    expect(messagesOf(check(rule("the next page", "the previous page")), "rules")).toEqual([]);
  });

  afterEach(() => configure({}));
  it("reads a team's own direction words from the config", () => {
    configure({ ruleDirections: { ordering: ["orden"], ascending: ["ascendente"], descending: ["descendente"] } });
    const src = FORM(`rules:
  - id: RULE-001
    name: orden de la lista
    cases:
      - { input: descendente, expected: first }
      - { input: ascendente, expected: second }`);
    expect(messagesOf(check(src), "rules")).toEqual([]);
  });
});

describe("checkRegion", () => {
  const REGION = (inputs: string, existing: string) =>
    FORM(`region: { name: the card, axis: card fetch }
${inputs}
rules:
  - id: RULE-001
    name: owner row
    cases:
      - { input: the card loaded, expected: the owner's name, covers: "card fetch×loaded" }
      - { input: the card failed, expected: '"Unknown"', covers: "card fetch×failed" }
${existing}`);
  const INPUTS = `inputs:
  - { id: card fetch, kind: option, conditions: [loaded, failed] }`;
  const STATE_REF = `existing:
  - id: EXIST-001
    concept: what the card shows when its fetch fails
    terms: ["Unknown"]
    refs:
      - { kind: state, at: "src/Card.tsx:40", text: "Unknown", decision: keep, reason: the other rows already show it }`;

  it("accepts a region whose axis lists its states and whose existing has a state ref", () => {
    expect(messagesOf(check(REGION(INPUTS, STATE_REF)), "region")).toEqual([]);
  });

  it("rejects a missing axis and a missing state ref", () => {
    expect(messagesOf(check(REGION("", "")), "region")).toEqual([
      expect.stringContaining('inputs has no axis "card fetch"'),
      expect.stringContaining("existing needs at least one ref of kind state"),
    ]);
  });
});

describe("existing (shape)", () => {
  it("reports each malformed field", () => {
    const src = FORM(`existing:
  - id: X-1
    concept: c
    terms: [t]
    refs:
      - { kind: file, at: a.ts, text: x, decision: fix, reason: "" }`);
    expect(messagesOf(check(src), "structure")).toEqual([
      expect.stringContaining("existing[0]: id must be an ID starting with EXIST-"),
      expect.stringContaining("existing[0].refs[0]: kind must be one of"),
      expect.stringContaining("existing[0].refs[0]: at must be <file>:<line>"),
      expect.stringContaining("existing[0].refs[0]: decision must be update or keep"),
      expect.stringContaining("existing[0].refs[0]: reason is required"),
    ]);
  });
});

describe("checkServer", () => {
  const SERVER = (cell: string, cases: string) =>
    FORM(`inputs:
  - { id: category, kind: field, conditions: [empty, blank] }
rules:
  - id: RULE-001
    name: category filter
    cases:
      - { input: no category, expected: every product, covers: "category×empty" }
${cases}
server:
  - id: SERVER-001
    sends: Products.category
    resolver: { at: "api/products/resolver.go:88", text: requireNonEmpty(category) }
    checks:
      - { kind: trim-non-empty, at: "api/products/params.go:68", text: strings.TrimSpace(raw), cell: "${cell}" }`);

  it("accepts a check whose cell is a declared, covered inputs cell", () => {
    const src = SERVER("category×blank", `      - { input: a blank category, expected: every product, covers: "category×blank" }`);
    expect([...messagesOf(check(src), "server"), ...messagesOf(check(src), "inputs")]).toEqual([]);
  });

  it("leaves an uncovered cell to inputs and rejects a cell inputs does not declare", () => {
    expect(messagesOf(check(SERVER("category×blank", "")), "inputs")).toEqual([
      expect.stringContaining("category × blank: uncovered"),
    ]);
    expect(messagesOf(check(SERVER("category×malformed", "")), "server")).toEqual([
      expect.stringContaining("cell category×malformed is not an inputs cell"),
    ]);
  });

  it("reports each malformed field", () => {
    const src = FORM(`server:
  - id: S-1
    sends: category
    resolver: { at: resolver.go }
    checks:
      - { kind: trim, at: "a.go:1", text: x, cell: "a×b×c" }`);
    expect(messagesOf(check(src), "structure")).toEqual([
      expect.stringContaining("server[0]: id must be an ID starting with SERVER-"),
      expect.stringContaining("server[0]: sends must be"),
      expect.stringContaining("server[0].resolver: at must be <file>:<line>"),
      expect.stringContaining("server[0].resolver: text is required"),
      expect.stringContaining("server[0].checks[0]: kind must be one of"),
      expect.stringContaining("server[0].checks[0]: cell must be <inputId>×<condition>"),
    ]);
  });
});
