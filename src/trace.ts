// Behavior trace: cross-checks that every behavior (node) the IR defines has been confirmed
// by some test that actually ran (unit / backend / integration / e2e results).
// Format specification: docs/trace.md
//
// Universe = every node mechanically derived from the checked IR (scenarios, rule cases,
// transitions, races, outcomes, input cells).
// Closure = a tag `<usecase>__<node>` in a test name / owned_by / untested (with a reason)
// in trace.yaml. Like states×events exhaustiveness and literal_coverage, a node without a
// stance is an error.
//
// On top of that, a node that is Green through a direct test must carry a negative control
// record (proof that the test fails when its oracle is broken). Records come from scenario /
// test files (negative_control.controls[].nodes) or from trace.yaml negative_controls (for
// layers whose test code does not stay in the repository, or that have no scenario file).

import { parse as parseYaml } from "yaml";
import { inputConditions } from "./checks.ts";
import { findPendingMarker, raceWinnerText } from "./text.ts";
import { cellKey, type Finding, type Model, type OutcomeItem } from "./types.ts";

// unit = pure functions. backend = the real server started against a real database, driven
// through its API. integration = the frontend pointed at a fake server. e2e = the real environment
export const LAYERS = ["unit", "backend", "integration", "e2e"] as const;
export type Layer = (typeof LAYERS)[number];
export type TestStatus = "Green" | "Red" | "Skip";

export interface TestCaseResult {
  layer: Layer;
  /** Path of the file the result was read from (for display) */
  source: string;
  classname: string;
  name: string;
  status: TestStatus;
  /** A pseudo-result built from an outcome marker (`[ESDD-OUTCOME] <tag>`), not a test case itself */
  marker?: true;
}

/** The test ID that owned_by refers to. The trace table shows tests in this form */
export function testId(t: Pick<TestCaseResult, "classname" | "name">): string {
  return t.classname ? `${t.classname}#${t.name}` : t.name;
}

export type NodeKind =
  | "scenario"
  | "rule_case"
  | "transition"
  | "ignored"
  | "race"
  | "race_outcome"
  | "outcome"
  | "input_cell";

export interface TraceNode {
  id: string;
  kind: NodeKind;
  label: string;
  critical: boolean;
  /** Whether a test-name tag can point at it directly (input cells contain "×", so they are derived via covers only) */
  taggable: boolean;
  /** Nodes that exercise / cover this node (the derivation source when there is no direct test) */
  coveredBy: string[];
}

export type Verdict = "Green" | "Red" | "Skip" | "untested" | "uncovered";

export interface TraceRow {
  node: string;
  kind: NodeKind;
  label: string;
  critical: boolean;
  verdict: Verdict;
  /** Per-layer result (direct tests only; for a derived verdict see via) */
  layers: Partial<Record<Layer, TestStatus>>;
  /** IDs of the tests the verdict is based on */
  tests: string[];
  /** The source nodes when the verdict is derived */
  via?: string[];
  /** The reason when untested */
  reason?: string;
  /** Negative control status (only for nodes Green through a direct test; otherwise not applicable) */
  nc?: NcStatus | "missing";
  /** Where the negative control records came from (scenario file path / trace.yaml) */
  ncSources?: string[];
}

export type NcStatus = "verified" | "pending" | "not-applicable";

/** One negative control (same shape as the scenario-file convention in docs/trace.md) */
export interface NcControl {
  oracle: string;
  breakage: string;
  observed_failure: string;
  verified: string;
  /** Which layer's oracle was broken (trace.yaml only, optional) */
  layer?: Layer;
  ref?: string;
}

export interface NcEntry {
  status: NcStatus;
  controls?: NcControl[];
  reason?: string;
}

/** A node tag (`<usecase>__<node>`) → the sources that recorded a negative control for it */
export type ScenarioControls = Map<string, { status: NcStatus; source: string }[]>;

export interface TraceDoc {
  trace: string;
  /** node → why it has no test */
  untested?: Record<string, string>;
  /** node → IDs (`<classname>#<name>`) of existing tests that carry no tag */
  owned_by?: Record<string, string | string[]>;
  /** node → negative control record (for layers without a scenario file) */
  negative_controls?: Record<string, NcEntry>;
}

