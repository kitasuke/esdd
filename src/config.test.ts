import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseBindings, runBindingsChecks } from "./bindings.ts";
import { runChecks } from "./checks.ts";
import { configure } from "./config.ts";
import { renderDigest } from "./digest.ts";
import { parseIR } from "./parse.ts";

const IR = `
usecase: UC-TEST-001
name: Order
source: { spec: "https://example.com/spec" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
events:
  - { id: go, actor: operator }
transitions:
  - { from: A, on: go, to: B, outcome: ["OPEN QUESTION: what is shown"] }
scenarios:
  - { id: SC-001, name: go, path: [go] }
`;

afterEach(() => configure({}));

describe("config", () => {
  it("leaves actors open, and closes them to the configured list", () => {
    expect(parseIR(IR).model).toBeDefined();
    configure({ actors: ["customer", "staff"] });
    expect(parseIR(IR).findings.map((f) => f.message)).toEqual(["event go: actor must be one of customer | staff: operator"]);
  });

  it("counts the configured markers as unanswered, besides the defaults", () => {
    const model = parseIR(IR).model!;
    expect(runChecks(model).filter((f) => f.check === "pending")).toEqual([]);
    configure({ pendingMarkers: ["OPEN QUESTION"] });
    expect(runChecks(model).filter((f) => f.check === "pending").map((f) => f.message)).toEqual([
      "transitions[0]: an unanswered spec-question marker (OPEN QUESTION) remains. Incorporate the spec owner's answer before approving",
    ]);
  });

  it("takes a configured marker as an undecided literal in literal_coverage", () => {
    const source = `
bindings: UC-TEST-001
platform: web
graph: account
elements:
  go: { role: button, name: Go }
literal_coverage:
  RULE-001: { literal: OPEN QUESTION }
`;
    const model = parseIR(IR.replace("scenarios:", "rules:\n  - { id: RULE-001, name: fee, cases: [{ input: a, expected: b }] }\nscenarios:")).model!;
    const run = () => runBindingsChecks(parseBindings(source).doc!, { model }).map((f) => `${f.level} ${f.message}`);
    expect(run()).toEqual(["error literal_coverage.RULE-001: literals.OPEN QUESTION does not exist"]);
    configure({ pendingMarkers: ["OPEN QUESTION"] });
    expect(run()).toEqual(["warn literal_coverage.RULE-001: literal undecided (OPEN QUESTION) — resolve via the question list"]);
  });

  it("adds a bindings platform with its own keys and checks", () => {
    const source = `
bindings: UC-TEST-001
platform: mobile
elements:
  ok: { testTag: go-button }
  bad: { testTag: GoButton }
  web_only: { role: button, name: Go }
events:
  go: { operation: Go }
`;
    expect(parseBindings(source).findings.map((f) => f.message)).toEqual(["platform must be one of web: mobile"]);
    configure({
      platforms: {
        mobile: {
          elementKeys: ["testTag", "note"],
          checkElement(id, e, findings) {
            if (!/^[a-z-]+$/.test(String(e.testTag))) findings.push({ level: "error", check: "bindings-schema", message: `${id}: kebab` });
          },
          checkEvent(id, e, findings) {
            if (e.command === undefined) findings.push({ level: "error", check: "bindings-events", message: `${id}: command` });
          },
        },
      },
    });
    const { doc } = parseBindings(source);
    expect(runBindingsChecks(doc!).map((f) => f.message)).toEqual([
      "bad: kebab",
      "elements.web_only: unknown keys role, name (allowed for platform mobile: testTag, note)",
      "elements.web_only: exactly one addressing form (testTag) is required (currently: none)",
      "go: command",
    ]);
  });

  it("renders the digest with the configured labels", () => {
    configure({ digest: { states: "Lifecycle", initial: "start" } });
    const md = renderDigest(parseIR(IR).model!);
    expect(md).toContain("## Lifecycle");
    expect(md).toContain("### A — start");
  });

  it("is loaded by the CLI from --config", () => {
    const cli = join(import.meta.dirname, "cli.ts");
    const example = join(import.meta.dirname, "../examples");
    const run = (...args: string[]) => {
      try {
        return execFileSync(process.execPath, [cli, ...args], { encoding: "utf8" });
      } catch (e) {
        return String((e as { stdout?: string }).stdout);
      }
    };
    expect(run(join(example, "order-cancel.usecase.yaml"))).toContain("all checks passed");
    expect(run(join(example, "order-cancel.usecase.yaml"), "--config", join(example, "esdd.config.ts"), "--digest")).toContain("## Lifecycle");
  });
});
