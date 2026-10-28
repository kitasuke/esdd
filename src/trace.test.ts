import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseIR } from "./parse.ts";
import {
  collectScenarioControls,
  enumerateNodes,
  extractTags,
  type Layer,
  parseGoTestJson,
  parseJUnit,
  parseOutcomeMarkers,
  parseTrace,
  runTrace,
  type TestCaseResult,
  type TestStatus,
} from "./trace.ts";
import type { Model } from "./types.ts";

const PILOT = join(import.meta.dirname, "../examples/order-cancel.usecase.yaml");
const PILOT_RESULTS = join(import.meta.dirname, "../examples/order-cancel.e2e-results.xml");

// A --go--> B (terminal) / A --stop_now--> C (terminal). The staff × customer race is declared under races
const STATEFUL = `
usecase: UC-TEST-001
name: Test
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
  - { id: C, terminal: true }
events:
  - { id: go, actor: staff }
  - { id: stop_now, actor: customer }
transitions:
  - { from: A, on: go, to: B, outcome: ["reaches B"] }
  - { from: A, on: stop_now, to: C, outcome: ["reaches C"] }
races:
  - state: A
    between: [go, stop_now]
    winner: stop_now
    outcome: ["reaches C"]
scenarios:
  - { id: SC-001, name: proceeds, path: [go], critical: true }
  - { id: SC-002, name: stops, path: [stop_now] }
rules:
  - id: RULE-001
    name: limit
    cases:
      - { input: 30, expected: accepted }
      - { input: 31, expected: 'show "Choose a date within 30 days"' }
`;

// Form mode + input axes. SC-001 covers email×empty, the 2nd case of RULE-001 covers email×boundary
const STATELESS = `
usecase: UC-FORM-001
name: Form
source: { spec: "https://example.com" }
inputs:
  - { id: email, kind: field }
  - { id: newsletter, kind: option, na: { set: the setting cannot be changed on this screen } }
scenarios:
  - { id: SC-001, name: empty-input error, covers: email×empty, given: [the form is open], when: [submit it empty], then: ['"Please enter your email address"'] }
  - { id: SC-002, name: default newsletter setting, covers: newsletter×default, given: [default settings], when: [save], then: ["the newsletter is sent"] }
rules:
  - id: RULE-001
    name: length limit
    cases:
      - { input: 255, expected: accepted }
      - { input: 256, expected: 'show "255 characters or fewer"', covers: email×boundary }
`;

function model(src: string): Model {
  const { model, findings } = parseIR(src);
  expect(findings).toEqual([]);
  return model!;
}

function tc(
  name: string,
  status: TestStatus = "Green",
  layer: Layer = "unit",
  classname = "",
): TestCaseResult {
  return { layer, source: "x.xml", classname, name, status };
}

// The two race nodes, each at a layer that can confirm it (winner = backend / loser's view = integration)
const raceTests = (status: TestStatus = "Green"): TestCaseResult[] => [
  tc("UC-TEST-001__RACE-A-go-stop_now", status, "backend"),
  tc("UC-TEST-001__RACE-A-go-stop_now-outcome", status, "integration"),
];

// Markers printed right after asserting each transition outcome (all outcomes of STATEFUL)
const outcomeMarkers = (layer: Layer = "integration"): TestCaseResult[] =>
  parseOutcomeMarkers(
    "[ESDD-OUTCOME] UC-TEST-001__T-A-go-o1\n[ESDD-OUTCOME] UC-TEST-001__T-A-stop_now-o1\n",
    layer,
    "markers.log",
  );

// For tests that only look at coverage (negative control checks are covered in describe("negative control"))
function traceIgnoringNc(...args: Parameters<typeof runTrace>) {
  const result = runTrace(...args);
  return { ...result, findings: result.findings.filter((f) => f.check !== "trace-nc") };
}

function errorChecks(findings: { level: string; check: string }[]): string[] {
  return findings.filter((f) => f.level === "error").map((f) => f.check);
}