// Same markers as checks.ts: an unanswered question left in an untested reason

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---- JUnit XML ----

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|lt|gt|amp|quot|apos);/g, (_, e: string) => {
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "amp") return "&";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    const code = e.startsWith("#x") ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

function parseAttributes(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const m of s.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attrs[m[1]!] = decodeEntities(m[2] ?? m[3] ?? "");
  }
  return attrs;
}

/**
 * Extracts test cases from JUnit XML (the form emitted by vitest / Playwright / Gradle /
 * gotestsum and most CI tools). failure / error → Red, skipped → Skip, anything else → Green.
 */
export function parseJUnit(xml: string, layer: Layer, source: string): TestCaseResult[] {
  const results: TestCaseResult[] = [];
  const re = /<testcase\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  for (const m of xml.matchAll(re)) {
    const attrs = parseAttributes(m[1] ?? "");
    const body = m[3] ?? "";
    const status: TestStatus = /<(failure|error)\b/.test(body)
      ? "Red"
      : /<skipped\b/.test(body)
        ? "Skip"
        : "Green";
    results.push({
      layer,
      source,
      classname: attrs["classname"] ?? "",
      name: attrs["name"] ?? "",
      status,
    });
  }
  return results;
}

/**
 * Extracts test results from `go test -json` output (one event per line).
 * Go replaces spaces in subtest names with `_`, but the tag `<usecase>__<node>` survives as is.
 */
export function parseGoTestJson(text: string, layer: Layer, source: string): TestCaseResult[] {
  const results: TestCaseResult[] = [];
  const statusOf: Record<string, TestStatus> = { pass: "Green", fail: "Red", skip: "Skip" };
  for (const line of text.split("\n")) {
    if (!line.startsWith("{")) continue;
    let event: { Action?: string; Package?: string; Test?: string };
    try {
      event = JSON.parse(line) as typeof event;
    } catch {
      continue;
    }
    const status = event.Action ? statusOf[event.Action] : undefined;
    if (!event.Test || !status) continue;
    results.push({ layer, source, classname: event.Package ?? "", name: event.Test, status });
  }
  return results;
}

// A line the test prints right after an assert passes. Its presence is itself the evidence
// that the outcome's assert passed (if the assert fails, the line is never reached)
const OUTCOME_MARKER = /\[ESDD-OUTCOME\]\s+(UC-[A-Z0-9-]+__[A-Za-z0-9_-]+)/g;

/**
 * Picks up outcome markers from text (JUnit XML system-out, go test -json Output, a device
 * log, …) and turns them into Green pseudo-results. The same tag in the same file counts once.
 */
export function parseOutcomeMarkers(text: string, layer: Layer, source: string): TestCaseResult[] {
  const tags = new Set<string>();
  for (const m of text.matchAll(OUTCOME_MARKER)) tags.add(m[1]!);
  return [...tags].map((tag) => ({
    layer,
    source,
    classname: "[ESDD-OUTCOME]",
    name: tag,
    status: "Green" as const,
    marker: true as const,
  }));
}

// ---- trace.yaml ----

const TRACE_KEYS = ["trace", "untested", "owned_by", "negative_controls"];

export function parseTrace(source: string): { doc: TraceDoc | undefined; findings: Finding[] } {
  const fail = (message: string) => ({
    doc: undefined,
    findings: [{ level: "error" as const, check: "trace-schema", message }],
  });
  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (e) {
    return fail(`cannot parse YAML: ${(e as Error).message}`);
  }
  if (!isRecord(raw)) return fail("the top level must be a map");
  if (typeof raw["trace"] !== "string" || raw["trace"] === "") {
    return fail("trace (the target usecase id) is required");
  }
  const findings: Finding[] = [];
  for (const key of ["untested", "owned_by", "negative_controls"]) {
    if (raw[key] !== undefined && raw[key] !== null && !isRecord(raw[key])) {
      findings.push({
        level: "error",
        check: "trace-schema",
        message: `${key} must be a map (node → value)`,
      });
    }
  }
  const unknown = Object.keys(raw).filter((k) => !TRACE_KEYS.includes(k));
  if (unknown.length > 0) {
    findings.push({
      level: "error",
      check: "trace-schema",
      message: `unknown keys: ${unknown.join(", ")} (only ${TRACE_KEYS.join(" / ")})`,
    });
  }
  if (isRecord(raw["negative_controls"])) {
    for (const [node, entry] of Object.entries(raw["negative_controls"])) {
      for (const problem of validateNcEntry(entry)) {
        findings.push({
          level: "error",
          check: "trace-schema",
          message: `negative_controls.${node}: ${problem}`,
        });
      }
    }
  }
  if (findings.length > 0) return { doc: undefined, findings };
  return {
    doc: {
      trace: raw["trace"],
      untested: (raw["untested"] ?? undefined) as TraceDoc["untested"],
      owned_by: (raw["owned_by"] ?? undefined) as TraceDoc["owned_by"],
      negative_controls: (raw["negative_controls"] ?? undefined) as TraceDoc["negative_controls"],
    },
    findings,
  };
}

