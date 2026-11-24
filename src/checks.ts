// Semantic checks for the UseCase IR.
// All of them are simple graph traversals — no model checker involved.
// Check failures are worded so they read as questions back to the spec.

import { checkAssumptions } from "./assumptions.ts";
import { config } from "./config.ts";
import { findPendingMarker, outcomeTexts, pendingMarkerParts, RACE_WINNER_FIRST } from "./text.ts";

export { findPendingMarker };
import {
  cellKey,
  type Cell,
  type EventDef,
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
/** The non-terminal state × event cells with no declaration (shared by the check and the PRD renderer) */
export function undeclaredCells(model: Model): { state: string; event: string }[] {
  return nonTerminalStates(model).flatMap((state) =>
    [...model.events.keys()].filter((event) => !model.cells.has(cellKey(state, event))).map((event) => ({ state, event })),
  );
}

export function checkExhaustiveness(model: Model): Finding[] {
  return undeclaredCells(model).map(({ state, event }) => {
    const label = model.events.get(event)?.label ?? event;
    return {
      level: "error",
      check: "exhaustiveness",
      message:
        `${state} × ${event}: undeclared. Answer "what happens when ${label} occurs in ${state}?" ` +
        `(define a transition, or declare impossible: true with a reason)`,
    };
  });
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
/** States no event sequence from initial leads to (shared by the check and the PRD renderer) */
export function unreachableStates(model: Model): string[] {
  if (!model.initial) return [];
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
  return [...model.states.keys()].filter((s) => !reachable.has(s));
}

export function checkReachability(model: Model): Finding[] {
  return unreachableStates(model).map((s) => ({
    level: "error",
    check: "reachability",
    message: `${s}: cannot be reached from initial (${model.initial}) by any event sequence`,
  }));
}

/** Non-terminal states from which no terminal state can be reached (shared by the check and the PRD renderer) */
export function trappedStates(model: Model): string[] {
  const terminals = [...model.states.values()].filter((s) => s.terminal).map((s) => s.id);
  if (terminals.length === 0) return [];
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
  return nonTerminalStates(model).filter((s) => !canEscape.has(s));
}

/** Escapability: can every non-terminal state reach a terminal state? (no dead ends for the user) */
export function checkEscapability(model: Model): Finding[] {
  if (![...model.states.values()].some((s) => s.terminal)) {
    return [{ level: "error", check: "escapability", message: "there is no terminal state. At least one terminal state is required" }];
  }
  return trappedStates(model).map((s) => ({
    level: "error",
    check: "escapability",
    message: `${s}: cannot reach any terminal state (a user who enters this state is stuck)`,
  }));
}

/**
 * Race declaration obligation: when a state has transitions triggered by events of
 * different actors, the behavior of that racing pair must be declared under races.
 */
/** Pairs of events of different actors, both possible in a state, with no races declaration (shared by the check and the PRD renderer) */
export function undeclaredRaces(model: Model): { state: string; a: EventDef; b: EventDef }[] {
  const races = model.ir.races ?? [];
  const out: { state: string; a: EventDef; b: EventDef }[] = [];
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
        const declared = races.some((r) => r.state === state && r.between.includes(a.id) && r.between.includes(b.id));
        if (!declared) out.push({ state, a, b });
      }
    }
  }
  return out;
}

export function checkRaces(model: Model): Finding[] {
  return [
    ...checkRaceDeclarations(model),
    ...undeclaredRaces(model).map(({ state, a, b }): Finding => ({
      level: "error",
      check: "races",
      message:
        `${state}: ${a.actor}'s ${a.id} and ${b.actor}'s ${b.id} can race. ` +
        `Declare in races "if they happen almost simultaneously, which one wins, and what does the user see?"`,
    })),
  ];
}