describe("enumerateNodes", () => {
  it("enumerates every scenario, rule case, transition, and race as a node", () => {
    const ids = enumerateNodes(model(STATEFUL)).map((n) => n.id);
    expect(ids).toEqual([
      "SC-001",
      "SC-002",
      "RULE-001-c1",
      "RULE-001-c2",
      "T-A-go",
      "T-A-go-o1",
      "T-A-stop_now",
      "T-A-stop_now-o1",
      "RACE-A-go-stop_now",
      "RACE-A-go-stop_now-outcome",
    ]);
  });

  it("makes an ignored event a node to verify, and makes no node for an impossible cell", () => {
    const src = STATEFUL.replace(
      "races:",
      `  - { from: A, on: resend, ignored: true, reason: a resent notice is ignored }
races:`,
    ).replace(
      "  - { id: stop_now, actor: customer }",
      `  - { id: stop_now, actor: customer }
  - { id: resend, actor: system }`,
    );
    const nodes = enumerateNodes(model(src));
    expect(nodes.find((n) => n.id === "T-A-resend")).toMatchObject({
      kind: "ignored",
      label: "A × resend is ignored — a resent notice is ignored",
    });
  });

  it("enumerates input cells except na ones, with the covering nodes as derivation sources", () => {
    const cells = enumerateNodes(model(STATELESS)).filter((n) => n.kind === "input_cell");
    expect(cells.map((n) => [n.id, n.coveredBy])).toEqual([
      ["email×empty", ["SC-001"]],
      ["email×boundary", ["RULE-001-c2"]],
      ["newsletter×default", ["SC-002"]],
    ]);
  });

  it("every transition of the example is exercised by some scenario", () => {
    const transitions = enumerateNodes(model(readFileSync(PILOT, "utf8"))).filter(
      (n) => n.kind === "transition",
    );
    expect(transitions.length).toBeGreaterThan(0);
    expect(transitions.filter((n) => n.coveredBy.length === 0)).toEqual([]);
  });
});

describe("extractTags", () => {
  const ids = new Set(["SC-001", "SC-001-A", "RULE-001-c1", "RULE-001-c10"]);

  it("picks the node by longest match and skips a trailing description as a separator", () => {
    expect(extractTags("UC-TEST-001__SC-001_normal", "UC-TEST-001", ids).nodes).toEqual(["SC-001"]);
    expect(extractTags("UC-TEST-001__SC-001-A description", "UC-TEST-001", ids).nodes).toEqual([
      "SC-001-A",
    ]);
    expect(extractTags("UC-TEST-001__RULE-001-c10", "UC-TEST-001", ids).nodes).toEqual([
      "RULE-001-c10",
    ]);
  });

  it("one test name can carry several tags", () => {
    expect(
      extractTags("UC-TEST-001__SC-001 / UC-TEST-001__RULE-001-c1", "UC-TEST-001", ids).nodes,
    ).toEqual(["SC-001", "RULE-001-c1"]);
  });

  it("returns tags of nodes missing from the IR as unknown (typo detection)", () => {
    expect(extractTags("UC-TEST-001__SC-009 x", "UC-TEST-001", ids)).toEqual({
      nodes: [],
      unknown: ["SC-009"],
    });
  });

  it("ignores tags of other usecases and prefix matches of the usecase ID", () => {
    expect(extractTags("UC-OTHER-001__SC-001", "UC-TEST-001", ids).nodes).toEqual([]);
    expect(extractTags("XUC-TEST-001__SC-001", "UC-TEST-001", ids).nodes).toEqual([]);
  });
});

describe("parseJUnit", () => {
  it("maps failure / error to Red, skipped to Skip, anything else to Green", () => {
    const xml = `<?xml version="1.0"?>
<testsuites><testsuite name="s">
  <testcase classname="a.B" name="ok &quot;1&quot;" time="0.1"/>
  <testcase classname="a.B" name="fails"><failure message="x">boom</failure></testcase>
  <testcase classname="a.B" name="errs"><error message="x"/></testcase>
  <testcase classname="a.B" name="skipped"><skipped/></testcase>
  <testcase classname="a.B" name="has &gt; output"><system-out>log</system-out></testcase>
</testsuite></testsuites>`;
    expect(parseJUnit(xml, "e2e", "r.xml").map((t) => [t.name, t.status])).toEqual([
      ['ok "1"', "Green"],
      ["fails", "Red"],
      ["errs", "Red"],
      ["skipped", "Skip"],
      ["has > output", "Green"],
    ]);
  });
});