// ---- negative control ----

const NC_STATUSES = new Set(["verified", "pending", "not-applicable"]);
const NC_CONTROL_REQUIRED = ["oracle", "breakage", "observed_failure", "verified"];
const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

function nonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

/**
 * Structural check of one node's negative control (docs/trace.md): verified needs at least one
 * control whose `verified` starts with a date; pending / not-applicable need a reason.
 */
function validateNcEntry(entry: unknown): string[] {
  if (!isRecord(entry)) return ["write it as a map (status / controls / reason)"];
  const problems: string[] = [];
  const status = entry["status"];
  if (typeof status !== "string" || !NC_STATUSES.has(status)) {
    return [`status must be one of ${[...NC_STATUSES].join(" / ")}: ${JSON.stringify(status)}`];
  }
  const controls = entry["controls"];
  if (status === "verified") {
    if (!Array.isArray(controls) || controls.length === 0) {
      return ["status: verified needs at least one entry in controls"];
    }
    controls.forEach((c, i) => {
      if (!isRecord(c)) {
        problems.push(`controls[${i}] must be a map`);
        return;
      }
      for (const key of NC_CONTROL_REQUIRED) {
        if (!nonEmpty(c[key])) problems.push(`controls[${i}].${key} is empty`);
      }
      if (nonEmpty(c["verified"]) && !DATE_PREFIX.test(c["verified"].trim())) {
        problems.push(`controls[${i}].verified must start with a date (YYYY-MM-DD)`);
      }
      if (c["layer"] !== undefined && !(LAYERS as readonly unknown[]).includes(c["layer"])) {
        problems.push(`controls[${i}].layer must be one of ${LAYERS.join(" / ")}`);
      }
    });
  } else if (!nonEmpty(entry["reason"])) {
    problems.push(`status: ${status} needs a reason`);
  }
  return problems;
}

/**
 * Collects, from scenario / test files, the negative control records whose controls[].nodes
 * name IR nodes. nodes use the same tag as test names: `<usecase>__<node>`.
 * Only nodes attached to a verified negative_control count; validating the rest of the
 * scenario file's structure is left to the project's own tooling.
 */
export function collectScenarioControls(files: { path: string; text: string }[]): ScenarioControls {
  const map: ScenarioControls = new Map();
  for (const { path, text } of files) {
    let raw: unknown;
    try {
      raw = parseYaml(text);
    } catch {
      continue;
    }
    if (!isRecord(raw) || !isRecord(raw["negative_control"])) continue;
    const nc = raw["negative_control"];
    if (nc["status"] !== "verified" || !Array.isArray(nc["controls"])) continue;
    for (const c of nc["controls"]) {
      if (!isRecord(c) || !Array.isArray(c["nodes"])) continue;
      for (const tag of c["nodes"]) {
        if (typeof tag !== "string") continue;
        const list = map.get(tag) ?? [];
        if (!list.some((e) => e.source === path)) list.push({ status: "verified", source: path });
        map.set(tag, list);
      }
    }
  }
  return map;
}

// ---- the node universe ----

export function transitionNodeId(from: string, on: string): string {
  return `T-${from}-${on}`;
}

export function ruleCaseNodeId(ruleId: string, index: number): string {
  return `${ruleId}-c${index + 1}`;
}