/** Validity of the races declarations themselves */
export function checkRaceDeclarations(model: Model): Finding[] {
  const findings: Finding[] = [];
  const races = model.ir.races ?? [];

  // Validity of the declarations themselves
  races.forEach((r, i) => {
    // a declaration expanded into several races names the state and pair it is about
    const expanded = r.declaration !== undefined && races.filter((x) => x.declaration === r.declaration).length > 1;
    const at = `races[${r.declaration ?? i}]${expanded ? ` (${r.state}: ${r.between.join(" vs ")})` : ""}`;
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
    if (r.winner !== RACE_WINNER_FIRST && !r.between.includes(r.winner)) {
      findings.push({
        level: "error",
        check: "races",
        message: `${at}: winner (${r.winner}) must be one of the between events, or first when arrival order decides it`,
      });
    }
    // two declarations (or one that names several states or events) can cover the same race
    const earlier = races.findIndex((x, j) => j < i && x.state === r.state && x.between.every((e) => r.between.includes(e)));
    if (earlier >= 0) {
      findings.push({
        level: "error",
        check: "races",
        message: `${at}: ${r.between.join(" vs ")} in ${r.state} is already declared in races[${races[earlier]!.declaration ?? earlier}]`,
      });
    }
  });

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
            (cell?.impossible ? `(${cell.ignored ? "ignored" : "impossible"}: ${cell.reason})` : "(no transition declared)"),
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
  observationNames?: Set<string> | undefined;
}

/** Run all checks */
// Markers for unanswered spec questions. The convention (usecase-ir.md) of leaving
// "TBD" etc. in outcome / reason / rules.expected when placing an ASSUMPTION makes
// them machine-visible. warn = a human must resolve them before approval.

/**
 * pending: are any unanswered spec-question markers (TBD/TODO/FIXME/UNRESOLVED) left?
 * One warning per question: two markers with different ids in one place are two questions, so a
 * question added where another is already open still raises the count.
 */
