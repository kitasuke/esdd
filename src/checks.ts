// Semantic checks for the UseCase IR.
// All of them are simple graph traversals — no model checker involved.
// Check failures are worded so they read as questions back to the spec.

import {
  cellKey,
  type Cell,
  type Finding,
  type Model,
  type OutcomeItem,
} from "./types.ts";

function one(model: Model, from: string, on: string): Cell | undefined {
  return model.cells.get(cellKey(from, on))?.[0];
}

function nonTerminalStates(model: Model): string[] {
  return [...model.states.values()].filter((s) => !s.terminal).map((s) => s.id);
}

function transitionCells(model: Model): Cell[] {
  return [...model.cells.values()].flat().filter((c) => !c.impossible);
}

/** Exhaustiveness: is every non-terminal state × event declared as a transition or impossible? */
export function checkExhaustiveness(model: Model): Finding[] {
  const findings: Finding[] = [];
  for (const state of nonTerminalStates(model)) {
    for (const event of model.events.keys()) {
      if (!model.cells.has(cellKey(state, event))) {
        const label = model.events.get(event)?.label ?? event;
        findings.push({
          level: "error",
          check: "exhaustiveness",
          message:
            `${state} × ${event}: undeclared. Answer "what happens when ${label} occurs in ${state}?" ` +
            `(define a transition, or declare impossible: true with a reason)`,
        });
      }
    }
  }
  return findings;
}

/** Determinism: does any (from, on) pair have more than one declaration? */
export function checkDeterminism(model: Model): Finding[] {
  const findings: Finding[] = [];
  for (const [key, list] of model.cells) {
    if (list.length > 1) {
      findings.push({
        level: "error",
        check: "determinism",
        message: `${key.replace(" ", " × ")}: has ${list.length} declarations (transitions[${list
          .map((c) => c.entryIndex)
          .join("], transitions[")}]). Each cell must have exactly one declaration`,
      });
    }
  }
  return findings;
}

/** No transitions may leave a terminal state */
export function checkTerminals(model: Model): Finding[] {
  const findings: Finding[] = [];
  for (const c of transitionCells(model)) {
    if (model.states.get(c.from)?.terminal) {
      findings.push({
        level: "error",
        check: "terminals",
        message: `${c.from} is terminal but has an outgoing transition (on: ${c.on})`,
      });
    }
  }
  return findings;
}

/** Reachability: can every state be reached from initial? */
export function checkReachability(model: Model): Finding[] {
  const findings: Finding[] = [];
  if (!model.initial) return findings;
  const reachable = new Set<string>([model.initial]);
  const queue = [model.initial];
  while (queue.length > 0) {
    const s = queue.shift()!;
    for (const c of transitionCells(model)) {
      if (c.from === s && c.to && !reachable.has(c.to)) {
        reachable.add(c.to);
        queue.push(c.to);
      }
    }
  }
  for (const s of model.states.keys()) {
    if (!reachable.has(s)) {
      findings.push({
        level: "error",
        check: "reachability",
        message: `${s}: cannot be reached from initial (${model.initial}) by any event sequence`,
      });
    }
  }
  return findings;
}

/** Escapability: can every non-terminal state reach a terminal state? (no dead ends for the user) */
export function checkEscapability(model: Model): Finding[] {
  const findings: Finding[] = [];
  const terminals = [...model.states.values()].filter((s) => s.terminal).map((s) => s.id);
  if (terminals.length === 0) {
    findings.push({
      level: "error",
      check: "escapability",
      message: "there is no terminal state. At least one terminal state is required",
    });
    return findings;
  }
  const canEscape = new Set<string>(terminals);
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of transitionCells(model)) {
      if (c.to && canEscape.has(c.to) && !canEscape.has(c.from)) {
        canEscape.add(c.from);
        changed = true;
      }
    }
  }
  for (const s of nonTerminalStates(model)) {
    if (!canEscape.has(s)) {
      findings.push({
        level: "error",
        check: "escapability",
        message: `${s}: cannot reach any terminal state (a user who enters this state is stuck)`,
      });
    }
  }
  return findings;
}