describe("parseGoTestJson", () => {
  it("picks up per-test pass / fail / skip and skips package-level events", () => {
    const text = [
      '{"Action":"run","Package":"p","Test":"TestRule"}',
      '{"Action":"pass","Package":"p","Test":"TestRule/UC-TEST-001__RULE-001-c1_accepts"}',
      '{"Action":"fail","Package":"p","Test":"TestRule/UC-TEST-001__RULE-001-c2"}',
      '{"Action":"skip","Package":"p","Test":"TestSkipped"}',
      '{"Action":"pass","Package":"p"}',
      "ok  \tp\t0.1s",
    ].join("\n");
    expect(parseGoTestJson(text, "unit", "go.json").map((t) => [t.name, t.status])).toEqual([
      ["TestRule/UC-TEST-001__RULE-001-c1_accepts", "Green"],
      ["TestRule/UC-TEST-001__RULE-001-c2", "Red"],
      ["TestSkipped", "Skip"],
    ]);
  });
});

describe("runTrace", () => {
  it("no errors when every node is Green; transitions are derived via scenarios", () => {
    const results = [
      tc("UC-TEST-001__SC-001", "Green", "e2e"),
      tc("UC-TEST-001__SC-002", "Green", "integration"),
      tc("UC-TEST-001__RULE-001-c1"),
      tc("UC-TEST-001__RULE-001-c2"),
      ...raceTests(),
      ...outcomeMarkers(),
    ];
    const { rows, findings } = traceIgnoringNc(model(STATEFUL), results);
    expect(findings).toEqual([]);
    expect(rows.find((r) => r.node === "T-A-go")).toMatchObject({
      verdict: "Green",
      via: ["SC-001"],
    });
    expect(rows.find((r) => r.node === "SC-001")?.layers).toEqual({ e2e: "Green" });
  });

  it("errors on nodes no test at any layer confirms (a transition is uncovered if its scenario did not run)", () => {
    const { rows, findings } = traceIgnoringNc(model(STATEFUL), [
      tc("UC-TEST-001__SC-001", "Green", "e2e"),
      ...outcomeMarkers(),
    ]);
    const uncovered = rows.filter((r) => r.verdict === "uncovered").map((r) => r.node);
    expect(uncovered).toEqual([
      "SC-002",
      "RULE-001-c1",
      "RULE-001-c2",
      "T-A-stop_now",
      "RACE-A-go-stop_now",
      "RACE-A-go-stop_now-outcome",
    ]);
    expect(errorChecks(findings)).toEqual(Array(6).fill("trace-uncovered"));
  });

  it("untested closes a node with a reason; untested on a node that has a test is a warn", () => {
    const { doc: parsed } = parseTrace(`
trace: UC-TEST-001
untested:
  SC-002: the stop operation cannot be reproduced in the test environment
  RULE-001-c1: x
  RULE-001-c2: x
  RACE-A-go-stop_now: concurrent operations cannot be created deterministically
  RACE-A-go-stop_now-outcome: same as above
  SC-001: a stale declaration
`);
    const { rows, findings } = traceIgnoringNc(
      model(STATEFUL),
      [tc("UC-TEST-001__SC-001", "Green", "e2e"), ...outcomeMarkers()],
      parsed,
    );
    expect(rows.find((r) => r.node === "SC-002")).toMatchObject({ verdict: "untested" });
    // Declaring SC-002 untested leaves the transition only SC-002 walks without a derivation source
    expect(errorChecks(findings)).toEqual(["trace-uncovered"]);
    expect(findings.find((f) => f.check === "trace-uncovered")?.message).toContain("T-A-stop_now");
    expect(
      findings.some((f) => f.level === "warn" && f.message.includes("untested.SC-001")),
    ).toBe(true);
  });

  it("a pending marker left in an untested reason is a pending warn", () => {
    const { doc } = parseTrace("trace: UC-TEST-001\nuntested:\n  SC-002: TBD whether this can be automated\n");
    const { findings } = traceIgnoringNc(model(STATEFUL), [], doc);
    expect(findings.filter((f) => f.check === "pending").map((f) => f.message)).toEqual([
      'untested.SC-002: the reason still contains "TBD"',
    ]);
  });

  it("nodes with only Red / Skip are warns; when Green and Red mix, Red is kept", () => {
    const results = [
      tc("UC-TEST-001__SC-001", "Green", "integration"),
      tc("UC-TEST-001__SC-001", "Red", "e2e"),
      tc("UC-TEST-001__SC-002", "Skip", "integration"),
      tc("UC-TEST-001__RULE-001-c1"),
      tc("UC-TEST-001__RULE-001-c2"),
      ...raceTests(),
      ...outcomeMarkers(),
    ];
    const { rows, findings } = traceIgnoringNc(model(STATEFUL), results);
    expect(errorChecks(findings)).toEqual([]);
    expect(rows.find((r) => r.node === "SC-001")).toMatchObject({
      verdict: "Red",
      layers: { integration: "Green", e2e: "Red" },
    });
    expect(rows.find((r) => r.node === "SC-002")?.verdict).toBe("Skip");
    expect(
      findings.filter((f) => f.check === "trace-failing").map((f) => f.message.split(" ")[0]),
    ).toEqual([
      "SC-001",
      "SC-002",
      // The derivation source SC-001 is Red, so the transition is Red too
      "T-A-go",
      "T-A-stop_now",
    ]);
  });

  it("a critical scenario without an E2E result is a warn", () => {
    const results = [
      ...["SC-001", "SC-002", "RULE-001-c1", "RULE-001-c2"].map((id) =>
        tc(`UC-TEST-001__${id}`, "Green", "integration"),
      ),
      ...raceTests(),
      ...outcomeMarkers(),
    ];
    const { findings } = traceIgnoringNc(model(STATEFUL), results);
    expect(findings.map((f) => [f.level, f.check])).toEqual([["warn", "trace-critical"]]);
  });

  it("owned_by resolves untagged existing tests by ID from the results; a missing one is an error", () => {
    const { doc } = parseTrace(`
trace: UC-TEST-001
owned_by:
  RULE-001-c1: "app.RuleTest#accepts 30"
  RULE-001-c2: ["app.RuleTest#rejects 31", "app.RuleTest#not run"]
untested:
  SC-002: x
  RACE-A-go-stop_now: x
  RACE-A-go-stop_now-outcome: x
  T-A-stop_now: x
`);
    const results = [
      tc("UC-TEST-001__SC-001", "Green", "e2e"),
      tc("accepts 30", "Green", "unit", "app.RuleTest"),
      tc("rejects 31", "Green", "unit", "app.RuleTest"),
      ...outcomeMarkers(),
    ];
    const { rows, findings } = traceIgnoringNc(model(STATEFUL), results, doc);
    expect(rows.find((r) => r.node === "RULE-001-c2")).toMatchObject({
      verdict: "Green",
      tests: ["app.RuleTest#rejects 31"],
    });
    expect(errorChecks(findings)).toEqual(["trace-owned-by"]);
    expect(findings[0]?.message).toContain("app.RuleTest#not run");
  });

  it("tags and declarations naming nodes missing from the IR are errors", () => {
    const { doc } = parseTrace(`
trace: UC-TEST-001
untested: { SC-404: x }
owned_by: { SC-405: "a#b" }
`);
    const results = [
      ...["SC-001", "SC-002", "RULE-001-c1", "RULE-001-c2"].map((id) =>
        tc(`UC-TEST-001__${id}`, "Green", "e2e"),
      ),
      ...raceTests(),
      ...outcomeMarkers(),
    ];
    results.push(tc("UC-TEST-001__SC-003"));
    const { findings } = traceIgnoringNc(model(STATEFUL), results, doc);
    expect(errorChecks(findings).sort()).toEqual(["trace-owned-by", "trace-tag", "trace-untested"]);
  });

  it("input cells are derived from the results of the nodes that cover them", () => {
    const results = [
      tc("UC-FORM-001__SC-001", "Green", "integration"),
      tc("UC-FORM-001__RULE-001-c2"),
      ...parseOutcomeMarkers(
        "[ESDD-OUTCOME] UC-FORM-001__SC-001-t1 [ESDD-OUTCOME] UC-FORM-001__SC-002-t1",
        "integration",
        "m.log",
      ),
    ];
    const { rows, findings } = traceIgnoringNc(model(STATELESS), results);
    expect(
      rows.filter((r) => r.kind === "input_cell").map((r) => [r.node, r.verdict, r.via]),
    ).toEqual([
      ["email×empty", "Green", ["SC-001"]],
      ["email×boundary", "Green", ["RULE-001-c2"]],
      ["newsletter×default", "uncovered", undefined],
    ]);
    expect(
      findings.filter((f) => f.level === "error").map((f) => f.message.split(" ")[0]),
    ).toEqual(["SC-002", "RULE-001-c1", "newsletter×default"]);
  });

  it("errors when the trace's target usecase differs from the IR", () => {
    const { findings } = traceIgnoringNc(model(STATEFUL), [], { trace: "UC-OTHER-001" });
    expect(errorChecks(findings)).toEqual(["trace-usecase"]);
  });

  it("the example JUnit XML traces against the order-cancel example", () => {
    const xml = readFileSync(PILOT_RESULTS, "utf8");
    const results = [
      ...parseJUnit(xml, "e2e", PILOT_RESULTS),
      ...parseOutcomeMarkers(xml, "e2e", PILOT_RESULTS),
    ];
    const { rows } = traceIgnoringNc(model(readFileSync(PILOT, "utf8")), results);
    expect(rows.find((r) => r.node === "SC-001")).toMatchObject({ verdict: "Green" });
    expect(rows.find((r) => r.node === "T-PLACED-pack")).toMatchObject({
      verdict: "Green",
      via: ["SC-001"],
    });
  });
});

