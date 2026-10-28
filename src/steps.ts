// Parsing and checking of ESDD step definitions (the step vocabulary).
// Format and role: docs/generation.md "Step definitions and scenario files"
//
// The IR says what happens in prose and the bindings say what the screen's elements are;
// the step definitions say which test operation each phrase is. Generation is reliable only
// when every phrase a test needs resolves, so this check enforces that over the full
// population the IR declares — the same philosophy as literal_coverage.

import { parse as parseYaml } from "yaml";
import type { Finding, Model, OutcomeItem } from "./types.ts";

export type StateStep = { fixture: string };
export type GivenStep = { state: string; fixture?: undefined } | { fixture: string; state?: undefined };
export type EventStep = { screen: string; fixture?: undefined } | { fixture: string; screen?: undefined };
export type OutcomeStep =
  | { expect: string; not?: string; args?: string[]; unresolved?: undefined }
  | { unresolved: string; expect?: undefined };
export interface RuleStep {
  function: { name: string; from: string };
  cases: { args: unknown[]; returns: unknown }[];
}

export interface StepsDoc {
  /** Target usecase id */
  steps: string;
  /** A state a test starts from → the fixture that builds it (states mode) */
  states?: Record<string, StateStep>;
  /** Scenario given text → the state it describes, or the fixture that builds it */
  givens?: Record<string, GivenStep>;
  /** IR event → a method on the actor's screen, or a fixture (actor: system) */
  events?: Record<string, EventStep>;
  /** Outcome text → its assertion and negation, or why it cannot be asserted yet */
  outcomes?: Record<string, OutcomeStep>;
  /** Rule id → the pure function and one entry per IR case, in IR order */
  rules?: Record<string, RuleStep>;
}

const SECTIONS = ["states", "givens", "events", "outcomes", "rules"] as const;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const isText = (v: unknown): v is string => typeof v === "string" && v !== "";

/** The text a step definition is keyed by: the string itself, or a structured item's ui / observation */
export function outcomeText(o: OutcomeItem): string {
  return typeof o === "string" ? o : (o.ui ?? o.observation ?? JSON.stringify(o));
}

/** Shape the YAML into a StepsDoc. Structural errors accumulate as findings; the doc is returned best-effort */
export function parseSteps(source: string): { doc: StepsDoc | undefined; findings: Finding[] } {
  const findings: Finding[] = [];
  const err = (message: string) => findings.push({ level: "error", check: "steps-schema", message });
  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (e) {
    err(`cannot parse YAML: ${(e as Error).message}`);
    return { doc: undefined, findings };
  }
  if (!isRecord(raw)) {
    err("the top level must be a map");
    return { doc: undefined, findings };
  }
  if (!isText(raw.steps)) err("steps must be a string holding the target usecase id");
  for (const key of Object.keys(raw)) {
    if (key !== "steps" && !(SECTIONS as readonly string[]).includes(key)) {
      err(`unknown key ${key} (allowed: steps, ${SECTIONS.join(", ")})`);
    }
  }
  for (const section of SECTIONS) {
    if (raw[section] !== undefined && !isRecord(raw[section])) err(`${section} must be a map`);
  }
  if (findings.length > 0) return { doc: undefined, findings };

  const entries = (section: (typeof SECTIONS)[number]) => Object.entries((raw[section] ?? {}) as Record<string, unknown>);
  const exactlyOne = (at: string, v: unknown, keys: [string, string]) => {
    if (!isRecord(v) || keys.filter((k) => isText(v[k])).length !== 1 || Object.keys(v).length !== 1) {
      err(`${at}: write exactly one of ${keys[0]}: <name> or ${keys[1]}: <name>`);
    }
  };
  for (const [id, v] of entries("states")) {
    if (!isRecord(v) || !isText(v.fixture) || Object.keys(v).length !== 1) err(`states.${id}: write fixture: <name>`);
  }
  for (const [text, v] of entries("givens")) exactlyOne(`givens."${text}"`, v, ["state", "fixture"]);
  for (const [id, v] of entries("events")) exactlyOne(`events.${id}`, v, ["screen", "fixture"]);
  for (const [text, v] of entries("outcomes")) {
    const at = `outcomes."${text}"`;
    if (!isRecord(v)) {
      err(`${at}: must be a map`);
    } else if ("unresolved" in v) {
      if (!isText(v.unresolved) || Object.keys(v).length !== 1) {
        err(`${at}: unresolved takes a non-empty reason and nothing else`);
      }
    } else if (!isText(v.expect)) {
      err(`${at}: write expect: <method> (with optional not / args), or unresolved: <reason>`);
    } else {
      const unknown = Object.keys(v).filter((k) => !["expect", "not", "args"].includes(k));
      if (unknown.length > 0) err(`${at}: unknown key ${unknown.join(", ")}`);
      if (v.not !== undefined && !isText(v.not)) err(`${at}: not must be a method name`);
      if (v.args !== undefined && !(Array.isArray(v.args) && v.args.every(isText))) {
        err(`${at}: args must be a list of strings`);
      }
    }
  }
  for (const [id, v] of entries("rules")) {
    const at = `rules.${id}`;
    if (!isRecord(v) || !isRecord(v.function) || !isText(v.function.name) || !isText(v.function.from)) {
      err(`${at}: write function: { name: <function>, from: <module> }`);
    } else if (!Array.isArray(v.cases) || !v.cases.every((c) => isRecord(c) && Array.isArray(c.args) && "returns" in c)) {
      err(`${at}: cases must be a list of { args: [...], returns: ... }`);
    }
  }
  return { doc: raw as unknown as StepsDoc, findings };
}