export function raceNodeId(state: string, between: readonly [string, string]): string {
  return `RACE-${state}-${between[0]}-${between[1]}`;
}

export function outcomeNodeId(transitionId: string, index: number): string {
  return `${transitionId}-o${index + 1}`;
}

export function thenNodeId(scenarioId: string, index: number): string {
  return `${scenarioId}-t${index + 1}`;
}

export function raceOutcomeNodeId(raceId: string): string {
  return `${raceId}-outcome`;
}

function formatOutcome(outcome: OutcomeItem[] | undefined): string {
  return (outcome ?? [])
    .map((o) =>
      typeof o === "string" ? o : [o.surface, o.ui ?? o.observation].filter(Boolean).join(": "),
    )
    .join(" / ");
}

/** Replays a scenario path from initial and returns the cells it exercises (same cut-off rule as the paths check) */
function walkedCells(model: Model, path: string[]): string[] {
  const cells: string[] = [];
  if (!model.initial) return cells;
  let current = model.initial;
  for (const event of path) {
    const cell = model.cells.get(cellKey(current, event))?.[0];
    if (!cell || cell.impossible) break;
    cells.push(cellKey(current, event));
    current = cell.to!;
  }
  return cells;
}

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/** Enumerates every behavior node the IR defines (assumes the IR passed its checks) */
export function enumerateNodes(model: Model): TraceNode[] {
  const nodes: TraceNode[] = [];
  const ir = model.ir;

  for (const sc of ir.scenarios ?? []) {
    nodes.push({
      id: sc.id,
      kind: "scenario",
      label: sc.name,
      critical: sc.critical === true,
      taggable: true,
      coveredBy: [],
    });
    // In form mode the expected results are written directly in then
    // (in states mode they are the transitions' outcome)
    if (!model.hasStateMachine) {
      (sc.then ?? []).forEach((t, i) => {
        nodes.push({
          id: thenNodeId(sc.id, i),
          kind: "outcome",
          label: `${sc.id}: ${t}`,
          critical: sc.critical === true,
          taggable: true,
          coveredBy: [],
        });
      });
    }
  }

  for (const rule of ir.rules ?? []) {
    rule.cases.forEach((c, i) => {
      const expected = typeof c.expected === "string" ? c.expected : JSON.stringify(c.expected);
      nodes.push({
        id: ruleCaseNodeId(rule.id, i),
        kind: "rule_case",
        label: `${rule.name}: ${JSON.stringify(c.input)} → ${expected}`,
        critical: false,
        taggable: true,
        coveredBy: [],
      });
    });
  }

  if (model.hasStateMachine) {
    const walkers = new Map<string, string[]>();
    for (const sc of ir.scenarios ?? []) {
      for (const key of walkedCells(model, sc.path ?? [])) {
        walkers.set(key, [...(walkers.get(key) ?? []), sc.id]);
      }
    }
    for (const list of model.cells.values()) {
      const c = list[0]!;
      if (model.states.get(c.from)?.terminal) continue;
      // An ignored event can arrive, so it gets a node: a test confirms the state and the display do not change
      if (c.ignored) {
        nodes.push({
          id: transitionNodeId(c.from, c.on),
          kind: "ignored",
          label: `${c.from} × ${c.on} is ignored — ${c.reason}`,
          critical: false,
          taggable: true,
          coveredBy: [],
        });
        continue;
      }
      if (c.impossible) continue;
      nodes.push({
        id: transitionNodeId(c.from, c.on),
        kind: "transition",
        label: `${c.from} × ${c.on} → ${c.to}`,
        critical: false,
        taggable: true,
        coveredBy: walkers.get(cellKey(c.from, c.on)) ?? [],
      });
      // A scenario walking the path does not mean each outcome of the transition was asserted.
      // Each outcome item is its own node, confirmed by the marker printed right after its assert
      (c.outcome ?? []).forEach((o, i) => {
        nodes.push({
          id: outcomeNodeId(transitionNodeId(c.from, c.on), i),
          kind: "outcome",
          label: `${c.from} × ${c.on}: ${formatOutcome([o])}`,
          critical: false,
          taggable: true,
          coveredBy: [],
        });
      });
    }
    // A race is split into two claims. Who wins is a property of the backend's mutual exclusion
    // (row lock + state guard); what the losing side sees is a property of the frontend showing
    // the error — they are confirmed at different layers
    for (const r of ir.races ?? []) {
      const id = raceNodeId(r.state, r.between);
      nodes.push({
        id,
        kind: "race",
        label: `${r.state}: ${r.between.join(" vs ")} → ${raceWinnerText(r.winner)}`,
        critical: false,
        taggable: true,
        coveredBy: [],
      });
      nodes.push({
        id: raceOutcomeNodeId(id),
        kind: "race_outcome",
        label: `${r.state}: what the losing side of ${r.between.join(" vs ")} sees — ${formatOutcome(r.outcome)}`,
        critical: false,
        taggable: true,
        coveredBy: [],
      });
    }
  }

  const conds = inputConditions(model);
  const claimers = new Map<string, string[]>();
  const claim = (ref: string, nodeId: string) => {
    const key = ref
      .split("×")
      .map((s) => s.trim())
      .join("×");
    claimers.set(key, [...(claimers.get(key) ?? []), nodeId]);
  };
  for (const sc of ir.scenarios ?? []) {
    for (const ref of toArray(sc.covers)) claim(ref, sc.id);
  }
  for (const rule of ir.rules ?? []) {
    rule.cases.forEach((c, i) => {
      for (const ref of toArray(c.covers)) claim(ref, ruleCaseNodeId(rule.id, i));
    });
  }
  for (const inp of ir.inputs ?? []) {
    for (const cond of conds.get(inp.id) ?? []) {
      if (inp.na !== undefined && cond in inp.na) continue;
      const id = `${inp.id}×${cond}`;
      nodes.push({
        id,
        kind: "input_cell",
        label: id,
        critical: false,
        taggable: false,
        coveredBy: claimers.get(id) ?? [],
      });
    }
  }
  return nodes;
}

