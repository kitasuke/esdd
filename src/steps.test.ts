import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { parseIR } from "./parse.ts";
import { parseSteps, runStepsChecks } from "./steps.ts";
import type { Finding, Model } from "./types.ts";

const examples = join(import.meta.dirname, "../examples");
const read = (name: string) => readFileSync(join(examples, name), "utf8");

function model(source: string): Model {
  const { model, findings } = parseIR(source);
  if (!model) throw new Error(findings.map((f) => f.message).join("; "));
  return model;
}

function check(source: string, m?: Model): Finding[] {
  const { doc, findings } = parseSteps(source);
  if (!doc) return findings;
  return [...findings, ...runStepsChecks(doc, { model: m })];
}

const errorsOf = (fs: Finding[], name?: string) => fs.filter((f) => f.level === "error" && (!name || f.check === name));
const warnsOf = (fs: Finding[], name?: string) => fs.filter((f) => f.level === "warn" && (!name || f.check === name));

const orderCancel = () => model(read("order-cancel.usecase.yaml"));
/** The example step definitions, edited by `edit` */
function exampleSteps(edit: (doc: Record<string, any>) => void = () => {}): string {
  const doc = parse(read("order-cancel.steps.yaml"));
  edit(doc);
  return stringify(doc);
}

describe("steps: the bundled example", () => {
  it("resolves every phrase; the open questions are warns", () => {
    const fs = check(read("order-cancel.steps.yaml"), orderCancel());
    expect(errorsOf(fs)).toEqual([]);
    expect(warnsOf(fs, "steps-given-state").map((f) => f.message)).toEqual([
      'givens."one packed order exists" describes PACKED, but every path starts at PLACED — put it on the question list',
    ]);
    expect(warnsOf(fs, "steps-unresolved")).toHaveLength(2);
  });
});

describe("steps-coverage: every IR phrase resolves", () => {
  it("reports a missing event, outcome, given, rule and start state at once", () => {
    const fs = check(
      exampleSteps((d) => {
        delete d.events.complete;
        delete d.outcomes['the order status shows "Packed"'];
        delete d.givens["one paid order exists"];
        delete d.rules["RULE-001"];
        delete d.states.PACKED;
      }),
      orderCancel(),
    );
    expect(errorsOf(fs, "steps-coverage").map((f) => f.message)).toEqual([
      "state PACKED is a start state (the initial state or a race state) with no fixture in states",
      'given "one paid order exists" has no step definition',
      "event complete has no step definition",
      'outcome "the order status shows "Packed"" has no step definition',
      "rule RULE-001 has no step definition",
    ]);
  });

  it("an outcome text edited in the IR shows up as missing plus stale", () => {
    const ir = read("order-cancel.usecase.yaml").replace(
      `outcome: ['the order status shows "Packed"']`,
      `outcome: ['the order status reads "Packed"']`,
    );
    const messages = errorsOf(check(read("order-cancel.steps.yaml"), model(ir))).map((f) => f.message);
    expect(messages).toContain('outcome "the order status reads "Packed"" has no step definition');
    expect(messages.some((m) => m.startsWith(`outcomes."the order status shows "Packed""`))).toBe(true);
  });

  it("reports definitions the IR does not have", () => {
    const fs = check(
      exampleSteps((d) => {
        d.events.refund = { screen: "refund" };
        d.states.LOST = { fixture: "lostOrder" };
        d.rules["RULE-009"] = d.rules["RULE-001"];
      }),
      orderCancel(),
    );
    expect(errorsOf(fs, "steps-coverage").map((f) => f.message.split(":")[0])).toEqual([
      "states.LOST",
      "events.refund",
      "rules.RULE-009",
    ]);
  });

  it("a rule's cases must match the IR's case count", () => {
    const fs = check(exampleSteps((d) => d.rules["RULE-001"].cases.pop()), orderCancel());
    expect(errorsOf(fs, "steps-coverage").map((f) => f.message)).toEqual([
      "rules.RULE-001: the IR has 2 cases, the step definitions 1",
    ]);
  });

  it("a given must name a state of the IR", () => {
    const fs = check(exampleSteps((d) => (d.givens["one paid order exists"] = { state: "PAID" })), orderCancel());
    expect(errorsOf(fs, "steps-coverage").map((f) => f.message)).toEqual([
      'givens."one paid order exists": state PAID does not exist in the IR',
    ]);
  });

  it("in form mode, a scenario's then items are the outcomes", () => {
    const steps = `
steps: UC-PROFILE-EMAIL-001
givens:
  "a signed-in user has the settings screen open": { fixture: signedInSettings }
outcomes:
  '"Your email address has been updated" is shown': { expect: expectSavedToast }
  "UpdateContactEmail is called with the entered value": { expect: expectSaveCalledWithEmail }
rules:
  RULE-002:
    function: { name: saveResultNotice, from: ./save-result-notice.ts }
    cases: [{ args: [succeeded], returns: save_success_toast }, { args: [failed], returns: save_failure_message }]
`;
    const messages = errorsOf(check(steps, model(read("contact-email.usecase.yaml")))).map((f) => f.message);
    expect(messages).toEqual([
      'outcome "UpdateContactEmail is called with the toggled value" has no step definition',
      "rule RULE-001 has no step definition",
    ]);
  });
});

describe("steps-usecase", () => {
  it("the target must match the IR", () => {
    const fs = check(exampleSteps((d) => (d.steps = "UC-OTHER-001")), orderCancel());
    expect(errorsOf(fs, "steps-usecase")).toHaveLength(1);
  });

  it("without an IR only the schema is checked", () => {
    expect(check(read("order-cancel.steps.yaml"))).toEqual([]);
  });
});

describe("steps-schema", () => {
  const bad = (yaml: string) => errorsOf(check(yaml), "steps-schema").map((f) => f.message);

  it("requires the target usecase and known sections", () => {
    expect(bad("states: {}\nfixtures: {}\n")).toEqual([
      "steps must be a string holding the target usecase id",
      "unknown key fixtures (allowed: steps, states, givens, events, outcomes, rules)",
    ]);
  });

  it("an event is a screen method or a fixture, not both", () => {
    expect(bad("steps: UC-X-001\nevents:\n  pack: { screen: pack, fixture: packOrder }\n")).toEqual([
      "events.pack: write exactly one of screen: <name> or fixture: <name>",
    ]);
  });

  it("an outcome is an assertion or an unresolved reason", () => {
    expect(
      bad(`steps: UC-X-001
outcomes:
  "a": { not: expectNothing }
  "b": { unresolved: "" }
  "c": { expect: expectC, args: [1] }
  "d": { expect: expectD, retry: 3 }
`),
    ).toEqual([
      'outcomes."a": write expect: <method> (with optional not / args), or unresolved: <reason>',
      'outcomes."b": unresolved takes a non-empty reason and nothing else',
      'outcomes."c": args must be a list of strings',
      'outcomes."d": unknown key retry',
    ]);
  });

  it("a rule names its function and lists its cases", () => {
    expect(bad("steps: UC-X-001\nrules:\n  RULE-001: { function: { name: f }, cases: [] }\n")).toEqual([
      "rules.RULE-001: write function: { name: <function>, from: <module> }",
    ]);
  });
});