/**
 * Race declaration obligation: when a state has transitions triggered by events of
 * different actors, the behavior of that racing pair must be declared under races.
 */
export function checkRaces(model: Model): Finding[] {
  const findings: Finding[] = [];
  const races = model.ir.races ?? [];

  // Validity of the declarations themselves
  races.forEach((r, i) => {
    const at = `races[${i}]`;
    if (!model.states.has(r.state)) {
      findings.push({ level: "error", check: "races", message: `${at}: undefined state: ${r.state}` });
      return;
    }
    for (const e of r.between) {
      if (!model.events.has(e)) {
        findings.push({ level: "error", check: "races", message: `${at}: undefined event: ${e}` });
      } else {
        const cell = one(model, r.state, e);
        if (!cell || cell.impossible) {
          findings.push({
            level: "warn",
            check: "races",
            message: `${at}: ${e} is not defined as a transition from ${r.state} (no race can occur)`,
          });
        }
      }
    }
    if (!r.between.includes(r.winner)) {
      findings.push({
        level: "error",
        check: "races",
        message: `${at}: winner (${r.winner}) must be one of the between events`,
      });
    }
  });

  // Obligation: detect pairs with different actors
  for (const state of nonTerminalStates(model)) {
    const active = [...model.events.values()].filter((e) => {
      const cell = one(model, state, e.id);
      return cell !== undefined && !cell.impossible;
    });
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i]!;
        const b = active[j]!;
        if (a.actor === b.actor) continue;
        const declared = races.some(
          (r) =>
            r.state === state &&
            r.between.includes(a.id) &&
            r.between.includes(b.id),
        );
        if (!declared) {
          findings.push({
            level: "error",
            check: "races",
            message:
              `${state}: ${a.actor}'s ${a.id} and ${b.actor}'s ${b.id} can race. ` +
              `Declare in races "if they happen almost simultaneously, which one wins, and what does the user see?"`,
          });
        }
      }
    }
  }
  return findings;
}

/** Path validity: can each scenario's event sequence be replayed from initial? */
export function checkPaths(model: Model): Finding[] {
  const findings: Finding[] = [];
  if (!model.initial) return findings;
  for (const sc of model.ir.scenarios) {
    if (!sc.path) continue;
    let current = model.initial;
    for (const [i, event] of sc.path.entries()) {
      if (!model.events.has(event)) {
        findings.push({
          level: "error",
          check: "paths",
          message: `${sc.id}: path[${i}] references an undefined event: ${event}`,
        });
        break;
      }
      const cell = one(model, current, event);
      if (!cell || cell.impossible) {
        findings.push({
          level: "error",
          check: "paths",
          message:
            `${sc.id}: path[${i}] ${event} cannot be executed from ${current} ` +
            (cell?.impossible ? `(impossible: ${cell.reason})` : "(no transition declared)"),
        });
        break;
      }
      current = cell.to!;
    }
  }
  return findings;
}

/** Transition coverage: is every transition exercised by at least one scenario? */
export function checkCoverage(model: Model): Finding[] {
  const findings: Finding[] = [];
  if (!model.initial) return findings;
  const covered = coveredCells(model);
  for (const c of transitionCells(model)) {
    if (!covered.has(cellKey(c.from, c.on))) {
      findings.push({
        level: "warn",
        check: "coverage",
        message:
          `${c.from} × ${c.on} → ${c.to}: not exercised by any scenario ` +
          `(--suggest-paths can propose candidate paths)`,
      });
    }
  }
  return findings;
}

