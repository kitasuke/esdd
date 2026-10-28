// Product-code side of the example generator: select → decision record → render.
// select() matches the IR's shapes against the pattern registry and fills each pattern's slots
// from the IR, the bindings and the step definitions; everything no input prescribes lands in
// the record's `unprescribed`. render() writes code from the record alone, deciding nothing.
// The rulings it follows are in examples/pattern-registry.yaml.

import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { outcomeText } from "../../src/steps.ts";
import type { Inputs } from "./generate.ts";

type Addressing = { role?: string; name?: string; label?: string; testid?: string; text?: string };

interface Registry {
  registry: string;
  api: Record<string, { endpoint: string; read: string; conflict_code: string }>;
  patterns: Record<string, { selects_on: string; status_outcome?: string; rulings: string[] }>;
}

export interface ProductBindings {
  graph: string;
  events?: Record<string, { operation: string }>;
  elements: Record<string, Addressing>;
  literals?: Record<string, string>;
  literal_coverage?: Record<string, { literal?: string }>;
}

export function loadRegistry(path: string): { path: string; registry: Registry } {
  return { path, registry: parse(readFileSync(path, "utf8")) as Registry };
}

// ---- decision record ------------------------------------------------------------------------

interface RuleSelection {
  target: string;
  pattern: "pure_rule_function";
  output: string;
  slots: { function: string; states: string[]; cases: { state: string; returns: unknown }[] };
}

interface ScreenSelection {
  target: string;
  pattern: "entity_status_with_actions";
  output: string;
  slots: {
    entity: string;
    api: { endpoint: string; read: string; conflict_code: string };
    states: string[];
    status: { element: string; by_state: Record<string, string> };
    actions: { event: string; actor: string; element: string; operation: string; in: string[] }[];
    rule_calls: { rule: string; on: string; function: string; from: string; notice_elements: string[] }[];
    conflict_notices: { race: string; loser: string; element: string }[];
  };
}

export interface DecisionRecord {
  record: string;
  source: { usecase: string; version: string; bindings: string; steps: string; registry: string };
  selections: (RuleSelection | ScreenSelection)[];
  file_plan: { new: string[]; modified: string[] };
  unprescribed: { decision: string; disposition: "question-list" | "registry-addition" }[];
  literal_sweep: { unmatched_rules: string[] };
}