// ---- tag extraction ----

// Characters that may not follow a node ID (seeing one means the ID has not ended yet).
// Letters, digits and - never continue a match, so `SC-001` vs `SC-001-A` and
// `RULE-001-c1` vs `RULE-001-c10` are not confused
const NODE_CONTINUATION = /[A-Za-z0-9-]/;

/**
 * Extracts `<usecase>__<node>` tags from a test name (classname + name).
 * The node is the longest match among known IDs, so a description may follow the tag after
 * a `_` separator (e.g. a method name like `UC-X__SC-001_cancel`).
 */
export function extractTags(
  text: string,
  usecase: string,
  nodeIds: Set<string>,
): { nodes: string[]; unknown: string[] } {
  const nodes: string[] = [];
  const unknown: string[] = [];
  const prefix = `${usecase}__`;
  let from = 0;
  for (;;) {
    const at = text.indexOf(prefix, from);
    if (at < 0) break;
    // Leading boundary of the usecase ID (do not read UC-X-0011__ as a tag of UC-X-001)
    const before = at > 0 ? text[at - 1]! : "";
    from = at + prefix.length;
    if (before !== "" && NODE_CONTINUATION.test(before)) continue;
    const rest = text.slice(from);
    let best: string | undefined;
    for (const id of nodeIds) {
      if (!rest.startsWith(id)) continue;
      const next = rest[id.length];
      if (next !== undefined && NODE_CONTINUATION.test(next)) continue;
      if (best === undefined || id.length > best.length) best = id;
    }
    if (best !== undefined) {
      nodes.push(best);
    } else {
      unknown.push(rest.match(/^[A-Za-z0-9-]*/)![0]);
    }
  }
  return { nodes, unknown };
}

// ---- cross-check ----

export interface TraceResult {
  rows: TraceRow[];
  findings: Finding[];
}

const STATUS_RANK: Record<TestStatus, number> = { Green: 2, Red: 1, Skip: 0 };

function bestStatus(statuses: TestStatus[]): TestStatus | undefined {
  let best: TestStatus | undefined;
  for (const s of statuses) {
    if (best === undefined || STATUS_RANK[s] > STATUS_RANK[best]) best = s;
  }
  return best;
}

// When a node has both Green and Red, do not let Green hide the Red (keep the fact that one layer fails)
function nodeVerdict(statuses: TestStatus[]): TestStatus | undefined {
  if (statuses.includes("Red")) return "Red";
  return bestStatus(statuses);
}