describe("negative control", () => {
  const allGreen = () => [
    ...["SC-001", "SC-002", "RULE-001-c1", "RULE-001-c2"].map((id) =>
      tc(`UC-TEST-001__${id}`, "Green", "e2e"),
    ),
    ...raceTests(),
    ...outcomeMarkers(),
  ];
  const ncErrors = (findings: { level: string; check: string; message: string }[]) =>
    findings
      .filter((f) => f.level === "error" && f.check === "trace-nc")
      .map((f) => f.message.split(" ")[0]);

  it("errors on nodes Green through a direct test with no record; derived transitions are exempt", () => {
    const { rows, findings } = runTrace(model(STATEFUL), allGreen());
    expect(ncErrors(findings)).toEqual([
      "SC-001",
      "SC-002",
      "RULE-001-c1",
      "RULE-001-c2",
      "RACE-A-go-stop_now",
      "RACE-A-go-stop_now-outcome",
    ]);
    expect(rows.find((r) => r.node === "SC-001")?.nc).toBe("missing");
    expect(rows.find((r) => r.node === "T-A-go")?.nc).toBeUndefined();
  });

  it("closes via scenario-file controls[].nodes and trace.yaml negative_controls; a rule-level key covers every case", () => {
    const scenarioControls = collectScenarioControls([
      {
        path: "scenarios/x.yaml",
        text: `
negative_control:
  status: verified
  controls:
    - oracle: o
      breakage: b
      observed_failure: f
      verified: "2026-10-14 local"
      nodes: [UC-TEST-001__SC-001, UC-TEST-001__SC-002, UC-OTHER-001__SC-001]
`,
      },
      // nodes of a pending scenario do not count as proof
      { path: "scenarios/y.yaml", text: "negative_control: { status: pending, reason: r }" },
    ]);
    const { doc, findings: parseFindings } = parseTrace(`
trace: UC-TEST-001
negative_controls:
  RULE-001:
    status: verified
    controls:
      - { layer: unit, oracle: o, breakage: invert the expected value, observed_failure: f, verified: "2026-10-14 local" }
  RACE-A-go-stop_now: { status: pending, reason: waiting for a fixture that builds the winner's state }
  RACE-A-go-stop_now-outcome:
    status: verified
    controls:
      - { layer: integration, oracle: o, breakage: the fake does not return the loser's error, observed_failure: f, verified: "2026-10-14 scaffold" }
`);
    expect(parseFindings).toEqual([]);
    const { rows, findings } = runTrace(model(STATEFUL), allGreen(), doc, scenarioControls);
    expect(ncErrors(findings)).toEqual([]);
    expect(rows.find((r) => r.node === "SC-001")).toMatchObject({
      nc: "verified",
      ncSources: ["scenarios/x.yaml"],
    });
    expect(rows.find((r) => r.node === "RULE-001-c2")).toMatchObject({
      nc: "verified",
      ncSources: ["trace.yaml (RULE-001)"],
    });
    expect(rows.find((r) => r.node === "RACE-A-go-stop_now")?.nc).toBe("pending");
    expect(findings.filter((f) => f.check === "trace-nc").map((f) => f.level)).toEqual(["warn"]);
  });

  it("records naming nodes missing from the IR are errors (tags of other usecases are ignored)", () => {
    const scenarioControls = collectScenarioControls([
      {
        path: "s.yaml",
        text: `
negative_control:
  status: verified
  controls:
    - { oracle: o, breakage: b, observed_failure: f, verified: "2026-10-14", nodes: [UC-TEST-001__SC-404, UC-OTHER-001__SC-404] }
`,
      },
    ]);
    const { doc } = parseTrace(
      "trace: UC-TEST-001\nnegative_controls:\n  SC-405: { status: not-applicable, reason: r }",
    );
    const { findings } = runTrace(model(STATEFUL), [], doc, scenarioControls);
    expect(findings.filter((f) => f.check === "trace-nc").map((f) => f.message)).toEqual([
      "negative_controls.SC-405: no such node in the IR",
      "s.yaml: negative_control nodes entry UC-TEST-001__SC-404 names no node in the IR",
    ]);
  });

  it("checks the structure of trace.yaml negative_controls", () => {
    const { findings } = parseTrace(`
trace: UC-TEST-001
negative_controls:
  SC-001: { status: verified }
  SC-002: { status: pending }
  RULE-001:
    status: verified
    controls: [{ layer: db, oracle: o, breakage: b, observed_failure: f, verified: yesterday }]
`);
    expect(findings.map((f) => f.message)).toEqual([
      "negative_controls.SC-001: status: verified needs at least one entry in controls",
      "negative_controls.SC-002: status: pending needs a reason",
      "negative_controls.RULE-001: controls[0].verified must start with a date (YYYY-MM-DD)",
      "negative_controls.RULE-001: controls[0].layer must be one of unit / backend / integration / e2e",
    ]);
  });
});