export function checkPending(model: Model): Finding[] {
  const findings: Finding[] = [];
  const pushAll = (at: string, texts: string[]) => {
    const parts = texts.flatMap(pendingMarkerParts);
    const ids = [...new Set(parts.map((p) => p.id))];
    if (ids.length >= 2) {
      for (const id of ids) {
        const marker = `${parts.find((p) => p.id === id)!.marker}(${id})`;
        findings.push({
          level: "warn",
          check: "pending",
          message: `${at}: an unanswered spec-question marker (${marker}) remains. Incorporate the spec owner's answer before approving`,
        });
      }
      return;
    }
    const marker = texts.map((t) => findPendingMarker(t)).find((m) => m !== undefined);
    if (marker) {
      findings.push({
        level: "warn",
        check: "pending",
        message: `${at}: an unanswered spec-question marker (${marker}) remains. Incorporate the spec owner's answer before approving`,
      });
    }
  };
  (model.ir.transitions ?? []).forEach((t, i) => pushAll(`transitions[${i}]`, [...outcomeTexts(t.outcome), t.reason ?? ""]));
  (model.ir.races ?? []).forEach((r, i) => pushAll(`races[${i}]`, outcomeTexts(r.outcome)));
  (model.ir.rules ?? []).forEach((rule) => {
    rule.cases.forEach((c, i) => pushAll(`rules[${rule.id}].cases[${i}]`, typeof c.expected === "string" ? [c.expected] : []));
  });
  (model.ir.scenarios ?? []).forEach((sc) => {
    for (const key of ["given", "when", "then"] as const) {
      // a non-string is a structure error reported elsewhere; skip it here instead of throwing
      pushAll(`scenarios[${sc.id}].${key}`, (sc[key] ?? []).filter((t): t is string => typeof t === "string"));
    }
  });
  // an na reason can carry an open question too ("never occurs TBD(Q3: confirm with the API team)")
  (model.ir.inputs ?? []).forEach((inp) => {
    for (const [cond, reason] of Object.entries(inp.na ?? {})) {
      if (typeof reason === "string") pushAll(`inputs[${inp.id}].na.${cond}`, [reason]);
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
    const defaults = { ...INPUT_DEFAULT_CONDITIONS, ...config().inputConditions };
    map.set(inp.id, inp.conditions?.length ? inp.conditions : (defaults[inp.kind] ?? []));
  }
  return map;
}

/** What a reader calls an input: its label, or its id when it has none */
export function inputLabel(model: Model, id: string): string {
  return model.ir.inputs?.find((inp) => inp.id === id)?.label ?? id;
}

/** What a reader calls an input's condition: its label from condition_labels, or the condition itself */
export function conditionLabel(model: Model, id: string, condition: string): string {
  return model.ir.inputs?.find((inp) => inp.id === id)?.condition_labels?.[condition] ?? condition;
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
/** Input × condition cells that neither covers nor na takes a stance on (shared by the check and the PRD renderer) */
export function uncoveredInputCells(model: Model): { input: string; condition: string }[] {
  const conds = inputConditions(model);
  const covered = new Set(
    [...(model.ir.scenarios ?? []).map((sc) => sc.covers), ...(model.ir.rules ?? []).flatMap((r) => r.cases.map((c) => c.covers))]
      .flatMap(toCoversArray)
      .map((ref) => ref.split("×").map((x) => x.trim()).join("×")),
  );
  return (model.ir.inputs ?? []).flatMap((inp) =>
    (conds.get(inp.id) ?? [])
      .filter((cond) => !(inp.na !== undefined && cond in inp.na) && !covered.has(`${inp.id}×${cond}`))
      .map((condition) => ({ input: inp.id, condition })),
  );
}

export function checkInputs(model: Model): Finding[] {
  const inputs = model.ir.inputs ?? [];
  if (inputs.length === 0) return [];
  const findings: Finding[] = [];
  const conds = inputConditions(model);

  // Are the na conditions and the labeled conditions declared?
  for (const inp of inputs) {
    for (const [field, keys] of [["na", Object.keys(inp.na ?? {})], ["condition_labels", Object.keys(inp.condition_labels ?? {})]] as const) {
      for (const cond of keys) {
        if (!(conds.get(inp.id) ?? []).includes(cond)) {
          findings.push({
            level: "error",
            check: "inputs",
            message: `inputs (${inp.id}): ${field === "na" ? "na" : "condition_labels"} condition "${cond}" does not exist in this input's condition set (conditions: ${(conds.get(inp.id) ?? []).join(", ")})`,
          });
        }
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
    }
  }
  for (const { input, condition } of uncoveredInputCells(model)) {
    findings.push({
      level: "error",
      check: "inputs",
      message: `${input} × ${condition}: uncovered. Answer "what happens when ${input} is ${condition}?" (link it via covers from a rule case / scenario, or declare a reason under the input's na)`,
    });
  }
  return findings;
}

const DIRECTION_WORDS = {
  ordering: ["sort", "ordering", "order by", "paging", "pagination", "page"],
  ascending: ["ascending", "asc", "oldest first", "smallest first"],
  descending: ["descending", "desc", "newest first", "largest first"],
  next: ["next page", "next"],
  previous: ["previous page", "previous", "prev"],
};

function directionWords(kind: keyof typeof DIRECTION_WORDS): string[] {
  return [...DIRECTION_WORDS[kind], ...(config().ruleDirections?.[kind] ?? [])].map((w) => w.toLowerCase());
}

function mentions(text: string, kind: keyof typeof DIRECTION_WORDS): boolean {
  const t = text.toLowerCase();
  return directionWords(kind).some((w) => t.includes(w));
}

/**
 * Distinguishing cases: every rule has two cases whose expected differ (a table with one answer cannot tell
 * its branches apart), and an ordering or paging rule has cases for both directions
 */
export function checkRuleCases(model: Model): Finding[] {
  const findings: Finding[] = [];
  for (const rule of model.ir.rules ?? []) {
    const cases = rule.cases ?? [];
    // A case still waiting for the owner's answer is already on the question list
    if (cases.some((c) => findPendingMarker(JSON.stringify(c.expected ?? "")) !== undefined)) continue;
    if (new Set(cases.map((c) => JSON.stringify(c.expected))).size < 2) {
      findings.push({
        level: "error",
        check: "rules",
        message: `rules[${rule.id}]: needs at least two cases whose expected differ — which input gives the other answer? (with one answer, a test cannot tell the rule's branches apart)`,
      });
    }
    const inputs = cases.map((c) => (typeof c.input === "string" ? c.input : JSON.stringify(c.input ?? "")));
    if (rule.kind !== "order" && !mentions(`${rule.name ?? ""} ${inputs.join(" ")}`, "ordering")) continue;
    const both = (a: keyof typeof DIRECTION_WORDS, b: keyof typeof DIRECTION_WORDS) =>
      inputs.some((t) => mentions(t, a)) && inputs.some((t) => mentions(t, b));
    if (!both("ascending", "descending") && !both("next", "previous")) {
      findings.push({
        level: "error",
        check: "rules",
        message: `rules[${rule.id}]: an ordering or paging rule needs cases for both directions (ascending and descending, or the next and the previous page) — what does the other direction show?`,
      });
    }
  }
  return findings;
}

/**
 * Rule kinds: where the IR shows that a kind of promise is at stake, a rule of that kind exists or
 * rule_kinds_na says why none is needed. Declared races mean two actors can act on the same thing at
 * once, so the spec owes a sentence on what must never come out of it
 */
export function checkRuleKinds(model: Model): Finding[] {
  const findings: Finding[] = [];
  const declared = new Set((model.ir.rules ?? []).map((r) => r.kind).filter((k) => k !== undefined));
  const na = model.ir.rule_kinds_na ?? {};
  const races = model.ir.races ?? [];
  if (races.length > 0 && !declared.has("never") && na.never === undefined) {
    findings.push({
      level: "warn",
      check: "rule-kinds",
      message:
        `${races.length} race(s) are declared, but no rule of kind never says what must not come out of them — ` +
        "what must never happen when these events collide? (or declare rule_kinds_na.never with the reason none is needed)",
    });
  }
  return findings;
}

/** What one run of the checks looked at, and what it cannot see, so a clean result is not read as more than it is */
export function checkScope(model: Model): { checked: string[]; not_checked: string[] } {
  const checked: string[] = [];
  if (model.hasStateMachine) {
    checked.push(
      `state machine: ${model.states.size} states × ${model.events.size} events, ${(model.ir.races ?? []).length} race(s) between two events`,
    );
  }
  const inputs = model.ir.inputs ?? [];
  if (inputs.length > 0) checked.push(`inputs: ${inputs.length}`);
  const rules = model.ir.rules ?? [];
  if (rules.length > 0) {
    const cases = rules.reduce((n, r) => n + (r.cases?.length ?? 0), 0);
    const kinds = [...new Set(rules.map((r) => r.kind).filter((k) => k !== undefined))];
    checked.push(`rules: ${rules.length} with ${cases} case(s)${kinds.length > 0 ? `, kinds ${kinds.join(" / ")}` : ""}`);
  }
  const server = model.ir.server ?? [];
  if (server.length > 0) checked.push(`server: ${server.length} sent value(s)`);
  checked.push(`scenarios: ${(model.ir.scenarios ?? []).length}`);
  const not_checked = ["the implementation (pass --results to trace tests that ran)", "events of other usecases that share data with this one"];
  if (model.hasStateMachine) not_checked.push("orders of more than two events");
  not_checked.push("rule kinds the checker has no signal for (only never, when races are declared)");
  if (server.length > 0) not_checked.push("whether every value the change sends has a server entry, and the server lines at the base (need the repository)");
  return { checked, not_checked };
}

/** Region: a change to an existing region lists the region's existing states as an axis, read from the implementation */
export function checkRegion(model: Model): Finding[] {
  const region = model.ir.region;
  if (!region) return [];
  const findings: Finding[] = [];
  const axis = (model.ir.inputs ?? []).find((i) => i.id === region.axis);
  if (!axis) {
    findings.push({
      level: "error",
      check: "region",
      message: `region (${region.name}): inputs has no axis "${region.axis}" — which states does the region show today?`,
    });
  } else if ((inputConditions(model).get(axis.id) ?? []).length < 2) {
    findings.push({
      level: "error",
      check: "region",
      message: `region (${region.name}): axis "${region.axis}" needs the region's existing states as its conditions (at least two)`,
    });
  }
  if (!(model.ir.existing ?? []).some((e) => (e.refs ?? []).some((r) => r.kind === "state"))) {
    findings.push({
      level: "error",
      check: "region",
      message: `region (${region.name}): existing needs at least one ref of kind state — the line of the implementation that shows each existing state`,
    });
  }
  return findings;
}

/** Server: each server-side check names an inputs cell, so checkInputs asks for its covers or na */
export function checkServer(model: Model): Finding[] {
  const conds = inputConditions(model);
  return (model.ir.server ?? []).flatMap((e) =>
    (e.checks ?? []).flatMap((c) => {
      const [id, cond] = (c.cell ?? "").split("×").map((x) => x.trim());
      if (id !== undefined && cond !== undefined && (conds.get(id) ?? []).includes(cond)) return [];
      return [
        {
          level: "error" as const,
          check: "server",
          message: `server (${e.id}): cell ${c.cell} is not an inputs cell — declare input "${id}" with condition "${cond}", so the client's handling of what the server rejects is asked`,
        },
      ];
    }),
  );
}

export function runChecks(model: Model, options: CheckOptions = {}): Finding[] {
  const findings: Finding[] = [];
  findings.push(...checkPending(model));
  findings.push(...checkAssumptions(model));
  findings.push(...checkInputs(model));
  findings.push(...checkRuleCases(model));
  findings.push(...checkRuleKinds(model));
  findings.push(...checkRegion(model));
  findings.push(...checkServer(model));
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