const fileOf = (from: string) => from.replace(/^\.\//, "");
const noPattern = (shape: string) =>
  new Error(`no pattern in the registry selects on ${shape} — extend the registry first`);

/** Matches the IR against the registry and fills the slots. Throws when a shape has no pattern */
export function select(inputs: Inputs, bindings: ProductBindings, reg: { path: string; registry: Registry }): DecisionRecord {
  const { model, steps } = inputs;
  const ir = model.ir;
  const { registry } = reg;
  const unprescribed: DecisionRecord["unprescribed"] = [];
  const selections: DecisionRecord["selections"] = [];
  const stateOrder = [...model.states.keys()];

  // pure_rule_function: a case table over one argument, a state
  const ruleSelections = new Map<string, RuleSelection>();
  for (const rule of ir.rules ?? []) {
    const def = steps.rules?.[rule.id];
    const states = def?.cases.map((c) => c.args[0]);
    if (!def || !states?.every((s, i) => def.cases[i]!.args.length === 1 && typeof s === "string" && model.states.has(s))) {
      throw noPattern(`${rule.id} (its cases do not each take one state)`);
    }
    const sel: RuleSelection = {
      target: rule.id,
      pattern: "pure_rule_function",
      output: fileOf(def.function.from),
      slots: {
        function: def.function.name,
        states: states as string[],
        cases: def.cases.map((c) => ({ state: c.args[0] as string, returns: c.returns })),
      },
    };
    ruleSelections.set(rule.id, sel);
    selections.push(sel);
  }

  // entity_status_with_actions: status outcomes + UI-actor events
  const pattern = registry.patterns["entity_status_with_actions"];
  // 'the {entity} status shows "{literal}"' → a regex capturing the entity and the literal text
  const statusRe = new RegExp(
    `^${(pattern?.status_outcome ?? "")
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace("\\{entity\\}", "(\\w+)")
      .replace("\\{literal\\}", "(.+)")}$`,
  );
  const cells = [...model.cells.values()].flat().filter((c) => !c.impossible && c.to);
  const literals = bindings.literals ?? {};
  const statusKey = (value: string) => Object.keys(literals).find((k) => k.startsWith("status_") && literals[k] === value);
  let entity: string | undefined;
  const byState: Record<string, string> = {};
  for (const c of cells) {
    for (const o of (c.outcome ?? []).map(outcomeText)) {
      const m = statusRe.exec(o);
      if (!m) continue;
      entity ??= m[1];
      const key = statusKey(m[2]!);
      if (!key) throw new Error(`outcome '${o}': no status_* literal in the bindings has the text "${m[2]}"`);
      byState[c.to!] = key;
    }
  }
  if (!model.hasStateMachine || !pattern || !entity) throw noPattern("the screen (no status outcomes)");
  const api = registry.api[bindings.graph];
  if (!api) throw noPattern(`the API of graph ${bindings.graph} (no api ruling)`);
  const statusElement = `${entity}_status`;
  if (!bindings.elements[statusElement]) throw new Error(`the bindings have no ${statusElement} element`);
  for (const s of stateOrder) {
    if (!byState[s]) {
      unprescribed.push({ decision: `the status shown in ${s}: no outcome names it, so the screen shows none`, disposition: "question-list" });
    }
  }

  const actions: ScreenSelection["slots"]["actions"] = [];
  for (const [event, def] of model.events) {
    if (def.actor === "system") continue;
    const element = `${event}_button`;
    const operation = bindings.events?.[event]?.operation;
    if (!bindings.elements[element] || !operation) {
      unprescribed.push({ decision: `the control for ${event}: the bindings have no ${element} element or operation`, disposition: "question-list" });
      continue;
    }
    const states = stateOrder.filter((s) => cells.some((c) => c.from === s && c.on === event));
    actions.push({ event, actor: def.actor, element, operation, in: states });
  }

  const ruleCalls: ScreenSelection["slots"]["rule_calls"] = [];
  for (const c of cells) {
    for (const o of (c.outcome ?? []).map(outcomeText)) {
      for (const [, ruleId] of o.matchAll(/\((RULE-[A-Z0-9-]+)\)/g)) {
        const rule = ruleSelections.get(ruleId!);
        if (!rule || ruleCalls.some((r) => r.rule === ruleId && r.on === c.on)) continue;
        const from = stateOrder.filter((s) => cells.some((x) => x.from === s && x.on === c.on));
        if (!from.every((s) => rule.slots.states.includes(s))) {
          unprescribed.push({ decision: `${ruleId} on ${c.on}: its cases do not cover every state ${c.on} starts from`, disposition: "question-list" });
          continue;
        }
        const literal = bindings.literal_coverage?.[ruleId!]?.literal;
        ruleCalls.push({
          rule: ruleId!,
          on: c.on,
          function: rule.slots.function,
          from: `./${rule.output}`,
          notice_elements: literal && bindings.elements[literal] ? [literal] : [],
        });
      }
    }
  }

  const conflictNotices: ScreenSelection["slots"]["conflict_notices"] = [];
  for (const race of ir.races ?? []) {
    const id = `RACE-${race.state}-${race.between[0]}-${race.between[1]}`;
    const loser = race.between.find((e) => e !== race.winner) ?? "";
    const text = race.outcome.map(outcomeText).join(" ");
    const quoted = [...text.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const element = Object.keys(literals).find(
      (k) => !k.startsWith("status_") && quoted.includes(literals[k]) && bindings.elements[k],
    );
    if (element) conflictNotices.push({ race: id, loser, element });
    else unprescribed.push({ decision: `what the loser of ${id} sees ("${text}"): no element in the bindings`, disposition: "question-list" });
  }

  const screenOutput = `${entity}-screen.ts`;
  selections.push({
    target: `the ${entity} screen`,
    pattern: "entity_status_with_actions",
    output: screenOutput,
    slots: {
      entity,
      api,
      states: stateOrder,
      status: { element: statusElement, by_state: byState },
      actions,
      rule_calls: ruleCalls,
      conflict_notices: conflictNotices,
    },
  });

  const shown = new Set(ruleCalls.flatMap((r) => r.notice_elements));
  return {
    record: `FE-GEN-${ir.usecase}`,
    source: {
      usecase: inputs.irPath,
      version: ir.source.version ?? "",
      bindings: inputs.bindingsPath,
      steps: inputs.stepsPath,
      registry: reg.path,
    },
    selections,
    file_plan: { new: selections.map((s) => s.output), modified: [] },
    unprescribed,
    literal_sweep: {
      unmatched_rules: Object.entries(bindings.literal_coverage ?? {})
        .filter(([, v]) => v.literal && !shown.has(v.literal))
        .map(([id]) => id),
    },
  };
}

// ---- render: decision record → code ---------------------------------------------------------

function ts(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(ts).join(", ")}]`;
  if (v !== null && typeof v === "object") {
    return `{ ${Object.entries(v)
      .map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${ts(x)}`)
      .join(", ")} }`;
  }
  return JSON.stringify(v);
}

const header = (record: DecisionRecord, what: string) =>
  [
    `// Generated by examples/generator/generate.ts from ${record.source.usecase} (source.version ${ts(record.source.version)}),`,
    `// its bindings, step definitions and ${record.source.registry}. ${what}`,
    `// Decisions: ${record.record}. Do not edit: change the inputs and regenerate.`,
  ].join("\n");

function renderRule(record: DecisionRecord, sel: RuleSelection): string {
  const param = sel.slots.states.map(ts).join(" | ");
  return [
    header(record, `Pattern: pure_rule_function (${sel.target}).`),
    "",
    `export function ${sel.slots.function}(state: ${param}) {`,
    "  switch (state) {",
    ...sel.slots.cases.flatMap((c) => [`    case ${ts(c.state)}:`, `      return ${ts(c.returns)} as const;`]),
    "  }",
    "}",
    "",
  ].join("\n");
}

function renderScreen(record: DecisionRecord, sel: ScreenSelection, bindings: ProductBindings): string {
  const s = sel.slots;
  const used = [s.status.element, ...s.actions.map((a) => a.element), ...s.rule_calls.flatMap((r) => r.notice_elements), ...s.conflict_notices.map((c) => c.element)];
  const elements = Object.fromEntries(used.map((e) => [e, bindings.elements[e]]));
  const literals = bindings.literals ?? {};
  const statusText = Object.fromEntries(Object.entries(s.status.by_state).map(([state, key]) => [state, literals[key]]));
  const noticeText = Object.fromEntries(used.filter((e) => literals[e] !== undefined && !e.startsWith("status_")).map((e) => [e, literals[e]]));
  const imports = [...new Map(s.rule_calls.map((r) => [r.function, r.from])).entries()];
  const ruleCalls = s.rule_calls.map(
    (r) => `  ${r.on}: (before) => notice(${r.function}(before as Parameters<typeof ${r.function}>[0])),`,
  );
  const conflicts = Object.fromEntries(s.conflict_notices.map((c) => [c.loser, c.element]));
  const fn = `mount${s.entity[0]!.toUpperCase()}${s.entity.slice(1)}Screen`;
  return [
    header(record, "Pattern: entity_status_with_actions."),
    ...imports.map(([name, from]) => `import { ${name} } from ${ts(from)};`),
    "",
    `type State = ${s.states.map(ts).join(" | ")};`,
    "type Addressing = { role?: string; name?: string; label?: string; testid?: string; text?: string };",
    "",
    `const API = ${ts(s.api)};`,
    "// Locators and copy, copied from the bindings",
    `const ELEMENTS: Record<string, Addressing> = ${ts(elements)};`,
    `const STATUS_TEXT: Partial<Record<State, string>> = ${ts(statusText)};`,
    `const NOTICE_TEXT: Record<string, string> = ${ts(noticeText)};`,
    "// Each event's control, offered to its actor in the states where the event is possible",
    `const ACTIONS: { event: string; actor: string; element: string; operation: string; in: State[] }[] = ${ts(s.actions)};`,
    "// Rules called on an event with the state before it; a returned notice is shown",
    "const notice = (result: object): string | undefined => (\"notice\" in result ? String(result.notice) : undefined);",
    "const RULE_CALLS: Record<string, (before: State) => string | undefined> = {",
    ...ruleCalls,
    "};",
    "// The notice the loser of a race sees when its operation is rejected with the conflict code",
    `const CONFLICT_NOTICES: Record<string, string> = ${ts(conflicts)};`,
    "",
    "function element(id: string, text: string): HTMLElement {",
    "  const a = ELEMENTS[id] ?? {};",
    '  const e = document.createElement(a.role === "button" ? "button" : "p");',
    "  if (a.testid) e.dataset.testid = a.testid;",
    "  e.textContent = a.name ?? a.text ?? text;",
    "  return e;",
    "}",
    "",
    "async function call(operationName: string, id: string): Promise<{ status?: State; conflict?: boolean }> {",
    '  const res = await fetch(API.endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operationName, variables: { id } }) });',
    "  const body = (await res.json()) as { data?: { order?: { status: State } }; errors?: { extensions?: { code?: string } }[] };",
    "  if (body.errors?.some((e) => e.extensions?.code === API.conflict_code)) return { conflict: true };",
    "  if (body.errors || !body.data?.order) throw new Error(`${operationName} failed`);",
    "  return { status: body.data.order.status };",
    "}",
    "",
    `export async function ${fn}(root: HTMLElement, props: { orderId: string; actor: string }): Promise<void> {`,
    "  const loaded = await call(API.read, props.orderId);",
    "  let status = loaded.status as State;",
    "  let notices: string[] = [];",
    "  const render = () => {",
    "    root.replaceChildren(",
    `      element(${ts(s.status.element)}, STATUS_TEXT[status] ?? ""),`,
    "      ...ACTIONS.filter((a) => a.actor === props.actor && a.in.includes(status)).map((a) => {",
    '        const control = element(a.element, "");',
    '        control.addEventListener("click", () => void run(a));',
    "        return control;",
    "      }),",
    '      ...notices.map((key) => element(key, NOTICE_TEXT[key] ?? "")),',
    "    );",
    "  };",
    "  const run = async (a: (typeof ACTIONS)[number]) => {",
    "    const before = status;",
    "    const result = await call(a.operation, props.orderId);",
    "    if (result.conflict) {",
    "      const conflictNotice = CONFLICT_NOTICES[a.event];",
    "      notices = conflictNotice ? [conflictNotice] : [];",
    "    } else {",
    "      status = result.status as State;",
    "      const shown = RULE_CALLS[a.event]?.(before);",
    "      notices = shown ? [shown] : [];",
    "    }",
    "    render();",
    "  };",
    "  render();",
    '  root.dataset.ready = "true";',
    "}",
    "",
  ].join("\n");
}

/** Every product file, keyed by its path relative to the output directory */
export function generateProduct(inputs: Inputs, bindings: ProductBindings, reg: { path: string; registry: Registry }): Map<string, string> {
  const record = select(inputs, bindings, reg);
  const out = new Map<string, string>();
  const note = `# Generated by examples/generator/generate.ts: the selections and slots for the product code of ${inputs.model.ir.usecase}.\n# Do not edit: change the IR, the bindings, the step definitions or the registry and regenerate.\n`;
  const stem = inputs.irPath.replace(/^.*\//, "").replace(/\.usecase\.yaml$/, "");
  out.set(`${stem}.decision.yaml`, note + stringify(record, { lineWidth: 0 }));
  for (const sel of record.selections) {
    out.set(sel.output, sel.pattern === "pure_rule_function" ? renderRule(record, sel) : renderScreen(record, sel, bindings));
  }
  return out;
}
