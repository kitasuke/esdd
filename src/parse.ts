// YAML loading, structural validation, and Model construction (the expanded cell table).
// Semantic checks live in checks.ts. This file only looks at the "shape".

import { parse as parseYaml } from "yaml";
import {
  cellKey,
  type Cell,
  type Finding,
  type Model,
  type UseCaseIR,
} from "./types.ts";

const STATE_ID = /^[A-Z][A-Z0-9_]*$/;
const EVENT_ID = /^[a-z][a-z0-9_]*$/;
const USECASE_ID = /^UC-[A-Z0-9-]+$/;
const SCENARIO_ID = /^SC-[A-Z0-9-]+$/;
const RULE_ID = /^RULE-[A-Z0-9-]+$/;
// actor is an open vocabulary (e.g. customer / staff / system). Consistency within a usecase is enforced by review

function toArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export interface ParseResult {
  model?: Model;
  findings: Finding[];
}

export function parseIR(source: string): ParseResult {
  const findings: Finding[] = [];
  const err = (message: string) =>
    findings.push({ level: "error", check: "structure", message });

  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (e) {
    err(`cannot parse as YAML: ${(e as Error).message}`);
    return { findings };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    err("the top level must be an object");
    return { findings };
  }
  const ir = raw as UseCaseIR;

  if (!ir.usecase || !USECASE_ID.test(ir.usecase)) {
    err(`usecase must be an ID starting with UC- (e.g. UC-ORDER-CANCEL-001)`);
  }
  if (!ir.name) err("name is required");
  if (!ir.source?.spec) err("source.spec (link to the spec) is required");

  const hasStates = Array.isArray(ir.states) && ir.states.length > 0;
  const hasEvents = Array.isArray(ir.events) && ir.events.length > 0;
  const hasTransitions = Array.isArray(ir.transitions) && ir.transitions.length > 0;
  const hasStateMachine = hasStates || hasEvents || hasTransitions;

  if (hasStateMachine && !(hasStates && hasEvents && hasTransitions)) {
    err("states / events / transitions must be defined together as a set of three");
  }
  if (hasStates && !ir.initial) {
    err("initial (the initial state) is required when states are defined");
  }

  const states = new Map<string, (typeof ir.states extends (infer T)[] | undefined ? T : never)>();
  for (const s of ir.states ?? []) {
    if (!s?.id || !STATE_ID.test(s.id)) {
      err(`invalid state id: ${JSON.stringify(s?.id)} (UPPER_SNAKE_CASE)`);
      continue;
    }
    if (states.has(s.id)) err(`duplicate state id: ${s.id}`);
    states.set(s.id, s);
  }
  const events = new Map<string, NonNullable<typeof ir.events>[number]>();
  for (const e of ir.events ?? []) {
    if (!e?.id || !EVENT_ID.test(e.id)) {
      err(`invalid event id: ${JSON.stringify(e?.id)} (lower_snake_case)`);
      continue;
    }
    if (events.has(e.id)) err(`duplicate event id: ${e.id}`);
    if (typeof e.actor !== "string" || e.actor.trim() === "") {
      err(`event ${e.id}: actor is required (e.g. customer / staff / system)`);
    }
    events.set(e.id, e);
  }
  if (ir.initial && hasStates && !states.has(ir.initial)) {
    err(`initial does not exist in states: ${ir.initial}`);
  }

  // transitions → cell expansion
  const cells = new Map<string, Cell[]>();
  (ir.transitions ?? []).forEach((t, i) => {
    const at = `transitions[${i}]`;
    const froms = toArray(t.from);
    const ons = toArray(t.on);
    if (froms.length === 0) err(`${at}: from is required`);
    if (ons.length === 0) err(`${at}: on is required`);
    if (t.impossible) {
      if (!t.reason) err(`${at}: impossible requires a reason`);
      if (t.to || t.outcome) err(`${at}: impossible cannot be combined with to/outcome`);
    } else {
      if (!t.to) err(`${at}: to (the target state) is required (declare impossible: true if the transition cannot happen)`);
      if (!t.outcome || t.outcome.length === 0) {
        err(`${at}: outcome (the observable expected result) is required`);
      }
    }
    for (const f of froms) {
      if (hasStates && !states.has(f)) err(`${at}: from references an undefined state: ${f}`);
      for (const o of ons) {
        if (hasEvents && !events.has(o)) err(`${at}: on references an undefined event: ${o}`);
        const key = cellKey(f, o);
        const list = cells.get(key) ?? [];
        list.push({
          from: f,
          on: o,
          to: t.to,
          outcome: t.outcome,
          impossible: t.impossible === true,
          reason: t.reason,
          entryIndex: i,
        });
        cells.set(key, list);
      }
    }
    if (t.to && hasStates && !states.has(t.to)) {
      err(`${at}: to references an undefined state: ${t.to}`);
    }
  });

  // scenarios
  if (!Array.isArray(ir.scenarios) || ir.scenarios.length === 0) {
    err("at least one scenario is required");
  } else {
    const seen = new Set<string>();
    ir.scenarios.forEach((sc, i) => {
      const at = `scenarios[${i}]`;
      if (!sc?.id || !SCENARIO_ID.test(sc.id)) {
        err(`${at}: id must be an ID starting with SC-`);
      } else if (seen.has(sc.id)) {
        err(`${at}: duplicate scenario id: ${sc.id}`);
      } else {
        seen.add(sc.id);
      }
      if (!sc?.name) err(`${at}: name is required`);
      if (hasStateMachine) {
        if (!sc?.path || sc.path.length === 0) {
          err(`${at} (${sc?.id}): scenarios of a use case with a state machine require a path`);
        }
      } else {
        if (!sc?.given?.length || !sc?.when?.length || !sc?.then?.length) {
          err(`${at} (${sc?.id}): given / when / then are all required`);
        }
      }
    });
  }

  // races (shape only)
  (ir.races ?? []).forEach((r, i) => {
    const at = `races[${i}]`;
    if (!r?.state) err(`${at}: state is required`);
    if (!Array.isArray(r?.between) || r.between.length !== 2) {
      err(`${at}: between must be an array of exactly two events`);
    }
    if (!r?.winner) err(`${at}: winner is required`);
    if (!r?.outcome?.length) err(`${at}: outcome is required`);
  });

  // rules (shape only)
  (ir.rules ?? []).forEach((r, i) => {
    const at = `rules[${i}]`;
    if (!r?.id || !RULE_ID.test(r.id)) err(`${at}: id must be an ID starting with RULE-`);
    if (!r?.cases?.length) err(`${at}: at least one case is required`);
  });

  // inputs (input-axis declarations; the semantic cell-coverage check is checks.ts checkInputs)
  const INPUT_KINDS = new Set(["field", "option"]);
  const inputIds = new Set<string>();
  (ir.inputs ?? []).forEach((inp, i) => {
    const at = `inputs[${i}]`;
    if (!inp?.id || typeof inp.id !== "string" || inp.id.trim() === "") {
      err(`${at}: id is required`);
      return;
    }
    if (inp.id.includes("×")) {
      err(`${at}: id must not contain "×" (it is the separator of the covers cell syntax "<inputId>×<condition>")`);
    }
    if (inputIds.has(inp.id)) err(`${at}: duplicate input id: ${inp.id}`);
    inputIds.add(inp.id);
    if (!inp.kind || !INPUT_KINDS.has(inp.kind)) {
      err(`${at} (${inp.id}): kind must be one of field | option`);
    }
    if (inp.conditions !== undefined) {
      if (!Array.isArray(inp.conditions) || inp.conditions.length === 0) {
        err(`${at} (${inp.id}): conditions must be an array with at least one entry (omit it to use the kind-specific defaults)`);
      } else if (inp.conditions.some((c) => typeof c !== "string" || c.trim() === "")) {
        err(`${at} (${inp.id}): conditions must be an array of non-empty strings`);
      }
    }
    for (const [cond, reason] of Object.entries(inp.na ?? {})) {
      if (typeof reason !== "string" || reason.trim() === "") {
        err(`${at} (${inp.id}): na "${cond}" requires a reason (the same obligation as impossible's reason)`);
      }
    }
  });

  if (findings.some((f) => f.level === "error")) {
    return { findings };
  }
  return {
    findings,
    model: {
      ir,
      hasStateMachine,
      states: states as Model["states"],
      events: events as Model["events"],
      initial: ir.initial,
      cells,
    },
  };
}