describe("races", () => {
  const others = [
    ...["SC-001", "SC-002", "RULE-001-c1", "RULE-001-c2"].map((id) =>
      tc(`UC-TEST-001__${id}`, "Green", "e2e"),
    ),
    ...outcomeMarkers(),
  ];
  const raceWarnings = (results: TestCaseResult[], traceYaml?: string) => {
    const doc = traceYaml ? parseTrace(traceYaml).doc : undefined;
    return traceIgnoringNc(model(STATEFUL), [...others, ...results], doc)
      .findings.filter((f) => f.check === "trace-race")
      .map((f) => f.message.split(" ")[0]);
  };

  it("no warn when the winner is confirmed at unit / backend and the loser's view at unit / backend / integration", () => {
    expect(raceWarnings(raceTests())).toEqual([]);
  });

  it("warns when the winner is confirmed only by fake-server integration or E2E (no proof of the backend's mutual exclusion)", () => {
    expect(
      raceWarnings([
        tc("UC-TEST-001__RACE-A-go-stop_now", "Green", "integration"),
        tc("UC-TEST-001__RACE-A-go-stop_now-outcome", "Green", "e2e"),
      ]),
    ).toEqual(["RACE-A-go-stop_now", "RACE-A-go-stop_now-outcome"]);
  });

  it("an untested race is a warn (first ask whether backend / integration can create it deterministically)", () => {
    expect(
      raceWarnings(
        [],
        "trace: UC-TEST-001\nuntested:\n  RACE-A-go-stop_now: x\n  RACE-A-go-stop_now-outcome: x\n",
      ),
    ).toEqual(["RACE-A-go-stop_now", "RACE-A-go-stop_now-outcome"]);
  });

  it("the winner and the loser's view are separately taggable (longest match does not confuse -outcome)", () => {
    const { rows } = traceIgnoringNc(model(STATEFUL), [
      ...others,
      tc("UC-TEST-001__RACE-A-go-stop_now-outcome_dialog", "Green", "integration"),
    ]);
    expect(
      rows.filter((r) => r.kind.startsWith("race")).map((r) => [r.node, r.verdict]),
    ).toEqual([
      ["RACE-A-go-stop_now", "uncovered"],
      ["RACE-A-go-stop_now-outcome", "Green"],
    ]);
  });
});

