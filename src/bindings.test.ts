import { describe, expect, it } from "vitest";
import { parseBindings, runBindingsChecks } from "./bindings.ts";
import { parseIR } from "./parse.ts";
import type { Finding, Model } from "./types.ts";

function check(source: string, model?: Model): Finding[] {
  const { doc, findings } = parseBindings(source);
  if (!doc) return findings;
  return [...findings, ...runBindingsChecks(doc, { model })];
}

function errorsOf(findings: Finding[], checkName?: string): Finding[] {
  return findings.filter(
    (f) => f.level === "error" && (!checkName || f.check === checkName),
  );
}

function warnsOf(findings: Finding[], checkName?: string): Finding[] {
  return findings.filter(
    (f) => f.level === "warn" && (!checkName || f.check === checkName),
  );
}

const MINIMAL = `
bindings: UC-TEST-001
platform: web
graph: account
events:
  delete: { operation: DeleteThing, kind: mutation, called_api: calledDeleteThingMutation }
elements:
  delete_button: { role: button, name: "Delete" }
  name_input: { label: "Name" }
  thing_list: { testid: "thing-list" }
literals:
  delete_success_toast: "Deleted"
literal_coverage:
  RULE-001: { literal: delete_success_toast }
  RULE-002: { ui_text: none, reason: "ordering rule — no UI text" }
`;

const IR_FOR_MINIMAL = `
usecase: UC-TEST-001
name: Test
source: { spec: "test" }
scenarios:
  - id: SC-001
    name: can delete
    given: ["one item is registered"]
    when: ["execute the deletion"]
    then: ["the item is deleted"]
rules:
  - id: RULE-001
    name: delete success notification
    cases:
      - { input: "delete succeeded", expected: "show a toast" }
  - id: RULE-002
    name: ordering
    cases:
      - { input: "multiple items", expected: "newest first by creation time" }
`;

function modelOf(source: string): Model {
  const { model } = parseIR(source);
  if (!model) throw new Error("cannot parse the IR");
  return model;
}

describe("bindings parse + checks", () => {
  it("a minimal valid bindings file passes all checks", () => {
    const findings = check(MINIMAL, modelOf(IR_FOR_MINIMAL));
    expect(findings).toEqual([]);
  });

  it("reports missing required keys as errors", () => {
    const findings = check("platform: web\nelements: {}\n");
    expect(errorsOf(findings, "bindings-schema").length).toBeGreaterThan(0);
  });

  it("reports duplicated or missing addressing forms as errors", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  double_form: { role: button, name: "Save", label: "Save" }
  no_form: { note: "decide later" }
`);
    const errors = errorsOf(findings, "bindings-schema");
    expect(errors.some((f) => f.message.includes("double_form"))).toBe(true);
    expect(errors.some((f) => f.message.includes("no_form"))).toBe(true);
  });

  it("reports a bare name (without role) as an error", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  odd_entry: { name: "Save", testid: "save" }
`);
    expect(
      errorsOf(findings, "bindings-schema").some((f) =>
        f.message.includes("together with role"),
      ),
    ).toBe(true);
  });

  it("reports unknown roles and dynamic testids as errors", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  button: { role: buton, name: "Save" }
  row: { testid: "row-{id}" }
`);
    const errors = errorsOf(findings, "bindings-schema");
    expect(errors.some((f) => f.message.includes("buton"))).toBe(true);
    expect(errors.some((f) => f.message.includes("kebab-case"))).toBe(true);
  });

  it("warns about elements with the same addressing as a strict mode forecast", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  save_a: { role: button, name: "Save" }
  save_b: { role: button, name: "Save" }
`);
    expect(warnsOf(findings, "bindings-unique").length).toBe(1);
  });

  it("reports a called_api naming mismatch as an error (mechanically derived from operation/kind)", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
events:
  create: { operation: CreateThing, kind: mutation, called_api: calledCreateThingQuery }
elements:
  button: { role: button, name: "Create" }
`);
    expect(
      errorsOf(findings, "bindings-events").some((f) =>
        f.message.includes("calledCreateThingMutation"),
      ),
    ).toBe(true);
  });

  it("literal_coverage: requires a stance for every rule in the IR", () => {
    const withoutRule2 = MINIMAL.replace(
      /  RULE-002: .*\n/,
      "",
    );
    const findings = check(withoutRule2, modelOf(IR_FOR_MINIMAL));
    expect(
      errorsOf(findings, "literal-coverage").some((f) =>
        f.message.includes("RULE-002"),
      ),
    ).toBe(true);
  });

  it("literal_coverage: reports rule ids absent from the IR as errors", () => {
    const withExtra = MINIMAL.replace(
      "literal_coverage:",
      "literal_coverage:\n  RULE-999: { ui_text: none }",
    );
    const findings = check(withExtra, modelOf(IR_FOR_MINIMAL));
    expect(
      errorsOf(findings, "literal-coverage").some((f) =>
        f.message.includes("RULE-999"),
      ),
    ).toBe(true);
  });

  it("literal_coverage: reports nonexistent literal keys as errors", () => {
    const broken = MINIMAL.replace("literal: delete_success_toast", "literal: nonexistent_key");
    const findings = check(broken, modelOf(IR_FOR_MINIMAL));
    expect(
      errorsOf(findings, "literal-coverage").some((f) =>
        f.message.includes("nonexistent_key"),
      ),
    ).toBe(true);
  });

  it("reports literal: TBD and a TBD inside a literal as pending warns", () => {
    const pendingCoverage = MINIMAL.replace(
      "literal: delete_success_toast",
      "literal: TBD",
    ).replace('delete_success_toast: "Deleted"', 'delete_success_toast: "Deleted (TBD: copy not approved)"');
    const findings = check(pendingCoverage, modelOf(IR_FOR_MINIMAL));
    expect(warnsOf(findings, "pending").length).toBe(2);
    expect(errorsOf(findings).length).toBe(0);
  });

  it("reports non-map literals / literal_coverage as schema errors", () => {
    const brokenLiterals = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  button: { role: button, name: "Save" }
literals: ["Deleted"]
`);
    expect(
      errorsOf(brokenLiterals, "bindings-schema").some((f) =>
        f.message.includes("literals must be a map"),
      ),
    ).toBe(true);
    const brokenCoverage = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  button: { role: button, name: "Save" }
literal_coverage: "RULE-001"
`);
    expect(
      errorsOf(brokenCoverage, "bindings-schema").some((f) =>
        f.message.includes("literal_coverage must be a map"),
      ),
    ).toBe(true);
  });

  it("accepts roles from the allowed set (slider/alertdialog)", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  volume: { role: slider, name: "Volume" }
  warning_dialog: { role: alertdialog, name: "Confirm" }
`);
    expect(errorsOf(findings)).toEqual([]);
  });

  it("reports a usecase id mismatch as an error", () => {
    const other = modelOf(IR_FOR_MINIMAL.replace("UC-TEST-001", "UC-OTHER-001"));
    const findings = check(MINIMAL, other);
    expect(errorsOf(findings, "bindings-usecase").length).toBe(1);
  });
});