/** The set of cells that the scenarios actually exercise (replay result) */
export function coveredCells(model: Model): Set<string> {
  const covered = new Set<string>();
  if (!model.initial) return covered;
  for (const sc of model.ir.scenarios) {
    if (!sc.path) continue;
    let current = model.initial;
    for (const event of sc.path) {
      const cell = one(model, current, event);
      if (!cell || cell.impossible) break;
      covered.add(cellKey(current, event));
      current = cell.to!;
    }
  }
  return covered;
}

/** Vocabulary: does every observation referenced by an outcome exist in the definitions registry? */
export function checkVocabulary(
  model: Model,
  observationNames: Set<string>,
): Finding[] {
  const findings: Finding[] = [];
  const visit = (items: OutcomeItem[] | undefined, at: string) => {
    for (const item of items ?? []) {
      if (typeof item === "object" && item.observation) {
        if (!observationNames.has(item.observation)) {
          findings.push({
            level: "error",
            check: "vocabulary",
            message: `${at}: observation "${item.observation}" does not exist in the observations registry (--definitions)`,
          });
        }
      }
    }
  };
  (model.ir.transitions ?? []).forEach((t, i) => visit(t.outcome, `transitions[${i}]`));
  (model.ir.races ?? []).forEach((r, i) => visit(r.outcome, `races[${i}]`));
  return findings;
}

export interface CheckOptions {
  observationNames?: Set<string>;
}

/** Run all checks */
// Markers for unanswered spec questions. The convention (usecase-ir.md) of leaving
// "TBD" etc. in outcome / reason / rules.expected when placing an ASSUMPTION makes
// them machine-visible. warn = a human must resolve them before approval.
const PENDING_MARKERS = ["TBD", "TODO", "FIXME", "UNRESOLVED"];

function findPendingMarker(text: string): string | undefined {
  return PENDING_MARKERS.find((m) => text.includes(m));
}

function pendingInOutcome(outcome: OutcomeItem[] | undefined): string | undefined {
  for (const item of outcome ?? []) {
    const texts = typeof item === "string" ? [item] : [item.ui ?? "", item.observation ?? ""];
    for (const t of texts) {
      const marker = findPendingMarker(t);
      if (marker) return marker;
    }
  }
  return undefined;
}

/** pending: are any unanswered spec-question markers (TBD/TODO/FIXME/UNRESOLVED) left? */
export function checkPending(model: Model): Finding[] {
  const findings: Finding[] = [];
  const push = (at: string, marker: string) => {
    findings.push({
      level: "warn",
      check: "pending",
      message: `${at}: an unanswered spec-question marker (${marker}) remains. Incorporate the spec owner's answer before approving`,
    });
  };
  (model.ir.transitions ?? []).forEach((t, i) => {
    const m = pendingInOutcome(t.outcome) ?? (t.reason ? findPendingMarker(t.reason) : undefined);
    if (m) push(`transitions[${i}]`, m);
  });
  (model.ir.races ?? []).forEach((r, i) => {
    const m = pendingInOutcome(r.outcome);
    if (m) push(`races[${i}]`, m);
  });
  (model.ir.rules ?? []).forEach((rule) => {
    rule.cases.forEach((c, i) => {
      const m = typeof c.expected === "string" ? findPendingMarker(c.expected) : undefined;
      if (m) push(`rules[${rule.id}].cases[${i}]`, m);
    });
  });
  (model.ir.scenarios ?? []).forEach((sc) => {
    for (const t of sc.then ?? []) {
      const m = findPendingMarker(t);
      if (m) {
        push(`scenarios[${sc.id}].then`, m);
        break;
      }
    }
  });
  return findings;
}

// Default condition sets per input kind. The happy path (valid value) is owned by
// the scenarios, so the axis asks only about edge conditions. Overridable via conditions.
export const INPUT_DEFAULT_CONDITIONS: Record<string, string[]> = {
  field: ["empty", "boundary"],
  option: ["default", "set"],
};