describe("outcome", () => {
  const scenariosAndRaces = [
    ...["SC-001", "SC-002", "RULE-001-c1", "RULE-001-c2"].map((id) =>
      tc(`UC-TEST-001__${id}`, "Green", "e2e"),
    ),
    ...raceTests(),
  ];

  it("an outcome without an assert marker is uncovered even when the scenario walking the path is Green", () => {
    const { rows, findings } = traceIgnoringNc(model(STATEFUL), scenariosAndRaces);
    // The transition is Green via the scenario, but its outcomes are asked separately
    expect(rows.find((r) => r.node === "T-A-go")?.verdict).toBe("Green");
    expect(
      findings.filter((f) => f.check === "trace-uncovered").map((f) => f.message.split(" ")[0]),
    ).toEqual(["T-A-go-o1", "T-A-stop_now-o1"]);
    expect(findings[0]?.message).toContain("[ESDD-OUTCOME] UC-TEST-001__T-A-go-o1");
  });

  it("picks markers up from JUnit system-out, go test -json Output, and logs, Green per layer", () => {
    const xml = `<testsuite><testcase classname="c" name="UC-TEST-001__SC-001"><system-out>step
[ESDD-OUTCOME] UC-TEST-001__T-A-go-o1
</system-out></testcase></testsuite>`;
    const goJson =
      '{"Action":"output","Test":"TestX","Output":"[ESDD-OUTCOME] UC-TEST-001__T-A-stop_now-o1\\n"}';
    const markers = [
      ...parseOutcomeMarkers(xml, "integration", "r.xml"),
      ...parseOutcomeMarkers(goJson, "backend", "go.json"),
    ];
    expect(markers.map((m) => [m.name, m.layer])).toEqual([
      ["UC-TEST-001__T-A-go-o1", "integration"],
      ["UC-TEST-001__T-A-stop_now-o1", "backend"],
    ]);
    const { rows, findings } = traceIgnoringNc(model(STATEFUL), [...scenariosAndRaces, ...markers]);
    expect(findings.filter((f) => f.level === "error")).toEqual([]);
    expect(rows.find((r) => r.node === "T-A-stop_now-o1")).toMatchObject({
      verdict: "Green",
      layers: { backend: "Green" },
    });
  });

  it("a marker naming a non-outcome node is an error (scenarios are pointed at by test-name tags)", () => {
    const { findings } = traceIgnoringNc(model(STATEFUL), [
      ...scenariosAndRaces,
      ...outcomeMarkers(),
      ...parseOutcomeMarkers("[ESDD-OUTCOME] UC-TEST-001__SC-001", "e2e", "m.log"),
    ]);
    expect(errorChecks(findings)).toEqual(["trace-tag"]);
  });

  it("outcomes need no negative control (it is asked of the test that contains them)", () => {
    const { rows, findings } = runTrace(model(STATEFUL), [
      ...scenariosAndRaces,
      ...outcomeMarkers(),
    ]);
    expect(rows.find((r) => r.node === "T-A-go-o1")?.nc).toBeUndefined();
    expect(
      findings.filter((f) => f.check === "trace-nc").map((f) => f.message.split(" ")[0]),
    ).not.toContain("T-A-go-o1");
  });

  it("in form mode each then item of a scenario becomes an outcome node", () => {
    const ids = enumerateNodes(model(STATELESS))
      .filter((n) => n.kind === "outcome")
      .map((n) => n.id);
    expect(ids).toEqual(["SC-001-t1", "SC-002-t1"]);
  });
});

describe("parseTrace", () => {
  it("errors on unknown keys and a missing trace", () => {
    expect(errorChecks(parseTrace("untested: {}").findings)).toEqual(["trace-schema"]);
    expect(errorChecks(parseTrace("trace: UC-A-1\nextra: 1").findings)).toEqual(["trace-schema"]);
  });
});