/** What the IR asks the step definitions to cover. Each list is in IR order, without duplicates */
function universe(model: Model) {
  const ir = model.ir;
  const outcomes: string[] = [];
  if (model.hasStateMachine) {
    for (const list of model.cells.values()) {
      for (const c of list) if (!c.impossible) outcomes.push(...(c.outcome ?? []).map(outcomeText));
    }
    for (const race of ir.races ?? []) outcomes.push(...race.outcome.map(outcomeText));
  } else {
    // form mode: a scenario's then items are its outcomes
    for (const sc of ir.scenarios) outcomes.push(...(sc.then ?? []));
  }
  const startStates = model.hasStateMachine
    ? [model.initial ?? "", ...(ir.races ?? []).map((r) => r.state)].filter((s) => s !== "")
    : [];
  return {
    startStates: new Set(startStates),
    givens: new Set(ir.scenarios.flatMap((sc) => sc.given ?? [])),
    events: new Set(model.events.keys()),
    outcomes: new Set(outcomes),
    rules: new Map((ir.rules ?? []).map((r) => [r.id, r.cases.length])),
  };
}

/** Full-population cross-check: every IR phrase resolves, and every definition names something in the IR */
function checkCoverage(doc: StepsDoc, model: Model, findings: Finding[]): void {
  const u = universe(model);
  const missing = (message: string) => findings.push({ level: "error", check: "steps-coverage", message });
  const stale = (at: string, what: string) =>
    missing(`${at}: ${what} does not exist in the IR (a typo, or the IR changed — update or remove the definition)`);

  for (const s of u.startStates) {
    if (!doc.states?.[s]) missing(`state ${s} is a start state (the initial state or a race state) with no fixture in states`);
  }
  for (const s of Object.keys(doc.states ?? {})) if (!model.states.has(s)) stale(`states.${s}`, "the state");

  for (const g of u.givens) if (!doc.givens?.[g]) missing(`given "${g}" has no step definition`);
  for (const [g, def] of Object.entries(doc.givens ?? {})) {
    if (!u.givens.has(g)) {
      stale(`givens."${g}"`, "the given");
    } else if (def.state !== undefined) {
      if (!model.states.has(def.state)) {
        missing(`givens."${g}": state ${def.state} does not exist in the IR`);
      } else if (model.initial !== undefined && def.state !== model.initial) {
        // Every path starts at the initial state, so a given that describes another state disagrees with it
        findings.push({
          level: "warn",
          check: "steps-given-state",
          message: `givens."${g}" describes ${def.state}, but every path starts at ${model.initial} — put it on the question list`,
        });
      }
    }
  }

  for (const e of u.events) if (!doc.events?.[e]) missing(`event ${e} has no step definition`);
  for (const e of Object.keys(doc.events ?? {})) if (!u.events.has(e)) stale(`events.${e}`, "the event");

  for (const o of u.outcomes) if (!doc.outcomes?.[o]) missing(`outcome "${o}" has no step definition`);
  for (const [o, def] of Object.entries(doc.outcomes ?? {})) {
    if (!u.outcomes.has(o)) {
      stale(`outcomes."${o}"`, "the outcome");
    } else if (def.unresolved !== undefined) {
      findings.push({
        level: "warn",
        check: "steps-unresolved",
        message: `outcome "${o}" cannot be asserted yet: ${def.unresolved}`,
      });
    }
  }

  for (const [id, count] of u.rules) {
    const def = doc.rules?.[id];
    if (!def) missing(`rule ${id} has no step definition`);
    else if (def.cases.length !== count) missing(`rules.${id}: the IR has ${count} cases, the step definitions ${def.cases.length}`);
  }
  for (const id of Object.keys(doc.rules ?? {})) if (!u.rules.has(id)) stale(`rules.${id}`, "the rule");
}

export interface StepsCheckOptions {
  /** The IR model to cross-check against (when omitted, only the schema is checked) */
  model?: Model;
}

export function runStepsChecks(doc: StepsDoc, options: StepsCheckOptions = {}): Finding[] {
  const findings: Finding[] = [];
  if (!options.model) return findings;
  if (doc.steps !== options.model.ir.usecase) {
    findings.push({
      level: "error",
      check: "steps-usecase",
      message: `the step definitions target (${doc.steps}) does not match the IR usecase (${options.model.ir.usecase})`,
    });
    return findings;
  }
  checkCoverage(doc, options.model, findings);
  return findings;
}
