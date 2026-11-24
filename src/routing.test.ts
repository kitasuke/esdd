import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { configure } from "./config.ts";
import { checkRouting, findCycle, parseWorkStatus } from "./routing.ts";

const base = () => ({
  source: { spec: "spec.md", base: "abc123" },
  verdict: "server-first",
  requirements: [{ id: "R1", text: "sort by date", needs: [{ kind: "sort", target: "Query.items(orderBy)", status: "missing" }] }],
  work: [
    { id: "W1", platform: "backend", kind: "contract", from: ["R1"], depends_on: [], status: "todo" },
    { id: "W2", platform: "codegen", kind: "contract", from: ["R1"], depends_on: ["W1"], status: "todo" },
    { id: "W3", platform: "web", kind: "implementation", from: ["R1"], depends_on: ["W2"], status: "todo" },
    { id: "W4", platform: "e2e", kind: "verification", from: ["R1"], depends_on: ["W1", "W3"], status: "todo" },
  ],
  questions: [] as unknown[],
  feedback: [] as unknown[],
});
const messages = (doc: unknown) => checkRouting(doc).map((f) => `${f.check}: ${f.message}`);

afterEach(() => configure({}));

describe("checkRouting", () => {
  it("passes a complete file, and the bundled example", () => {
    expect(messages(base())).toEqual([]);
    const example = parse(readFileSync(join(import.meta.dirname, "../examples/order-cancel.routing.yaml"), "utf8"));
    expect(messages(example)).toEqual([]);
  });

  it("errors on a file that is not a mapping and on missing sections", () => {
    expect(messages([])).toEqual(["routing-shape: the routing file is not a mapping"]);
    expect(messages({ verdict: "blocked", questions: [{ id: "Q1", recommended: "ask" }] })).toEqual([
      "routing-shape: source is missing",
      "routing-shape: requirements is missing",
      "routing-shape: work is missing",
    ]);
  });

  it("errors on values outside the vocabulary", () => {
    const doc = base();
    doc.verdict = "web-first";
    doc.work[0]!.platform = "database";
    doc.work[0]!.kind = "chore";
    doc.requirements[0]!.needs[0]!.status = "absent";
    expect(messages(doc)).toEqual([
      'routing-enum: verdict "web-first" is not one of client-only | server-first | no-client | blocked',
      'routing-enum: R1: need "Query.items(orderBy)" has status "absent", not one of exists | missing | stub | differs',
      'routing-enum: W1: platform "database" is not one of backend | codegen | web | android | ios | e2e',
      'routing-enum: W1: kind "chore" is not one of contract | implementation | decision | verification',
    ]);
  });

  it("takes platform names from the configuration", () => {
    configure({ routing: { platforms: ["api", "app", "check"], server: ["api"], client: ["app"], verification: "check" } });
    const doc = {
      ...base(),
      work: [
        { id: "W1", platform: "api", kind: "contract", depends_on: [], status: "todo" },
        { id: "W2", platform: "app", kind: "implementation", depends_on: ["W1"], status: "todo" },
        { id: "W3", platform: "check", kind: "verification", depends_on: ["W1", "W2"], status: "todo" },
      ],
    };
    expect(messages(doc)).toEqual([]);
  });

  it("errors on duplicate ids, dangling references and a cycle", () => {
    const doc = base();
    doc.work.push({ ...doc.work[3]! });
    doc.work[2]!.from = ["R9"];
    doc.work[0]!.depends_on = ["W4"];
    doc.feedback = [{ found: "no sort key", stopped: ["W9"], resolved_as: "W8" }];
    expect(messages(doc)).toEqual([
      'routing-ids: work id "W4" is used twice',
      'routing-refs: W3: from "R9" is not a requirement id',
      "routing-cycle: depends_on has a cycle: W1 → W4 → W1",
      'routing-refs: feedback "no sort key": stopped "W9" is not a work id',
      'routing-refs: feedback "no sort key": resolved_as "W8" is neither a work id nor not_routed',
    ]);
  });

  it("requires a note on done, in-progress and deferred, and keeps pending for verification work", () => {
    const doc = { ...base(), verdict: "client-only" };
    doc.work[0]!.status = "done";
    doc.work[1]!.status = "in-progress";
    doc.work[2]!.status = "pending";
    doc.work.push({ id: "W5", platform: "ios", kind: "implementation", from: [], depends_on: [], status: "deferred" });
    expect(messages(doc)).toEqual([
      'routing-status: W1 is done without a commit; write "done (<commit>)"',
      'routing-status: W2 is in progress without a change; write "in-progress (<change>)"',
      "routing-status: W3: pending is only for e2e work (an example no existing account can reach)",
      'routing-status: W5 is deferred without who decided it; write "deferred (<who, why>)"',
    ]);
  });

  it("checks that recommended names an option, or holds the proposal as text", () => {
    const doc = base();
    doc.questions = [
      { id: "Q1", options: [{ id: "A", verdict: "client-only" }, { id: "B", verdict: "server-first" }], recommended: "C" },
      { id: "Q2", recommended: "" },
      { id: "Q3", recommended: "run the list E2E with an account that has two branches" },
    ];
    expect(messages(doc)).toEqual([
      'routing-recommended: Q1: recommended "C" is not one of its options (A, B)',
      "routing-recommended: Q2 has neither options nor recommended; give one option per routing outcome, or write the proposal in recommended",
    ]);
  });

  it("checks the verdict against what client work waits for, through codegen", () => {
    const clientOnly = { ...base(), verdict: "client-only" };
    expect(messages(clientOnly)).toEqual([
      "routing-verdict: verdict is client-only, but W3 depends on W1, server work that is not done; make it server-first or give the reason the dependency does not hold",
    ]);
    const done = base();
    done.work[0]!.status = "done (abc123)";
    expect(messages(done)).toEqual(["routing-verdict: verdict is server-first, but no client work depends on server work that is not done"]);
    expect(messages({ ...base(), verdict: "no-client" })).toEqual(["routing-verdict: verdict is no-client, but there is client work (W3)"]);
    expect(messages({ ...base(), verdict: "blocked" })).toEqual([
      "routing-verdict: verdict is blocked, but there are no questions; write what cannot be decided, each with a proposal",
    ]);
  });

  it("does not count deferred work for the verdict", () => {
    const doc = { ...base(), verdict: "client-only" };
    doc.work[0]!.status = "deferred (owner, next quarter)";
    doc.work[1]!.depends_on = [];
    doc.work[3]!.depends_on = ["W3"];
    expect(messages(doc)).toEqual([]);
  });

  it("requires verification work that waits for every server and client item", () => {
    const missing = base();
    missing.work.pop();
    expect(messages(missing)).toEqual([
      "routing-verification: there is server and client work, but no e2e verification work to run once both are out",
    ]);
    const partial = base();
    partial.work[3]!.depends_on = ["W3"];
    expect(messages(partial)).toEqual([]);
    const direct = base();
    direct.work[3]!.depends_on = ["W2"];
    expect(messages(direct)).toEqual([
      "routing-verification: the e2e verification work does not depend on W3; it waits for every server and client item",
    ]);
  });
});

describe("parseWorkStatus / findCycle", () => {
  it("splits a status from its note", () => {
    expect(parseWorkStatus("done (abc123)")).toEqual({ state: "done", note: "abc123" });
    expect(parseWorkStatus("todo")).toEqual({ state: "todo", note: "" });
  });
  it("finds a cycle and ignores edges to unknown ids", () => {
    expect(findCycle(new Map([["A", ["B"]], ["B", ["A"]]]))).toEqual(["A", "B", "A"]);
    expect(findCycle(new Map([["A", ["X"]]]))).toBeUndefined();
  });
});