/** Effective condition set per input (conditions ?? kind-specific defaults) */
export function inputConditions(model: Model): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const inp of model.ir.inputs ?? []) {
    map.set(inp.id, inp.conditions?.length ? inp.conditions : (INPUT_DEFAULT_CONDITIONS[inp.kind] ?? []));
  }
  return map;
}

function toCoversArray(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

/**
 * inputs: has every declared input × condition cell taken an explicit stance via covers or na?
 * The stateless-mode counterpart of exhaustiveness — uncovered cells are reported
 * as questions back to the spec.
 */
export function checkInputs(model: Model): Finding[] {
  const inputs = model.ir.inputs ?? [];
  if (inputs.length === 0) return [];
  const findings: Finding[] = [];
  const conds = inputConditions(model);

  // Are the na conditions declared?
  for (const inp of inputs) {
    for (const cond of Object.keys(inp.na ?? {})) {
      if (!(conds.get(inp.id) ?? []).includes(cond)) {
        findings.push({
          level: "error",
          check: "inputs",
          message: `inputs (${inp.id}): na condition "${cond}" does not exist in this input's condition set (conditions: ${(conds.get(inp.id) ?? []).join(", ")})`,
        });
      }
    }
  }

  // Collect and verify covers (a typo shows up as a mismatch against the declarations)
  const covered = new Set<string>();
  const claim = (ref: string, at: string) => {
    const parts = ref.split("×").map((s) => s.trim());
    if (parts.length !== 2 || parts.some((p) => p === "")) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers must use the "<inputId>×<condition>" cell syntax: ${JSON.stringify(ref)}`,
      });
      return;
    }
    const [id, cond] = parts as [string, string];
    if (!conds.has(id)) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers references an input id that is not declared in inputs: ${id}`,
      });
      return;
    }
    if (!conds.get(id)!.includes(cond)) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers condition "${cond}" does not exist in the condition set of input "${id}" (conditions: ${conds.get(id)!.join(", ")})`,
      });
      return;
    }
    covered.add(`${id}×${cond}`);
  };
  for (const sc of model.ir.scenarios ?? []) {
    for (const ref of toCoversArray(sc.covers)) claim(ref, `scenarios[${sc.id}]`);
  }
  for (const rule of model.ir.rules ?? []) {
    rule.cases.forEach((c, i) => {
      for (const ref of toCoversArray(c.covers)) claim(ref, `rules[${rule.id}].cases[${i}]`);
    });
  }

  // Obligation: every cell must take a stance — either covers or na
  for (const inp of inputs) {
    for (const cond of conds.get(inp.id) ?? []) {
      const key = `${inp.id}×${cond}`;
      const isNa = inp.na !== undefined && cond in inp.na;
      const isCovered = covered.has(key);
      if (isNa && isCovered) {
        findings.push({
          level: "warn",
          check: "inputs",
          message: `${key}: has both an na declaration and covers (the na reason may be stale — keep exactly one)`,
        });
      }
      if (!isNa && !isCovered) {
        findings.push({
          level: "error",
          check: "inputs",
          message: `${inp.id} × ${cond}: uncovered. Answer "what happens when ${inp.id} is ${cond}?" (link it via covers from a rule case / scenario, or declare a reason under the input's na)`,
        });
      }
    }
  }
  return findings;
}

export function runChecks(model: Model, options: CheckOptions = {}): Finding[] {
  const findings: Finding[] = [];
  findings.push(...checkPending(model));
  findings.push(...checkInputs(model));
  if (model.hasStateMachine) {
    findings.push(...checkDeterminism(model));
    findings.push(...checkExhaustiveness(model));
    findings.push(...checkTerminals(model));
    findings.push(...checkReachability(model));
    findings.push(...checkEscapability(model));
    findings.push(...checkRaces(model));
    findings.push(...checkPaths(model));
    findings.push(...checkCoverage(model));
  }
  if (options.observationNames) {
    findings.push(...checkVocabulary(model, options.observationNames));
  }
  return findings;
}