export function runTrace(
  model: Model,
  results: TestCaseResult[],
  doc?: TraceDoc,
  scenarioControls: ScenarioControls = new Map(),
): TraceResult {
  const findings: Finding[] = [];
  const usecase = model.ir.usecase;
  const nodes = enumerateNodes(model);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const taggableIds = new Set(nodes.filter((n) => n.taggable).map((n) => n.id));

  if (doc && doc.trace !== usecase) {
    findings.push({
      level: "error",
      check: "trace-usecase",
      message: `the trace target (${doc.trace}) does not match the IR's usecase (${usecase})`,
    });
    return { rows: [], findings };
  }

  // node → direct tests
  const direct = new Map<string, TestCaseResult[]>();
  const attach = (nodeId: string, t: TestCaseResult) => {
    const list = direct.get(nodeId) ?? [];
    if (!list.includes(t)) list.push(t);
    direct.set(nodeId, list);
  };

  for (const t of results) {
    const { nodes: tagged, unknown } = extractTags(`${t.classname} ${t.name}`, usecase, taggableIds);
    for (const id of tagged) {
      if (t.marker && byId.get(id)?.kind !== "outcome") {
        findings.push({
          level: "error",
          check: "trace-tag",
          message: `${t.source} (${t.layer}): marker [ESDD-OUTCOME] ${usecase}__${id} is not an outcome node (print markers right after an outcome's assert; point at scenarios etc. with a test-name tag)`,
        });
        continue;
      }
      attach(id, t);
    }
    for (const u of unknown) {
      findings.push({
        level: "error",
        check: "trace-tag",
        message: `${testId(t)} (${t.layer}): tag ${usecase}__${u} names no node in the IR (a typo, or a node removed from the IR; input cells cannot be tagged — tag the node that covers them)`,
      });
    }
  }

  for (const [nodeId, refs] of Object.entries(doc?.owned_by ?? {})) {
    if (!byId.has(nodeId)) {
      findings.push({
        level: "error",
        check: "trace-owned-by",
        message: `owned_by.${nodeId}: no such node in the IR`,
      });
      continue;
    }
    for (const ref of toArray(refs as string | string[])) {
      const hit = results.filter((t) => testId(t) === ref);
      if (hit.length === 0) {
        findings.push({
          level: "error",
          check: "trace-owned-by",
          message: `owned_by.${nodeId}: test ${ref} is not in the results (a test that did not run cannot own a node; pass its results with --results or check the ID)`,
        });
      }
      for (const t of hit) attach(nodeId, t);
    }
  }

  const untested = doc?.untested ?? {};
  for (const [nodeId, reason] of Object.entries(untested)) {
    if (!byId.has(nodeId)) {
      findings.push({
        level: "error",
        check: "trace-untested",
        message: `untested.${nodeId}: no such node in the IR`,
      });
    } else if (typeof reason !== "string" || reason.trim() === "") {
      findings.push({
        level: "error",
        check: "trace-untested",
        message: `untested.${nodeId}: a reason is required`,
      });
    } else {
      const marker = findPendingMarker(reason);
      if (marker) {
        findings.push({
          level: "warn",
          check: "pending",
          message: `untested.${nodeId}: the reason still contains "${marker}"`,
        });
      }
    }
  }

  const directVerdict = (nodeId: string): TestStatus | undefined =>
    nodeVerdict((direct.get(nodeId) ?? []).map((t) => t.status));

  // Negative control records. A rule-level key (RULE-001) applies to all of its cases
  // (a table-driven test shares one oracle across all rows, so one breakage fails every row)
  const ruleIds = new Set((model.ir.rules ?? []).map((r) => r.id));
  const ncDoc = doc?.negative_controls ?? {};
  for (const key of Object.keys(ncDoc)) {
    if (!byId.has(key) && !ruleIds.has(key)) {
      findings.push({
        level: "error",
        check: "trace-nc",
        message: `negative_controls.${key}: no such node in the IR`,
      });
    }
  }
  const tagPrefix = `${usecase}__`;
  for (const [tag, sources] of scenarioControls) {
    if (!tag.startsWith(tagPrefix)) continue;
    const key = tag.slice(tagPrefix.length);
    if (!byId.has(key) && !ruleIds.has(key)) {
      findings.push({
        level: "error",
        check: "trace-nc",
        message: `${sources.map((e) => e.source).join(", ")}: negative_control nodes entry ${tag} names no node in the IR`,
      });
    }
  }
  const ncRecords = (n: TraceNode): { status: NcStatus; source: string }[] => {
    const keys = [n.id];
    if (n.kind === "rule_case") keys.push(n.id.replace(/-c\d+$/, ""));
    const records: { status: NcStatus; source: string }[] = [];
    for (const key of keys) {
      const entry = ncDoc[key];
      if (entry) records.push({ status: entry.status, source: `trace.yaml (${key})` });
      records.push(...(scenarioControls.get(`${tagPrefix}${key}`) ?? []));
    }
    return records;
  };

  const rows: TraceRow[] = [];
  for (const n of nodes) {
    const tests = direct.get(n.id) ?? [];
    const layers: Partial<Record<Layer, TestStatus>> = {};
    for (const layer of LAYERS) {
      const s = nodeVerdict(tests.filter((t) => t.layer === layer).map((t) => t.status));
      if (s) layers[layer] = s;
    }
    const row: TraceRow = {
      node: n.id,
      kind: n.kind,
      label: n.label,
      critical: n.critical,
      verdict: "uncovered",
      layers,
      tests: tests.map(testId),
    };

    let verdict: TestStatus | undefined = directVerdict(n.id);
    if (verdict === undefined && n.coveredBy.length > 0) {
      // Without a direct test, derive from the nodes that exercise / cover this node
      const viaStatuses = n.coveredBy
        .map((id) => [id, directVerdict(id)] as const)
        .filter((e): e is readonly [string, TestStatus] => e[1] !== undefined);
      verdict = bestStatus(viaStatuses.map((e) => e[1]));
      if (verdict !== undefined) {
        row.via = viaStatuses.filter((e) => e[1] === verdict).map((e) => e[0]);
      }
    }

    const reason = typeof untested[n.id] === "string" ? untested[n.id] : undefined;
    if (verdict !== undefined) {
      row.verdict = verdict;
      if (reason !== undefined) {
        findings.push({
          level: "warn",
          check: "trace-untested",
          message: `untested.${n.id}: a test exists (${verdict}). The untested declaration may be stale — make the two agree`,
        });
      }
      if (verdict !== "Green") {
        findings.push({
          level: "warn",
          check: "trace-failing",
          message: `${n.id} (${n.label}): tests exist but none is Green (${verdict})`,
        });
      }
    } else if (reason !== undefined) {
      row.verdict = "untested";
      row.reason = reason;
    } else {
      findings.push({
        level: "error",
        check: "trace-uncovered",
        message:
          `${n.id} (${n.label}): not confirmed by a test at any layer. ` +
          (n.kind === "input_cell"
            ? "Run the tests of a node that covers it, or "
            : n.kind === "outcome"
              ? `Print [ESDD-OUTCOME] ${usecase}__${n.id} right after asserting this outcome (walking the path does not count as asserting it), point at an existing test with owned_by, or `
              : `Put ${usecase}__${n.id} in a test name, point at an existing test with owned_by, or `) +
          "declare a reason under untested",
      });
    }

    // Green through a direct test = a row where we can ask whether the oracle is real.
    // Derived, Red, and untested rows are out of scope
    const records = ncRecords(n);
    // An outcome is a fine-grained node (one assert). The breakage proof is asked of the test
    // that contains it (the scenario etc.) — a record shows in the NC column but is not required
    const ncRequired = n.kind !== "outcome" && directVerdict(n.id) === "Green";
    if (ncRequired || records.length > 0) {
      const statuses = records.map((r) => r.status);
      row.nc = statuses.includes("verified")
        ? "verified"
        : statuses.includes("not-applicable")
          ? "not-applicable"
          : statuses.includes("pending")
            ? "pending"
            : "missing";
      row.ncSources = [...new Set(records.map((r) => r.source))];
    }
    if (ncRequired && row.nc === "missing") {
      findings.push({
        level: "error",
        check: "trace-nc",
        message:
          `${n.id} (${n.label}): Green, but there is no negative control record (proof that the test fails when its oracle is broken). ` +
          `Add ${usecase}__${n.id} to negative_control.controls[].nodes in the scenario file (--scenarios), ` +
          "or record it under negative_controls in trace.yaml",
      });
    } else if (ncRequired && row.nc === "pending") {
      findings.push({
        level: "warn",
        check: "trace-nc",
        message: `${n.id} (${n.label}): the negative control is pending (no grounds yet to trust the Green)`,
      });
    }

    // E2E cannot create race timing deterministically. The winner is confirmed by a sequential
    // backend test (a fixture puts the system in the state after the winner won; the loser's
    // operation then errors), and what the loser sees by an integration test (the fake returns
    // the loser's error)
    if (n.kind === "race" || n.kind === "race_outcome") {
      const where =
        n.kind === "race"
          ? "a backend test (build the winner's state with a fixture; assert the loser's operation errors and the state is unchanged)"
          : "an integration test (the fake returns the loser's error; assert what is shown)";
      // The winner is decided by the backend's mutual exclusion, so a fake-server integration test or E2E proves nothing
      const provingLayers: Layer[] =
        n.kind === "race" ? ["unit", "backend"] : ["unit", "backend", "integration"];
      if (tests.length > 0 && !tests.some((t) => provingLayers.includes(t.layer))) {
        const why =
          n.kind === "race"
            ? "The winner is decided by the backend's mutual exclusion, which fake-server or E2E timing cannot confirm, so"
            : "E2E cannot create race timing deterministically, so";
        findings.push({
          level: "warn",
          check: "trace-race",
          message: `${n.id} (${n.label}): only confirmed at ${[...new Set(tests.map((t) => t.layer))].join(" / ")}. ${why} move it down to ${where}`,
        });
      } else if (row.verdict === "untested") {
        findings.push({
          level: "warn",
          check: "trace-race",
          message: `${n.id} (${n.label}): untested. First check whether ${where} can create it deterministically, or whether an existing test already owns it (owned_by)`,
        });
      }
    }

    if (n.critical && layers.e2e === undefined && reason === undefined) {
      findings.push({
        level: "warn",
        check: "trace-critical",
        message: `${n.id} (${n.label}): critical, but there is no E2E result`,
      });
    }
    rows.push(row);
  }
  return { rows, findings };
}

