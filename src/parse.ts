// YAML loading, structural validation, and Model construction (the expanded cell table).
// Semantic checks live in checks.ts. This file only looks at the "shape".

import {
  type Document,
  Scalar,
  isMap,
  isScalar,
  isSeq,
  parse as parseYaml,
  parseDocument,
} from "yaml";
import {
  cellKey,
  type Cell,
  type EventDef,
  type Finding,
  type Model,
  type RaceDecl,
  type RaceDef,
  type UseCaseIR,
} from "./types.ts";
import { config } from "./config.ts";
import { RACE_WINNER_FIRST } from "./text.ts";

const STATE_ID = /^[A-Z][A-Z0-9_]*$/;
const EVENT_ID = /^[a-z][a-z0-9_]*$/;
const USECASE_ID = /^UC-[A-Z0-9-]+$/;
const SCENARIO_ID = /^SC-[A-Z0-9-]+$/;
const RULE_ID = /^RULE-[A-Z0-9-]+$/;
// actor is an open vocabulary (e.g. customer / staff / system) unless the project config closes it (config.actors).
// Consistency within a usecase is enforced by review

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
  for (const message of flowSplitFindings(parseDocument(source))) err(message);

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
    const actors = config().actors;
    if (typeof e.actor !== "string" || e.actor.trim() === "") {
      err(`event ${e.id}: actor is required (e.g. customer / staff / system)`);
    } else if (actors && !actors.includes(e.actor)) {
      err(`event ${e.id}: actor must be one of ${actors.join(" | ")}: ${e.actor}`);
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
    if (t.impossible && t.ignored) {
      err(`${at}: impossible and ignored cannot be combined`);
    } else if (t.impossible || t.ignored) {
      const kind = t.impossible ? "impossible" : "ignored";
      if (!t.reason) err(`${at}: ${kind} requires a reason`);
      if (t.to || t.outcome) err(`${at}: ${kind} cannot be combined with to/outcome`);
    } else {
      if (!t.to)
        err(
          `${at}: to (the target state) is required (declare impossible: true if the transition cannot happen, ` +
            `or ignored: true if the event arrives but changes nothing)`,
        );
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
          impossible: t.impossible === true || t.ignored === true,
          ignored: t.ignored === true,
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
      // each given / when / then item is a string of an observable fact (the { surface, ui } form is for
      // transition outcomes only). Checked in every scenario that writes them, with or without states
      for (const key of ["given", "when", "then"] as const) {
        const items: unknown = sc?.[key];
        if (items === undefined) continue;
        if (!Array.isArray(items)) {
          err(`${at} (${sc?.id}): ${key} must be a list of strings`);
          continue;
        }
        items.forEach((item, j) => {
          if (typeof item !== "string") {
            err(`${at} (${sc?.id}): ${key}[${j}] must be a string (the { surface, ui } form is for transition outcomes only)`);
          }
        });
      }
    });
  }

  // races (shape only; expanded into one race per state and pair once the cells are known)
  const raceDecls = (ir.races ?? []) as unknown as RaceDecl[];
  raceDecls.forEach((r, i) => {
    const at = `races[${i}]`;
    if (toArray(r?.state).length === 0) err(`${at}: state is required`);
    if (!Array.isArray(r?.between) || r.between.length < 1 || r.between.length > 2) {
      err(`${at}: between must name two events, or one event to race every event of another actor`);
    }
    if (r?.against !== undefined && r.between?.length !== 1) err(`${at}: against is only for a between that names one event`);
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
  ir.races = expandRaces(raceDecls, cells, events as Map<string, EventDef>, err);
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

// In a flow sequence [a, b] an ASCII comma separates items, so a comma inside the text splits it.
// e.g. then: [the total shows "$9,000"] becomes two items, `the total shows "$9` and `000"`,
// and a formatter rewrites it as [..., 000"...], which reads like "$9, 000" and slips past review.
// The parsed values cannot tell a split from two real items, so this looks at the YAML AST
// (whether a collection is flow, how each scalar is written).
const BRACKET_PAIRS: [string, string][] = [
  ["(", ")"],
  ["「", "」"],
  ["（", "）"],
];

function unbalancedBracket(text: string): string | undefined {
  for (const [open, close] of BRACKET_PAIRS) {
    if (text.split(open).length !== text.split(close).length) {
      return `${open}${close}`;
    }
  }
  return undefined;
}

function plainString(node: unknown): string | undefined {
  if (!isScalar(node) || node.type !== Scalar.PLAIN) return undefined;
  if (typeof node.value !== "string") return undefined;
  return node.source ?? node.value;
}

function plainSource(node: unknown): string | undefined {
  if (!isScalar(node) || node.type !== Scalar.PLAIN) return undefined;
  return node.source ?? String(node.value);
}

function checkFlowSeq(node: unknown, at: string, out: string[]): void {
  const fix =
    "use a block sequence (one `- item` per line) or wrap the item in double quotes";
  if (isMap(node)) {
    for (const pair of node.items) {
      const key = isScalar(pair.key) ? String(pair.key.value) : "?";
      // { ui: shows $9,000 } turns everything after the comma into a key with no value
      const keySource = plainSource(pair.key);
      if (node.flow && pair.value === null && keySource !== undefined) {
        out.push(
          `${at}: a comma split a value in the flow mapping {...} (key "${keySource}" has no value); ` +
            "use block style (one `key: value` per line) or wrap the value in double quotes",
        );
        continue;
      }
      checkFlowSeq(pair.value, `${at}.${key}`, out);
    }
    return;
  }
  if (!isSeq(node)) return;
  if (!node.flow) {
    node.items.forEach((item, j) => checkFlowSeq(item, `${at}[${j}]`, out));
    return;
  }
  // Check number splits first so the same items are not reported again as unbalanced brackets
  const reported = new Set<number>();
  node.items.forEach((item, j) => {
    const text = plainSource(item);
    const prev = j > 0 ? plainSource(node.items[j - 1]) : undefined;
    if (text === undefined || prev === undefined) return;
    // A list of numbers such as [1, 200] is intentional
    const bothNumbers = [item, node.items[j - 1]].every(
      (n) => isScalar(n) && typeof n.value === "number",
    );
    if (!bothNumbers && /\d$/.test(prev) && /^\d{3}(\D|$)/.test(text)) {
      reported.add(j - 1).add(j);
      out.push(
        `${at}[${j - 1}..${j}]: a comma in the flow sequence [...] split a number ` +
          `into "${prev}" and "${text}". If you meant "${prev},${text}", ${fix}`,
      );
    }
  });
  node.items.forEach((item, j) => {
    if (isMap(item) || isSeq(item)) {
      checkFlowSeq(item, `${at}[${j}]`, out);
      return;
    }
    const text = plainString(item);
    if (text === undefined || reported.has(j)) return;
    const bracket = unbalancedBracket(text);
    if (bracket !== undefined) {
      out.push(
        `${at}[${j}]: item "${text}" in the flow sequence [...] has an unclosed ${bracket} pair ` +
          `(a comma in the text may have split it); ${fix}`,
      );
    }
  });
}

function flowSplitFindings(doc: Document): string[] {
  const out: string[] = [];
  const seqItems = (key: string): unknown[] => {
    const node = doc.get(key, true);
    return isSeq(node) ? node.items : [];
  };
  const label = (item: unknown): string => {
    const id = isMap(item) ? item.get("id") : undefined;
    return typeof id === "string" ? ` (${id})` : "";
  };
  seqItems("scenarios").forEach((sc, i) => {
    if (!isMap(sc)) return;
    for (const key of ["given", "when", "then"]) {
      checkFlowSeq(
        sc.get(key, true),
        `scenarios[${i}]${label(sc)}.${key}`,
        out,
      );
    }
  });
  for (const section of ["transitions", "races"]) {
    seqItems(section).forEach((t, i) => {
      if (!isMap(t)) return;
      checkFlowSeq(t.get("outcome", true), `${section}[${i}].outcome`, out);
    });
  }
  seqItems("rules").forEach((r, i) => {
    if (!isMap(r)) return;
    const cases = r.get("cases", true);
    if (!isSeq(cases)) return;
    cases.items.forEach((c, j) => {
      if (!isMap(c)) return;
      checkFlowSeq(
        c.get("expected", true),
        `rules[${i}]${label(r)}.cases[${j}].expected`,
        out,
      );
    });
  });
  return out;
}

/**
 * A races declaration as written → one race per state and pair. A declaration with one event races it
 * against every event of another actor (of against, when given) that is possible in each state, so a
 * reader's single answer ("the operator's cancel wins over whatever the driver does") is one entry
 */
function expandRaces(decls: RaceDecl[], cells: Map<string, Cell[]>, events: Map<string, EventDef>, err: (m: string) => void): RaceDef[] {
  const possible = (state: string, event: string) => {
    const c = cells.get(cellKey(state, event))?.[0];
    return c !== undefined && !c.impossible;
  };
  return decls.flatMap((r, i) => {
    const at = `races[${i}]`;
    const base = { winner: r.winner, outcome: r.outcome, declaration: i };
    if (r.between.length === 2) {
      return toArray(r.state).map((state) => ({ ...base, state, between: [r.between[0], r.between[1]!] as [string, string] }));
    }
    const [a] = r.between;
    const actor = events.get(a)?.actor;
    if (r.winner !== a && r.winner !== RACE_WINNER_FIRST) err(`${at}: winner must be ${a} or ${RACE_WINNER_FIRST}`);
    if (r.against !== undefined && ![...events.values()].some((e) => e.actor === r.against)) {
      err(`${at}: against names an actor no event has: ${r.against}`);
    }
    const races = toArray(r.state).flatMap((state) =>
      [...events.values()]
        .filter((e) => e.id !== a && e.actor !== actor && (r.against === undefined || e.actor === r.against) && possible(state, e.id))
        .map((e) => ({ ...base, state, between: [a, e.id] as [string, string] })),
    );
    if (races.length === 0) err(`${at}: ${a} races no event of another actor in ${toArray(r.state).join(", ")}`);
    return races;
  });
}