// ---- output ----

function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

/** The trace table, ready to paste into a report (markdown) */
export function formatTraceTable(rows: TraceRow[]): string {
  const lines = [
    "| node | kind | behavior | unit | backend | integration | e2e | verdict | NC |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows) {
    const verdict =
      r.verdict === "untested"
        ? `untested (${r.reason ?? ""})`
        : r.verdict === "uncovered"
          ? "**uncovered**"
          : r.via
            ? `${r.verdict} (via ${r.via.join(", ")})`
            : r.verdict;
    lines.push(
      `| ${r.node}${r.critical ? " (critical)" : ""} | ${r.kind} | ${cell(r.label)} | ${r.layers.unit ?? ""} | ${r.layers.backend ?? ""} | ${r.layers.integration ?? ""} | ${r.layers.e2e ?? ""} | ${cell(verdict)} | ${formatNc(r)} |`,
    );
  }
  return lines.join("\n");
}

/** The NC column. Blank when not applicable (derived / Red / untested with no record) */
export function formatNc(r: TraceRow): string {
  if (r.nc === undefined) return "";
  return r.nc === "missing" ? "**missing**" : r.nc;
}

export function traceSummary(rows: TraceRow[]): string {
  const count = (v: Verdict) => rows.filter((r) => r.verdict === v).length;
  const nc = (v: TraceRow["nc"]) => rows.filter((r) => r.nc === v).length;
  return (
    `behavior trace: ${rows.length} nodes — Green ${count("Green")} / Red ${count("Red")} / ` +
    `Skip ${count("Skip")} / untested ${count("untested")} / uncovered ${count("uncovered")}` +
    ` — NC verified ${nc("verified")} / pending ${nc("pending")} / not-applicable ${nc("not-applicable")} / missing ${nc("missing")}`
  );
}
