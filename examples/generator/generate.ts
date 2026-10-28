// Example generator: resolves an approved IR + bindings + step definitions into scenario files,
// then renders those into Playwright tests (integration, E2E) and a vitest unit test. The product
// code (product.ts) comes from the same inputs plus the pattern registry, through a decision record.
// It is example-only: a project writes its renderer for its own test framework. What carries
// over is the step definitions check (`--steps`, src/steps.ts), which loadInputs() runs first:
// every phrase a test needs must resolve, or generation stops.
//
// Usage: node examples/generator/generate.ts [--check]
//   --check: compare with the committed files instead of writing them (exit 1 on a difference)

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import { parseIR } from "../../src/parse.ts";
import { outcomeText, parseSteps, runStepsChecks, type StepsDoc } from "../../src/steps.ts";
import { cellKey, type Model, type OutcomeItem } from "../../src/types.ts";
import { generateProduct, loadRegistry, type ProductBindings } from "./product.ts";

// ---- inputs ---------------------------------------------------------------------------

type Call = { expect: string; not?: string; args?: string[] };
type Unresolved = { unresolved: string };

interface Bindings extends ProductBindings {
  bindings: string;
}

export interface Inputs {
  irPath: string;
  bindingsPath: string;
  stepsPath: string;
  model: Model;
  bindings: Bindings;
  steps: StepsDoc;
}

export function loadInputs(irPath: string, bindingsPath: string, stepsPath: string): Inputs {
  const { model, findings } = parseIR(readFileSync(irPath, "utf8"));
  if (!model) throw new Error(`cannot parse ${irPath}: ${findings.map((f) => f.message).join("; ")}`);
  const bindings = parse(readFileSync(bindingsPath, "utf8")) as Bindings;
  if (bindings.bindings !== model.ir.usecase) {
    throw new Error(`${bindingsPath} is for ${bindings.bindings}, not ${model.ir.usecase}`);
  }
  const parsed = parseSteps(readFileSync(stepsPath, "utf8"));
  const errors = [...parsed.findings, ...(parsed.doc ? runStepsChecks(parsed.doc, { model }) : [])].filter(
    (f) => f.level === "error",
  );
  if (!parsed.doc || errors.length > 0) {
    throw new Error(`${stepsPath}:\n${errors.map((f) => `  - [${f.check}] ${f.message}`).join("\n")}`);
  }
  return { irPath, bindingsPath, stepsPath, model, bindings, steps: parsed.doc };
}

// ---- resolve: IR + bindings + step definitions → scenario files -------------------------

type ResolvedOutcome = { node: string; text: string } & (Call | Unresolved);

interface ResolvedStep {
  event: string;
  actor: string;
  transition: string;
  from: string;
  to: string;
  do: { screen: string } | { fixture: string };
  operation?: string; // bindings: integration registers its response and checks the call
  outcomes: ResolvedOutcome[];
}

export interface ScenarioFile {
  node: string;
  name: string;
  layers: ("integration" | "e2e")[];
  start: { state: string; fixture: string };
  steps?: ResolvedStep[];
  race?: { winner: { event: string; to: string }; loser: Omit<ResolvedStep, "transition" | "to"> };
  questions: string[];
}

/** Every phrase without a step definition is collected, then reported at once. */
export function resolve({ model, bindings, steps }: Inputs): ScenarioFile[] {
  const missing: string[] = [];
  const need = <T>(table: Record<string, T> | undefined, key: string, what: string): T | undefined => {
    const hit = table?.[key];
    if (hit === undefined) missing.push(`${what}: ${key}`);
    return hit;
  };
  const outcomes = (node: string, items: OutcomeItem[] | undefined): ResolvedOutcome[] =>
    (items ?? []).flatMap((o, i) => {
      const text = outcomeText(o);
      const def = need(steps.outcomes, text, "outcome");
      return def ? [{ node: `${node}-o${i + 1}`, text, ...def }] : [];
    });
  const step = (from: string, event: string) => {
    const cell = model.cells.get(cellKey(from, event))?.find((c) => !c.impossible);
    if (!cell?.to) throw new Error(`no transition ${from} × ${event}`);
    const def = need(steps.events, event, "event");
    const transition = `T-${from}-${event}`;
    return {
      event,
      actor: model.events.get(event)?.actor ?? "",
      transition,
      from,
      to: cell.to,
      do: def ?? { screen: "?" },
      ...(bindings.events?.[event] ? { operation: bindings.events[event].operation } : {}),
      outcomes: outcomes(transition, cell.outcome),
    };
  };
  const start = (state: string) => ({ state, fixture: need(steps.states, state, "start state")?.fixture ?? "?" });

  const files: ScenarioFile[] = [];
  for (const sc of model.ir.scenarios) {
    const questions: string[] = [];
    let state = model.initial ?? "";
    const first = start(state);
    const resolvedSteps = (sc.path ?? []).map((event) => {
      const s = step(state, event);
      state = s.to;
      return s;
    });
    for (const given of sc.given ?? []) {
      const def = need(steps.givens, given, "given");
      if (def && def.state !== first.state) {
        questions.push(`given "${given}" describes ${def.state}, but the path starts at ${first.state} — the path is walked`);
      }
    }
    files.push({
      node: sc.id,
      name: sc.name,
      layers: sc.critical ? ["integration", "e2e"] : ["integration"],
      start: first,
      steps: resolvedSteps,
      questions,
    });
  }
  // A race is two nodes: the winner belongs to the backend, the loser's view to integration
  for (const race of model.ir.races ?? []) {
    const node = `RACE-${race.state}-${race.between[0]}-${race.between[1]}-outcome`;
    const loserEvent = race.between.find((e) => e !== race.winner) ?? "";
    const won = step(race.state, race.winner);
    const lost = step(race.state, loserEvent);
    const resolvedOutcomes = outcomes(node, race.outcome).map((o) => ({ ...o, node }));
    files.push({
      node,
      name: `${loserEvent} loses to ${race.winner}`,
      layers: ["integration"],
      start: start(race.state),
      race: {
        winner: { event: race.winner, to: won.to },
        loser: { event: loserEvent, actor: lost.actor, from: race.state, do: lost.do, operation: lost.operation, outcomes: resolvedOutcomes },
      },
      questions: [],
    });
  }
  if (missing.length > 0) {
    throw new Error(`no step definition for:\n${[...new Set(missing)].map((m) => `  - ${m}`).join("\n")}`);
  }
  return files;
}

// ---- render: scenario files → test code ---------------------------------------------------

/** TypeScript literal for plain data (unquoted keys where possible). */
function ts(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(ts).join(", ")}]`;
  if (v !== null && typeof v === "object") {
    const body = Object.entries(v)
      .map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${ts(x)}`)
      .join(", ");
    return `{ ${body} }`;
  }
  return JSON.stringify(v);
}

const isCall = (o: ResolvedOutcome): o is ResolvedOutcome & Call => "expect" in o;
const call = (method: string, args: string[] = []) => `await screen.${method}(${args.map(ts).join(", ")});`;

function header(inputs: Inputs, nodes: string[], extra: string[]): string {
  return [
    `// Generated by examples/generator/generate.ts from ${inputs.irPath} (source.version ${ts(inputs.model.ir.source.version ?? "")}),`,
    `// its bindings and step definitions. Nodes: ${inputs.model.ir.usecase} ${nodes.join(", ")}.`,
    ...extra.map((l) => `// ${l}`),
    "// Do not edit: change the IR, the bindings or the step definitions and regenerate.",
  ].join("\n");
}

function renderStep(s: ResolvedStep | Omit<ResolvedStep, "transition" | "to">, layer: "integration" | "e2e", lines: string[]) {
  const calls = s.outcomes.filter(isCall);
  if (layer === "integration" && s.operation && "to" in s) lines.push(`  h.fake.respond(${ts(s.event)}, { status: ${ts(s.to)} });`);
  for (const o of calls) if (o.not) lines.push(`  ${call(o.not, o.args)}`);
  if ("screen" in s.do) lines.push(`  ${call(s.do.screen)}`);
  else lines.push(`  await h.fixtures.${s.do.fixture}(orderId);`, `  await screen.refresh();`);
  for (const o of s.outcomes) {
    if (!isCall(o)) {
      lines.push(`  // ${o.node} "${o.text}" is not asserted: ${o.unresolved}`);
      continue;
    }
    lines.push(`  ${call(o.expect, o.args)}`);
    // A race outcome is named by the test's tag; transition outcomes print a marker
    if (o.node.startsWith("T-")) lines.push(`  outcome(${ts(o.node)});`);
  }
  if (layer === "integration" && s.operation && "to" in s) lines.push(`  expect(h.fake.calls(${ts(s.event)})).toHaveLength(1);`);
}

function renderTest(f: ScenarioFile, layer: "integration" | "e2e"): string | undefined {
  const fixture = layer === "integration" ? "page" : "browser";
  const harness = layer === "integration" ? "integrationHarness" : "e2eHarness";
  const lines = [
    `test(\`\${UC}__${f.node} ${f.name}\`, async ({ ${fixture} }) => {`,
    ...f.questions.map((q) => `  // question: ${q}`),
    `  const h = await ${harness}(${fixture});`,
    `  const orderId = await h.fixtures.${f.start.fixture}(); // ${f.start.state}`,
  ];
  if (f.race) {
    const { winner, loser } = f.race;
    // Nothing to assert means no test: an assertion-free test would be a false green
    if (!loser.outcomes.some(isCall)) return undefined;
    lines.push(
      `  const screen = await h.screen(${ts(loser.actor)}, orderId);`,
      "",
      `  // ${winner.event} wins: the order is ${winner.to} before ${loser.event} (${loser.actor}) commits`,
      `  h.fake.setStatus(orderId, ${ts(winner.to)});`,
      `  h.fake.rejectAsConflict(${ts(loser.event)});`,
    );
    renderStep(loser, layer, lines);
  } else {
    let actor: string | undefined;
    for (const s of f.steps ?? []) {
      lines.push("", `  // ${s.event} (${s.actor}): ${s.from} → ${s.to}`);
      if (s.actor !== "system" && s.actor !== actor) {
        lines.push(`  ${actor === undefined ? "let " : ""}screen = await h.screen(${ts(s.actor)}, orderId);`);
        actor = s.actor;
      }
      renderStep(s, layer, lines);
    }
  }
  lines.push("});");
  return lines.join("\n");
}

function renderPlaywright(inputs: Inputs, files: ScenarioFile[], layer: "integration" | "e2e"): string {
  const uc = inputs.model.ir.usecase;
  const tests = files.filter((f) => f.layers.includes(layer)).flatMap((f) => renderTest(f, layer) ?? []);
  const nodes = files.filter((f) => f.layers.includes(layer) && tests.some((t) => t.includes(`__${f.node} `))).map((f) => f.node);
  const scope = layer === "integration" ? "every scenario and every race's losing side" : "critical: true scenarios only";
  const extra =
    layer === "integration"
      ? [`Integration covers ${scope}, against a fake backend.`]
      : [`E2E covers ${scope}, against the real environment. A Red is drift for a person to adjudicate.`];
  const imports =
    layer === "integration"
      ? [`import { expect, test } from "@playwright/test";`, `import { integrationHarness } from "./harness.ts";`]
      : [`import { test } from "@playwright/test";`, `import { e2eHarness } from "./harness.ts";`];
  return [
    header(inputs, nodes, extra),
    ...imports,
    "",
    `const UC = ${ts(uc)};`,
    "// Printed right after the assert of a transition outcome passes (docs/trace.md)",
    "const outcome = (node: string) => console.log(`[ESDD-OUTCOME] ${UC}__${node}`);",
    "",
    tests.join("\n\n"),
    "",
  ].join("\n");
}

function renderUnit(inputs: Inputs): Map<string, string> {
  const out = new Map<string, string>();
  for (const rule of inputs.model.ir.rules ?? []) {
    const def = inputs.steps.rules?.[rule.id];
    if (!def) throw new Error(`no step definition for: rule: ${rule.id}`);
    if (def.cases.length !== rule.cases.length) {
      throw new Error(`${rule.id}: the IR has ${rule.cases.length} cases, the step definitions ${def.cases.length}`);
    }
    const nodes = rule.cases.map((_, i) => `${rule.id}-c${i + 1}`);
    const cases = rule.cases.map((c, i) => {
      const d = def.cases[i]!;
      return `  { caseNo: ${i + 1}, input: ${ts(c.input)}, expected: ${ts(c.expected)}, args: ${ts(d.args)}, returns: ${ts(d.returns)} },`;
    });
    out.set(
      `${def.function.from.replace(/^\.\//, "").replace(/\.ts$/, "")}.test.ts`,
      [
        header(inputs, nodes, ["Unit covers every rule case, one row per IR case in IR order."]),
        `import { describe, expect, it } from "vitest";`,
        `import { ${def.function.name} } from ${ts(def.function.from)};`,
        "",
        `const UC = ${ts(inputs.model.ir.usecase)};`,
        "",
        "const cases = [",
        ...cases,
        "] as const;",
        "",
        `describe(${ts(`${rule.id} ${rule.name}`)}, () => {`,
        `  it.each(cases)(\`\${UC}__${rule.id}-c$caseNo $input\`, ({ args, returns }) => {`,
        `    expect(${def.function.name}(...(args as Parameters<typeof ${def.function.name}>))).toEqual(returns);`,
        "  });",
        "});",
        "",
      ].join("\n"),
    );
  }
  return out;
}

/** Every generated file, keyed by its path relative to the output directory. */
export function generate(inputs: Inputs, registryPath = EXAMPLE.registry): Map<string, string> {
  const files = resolve(inputs);
  const out = new Map<string, string>();
  for (const f of files) {
    const note = `# Resolved by examples/generator/generate.ts from ${inputs.irPath}, its bindings and step definitions.\n# Do not edit: regenerate.\n`;
    out.set(`scenarios/${f.node}.yaml`, note + stringify(f, { lineWidth: 0 }));
  }
  const stem = inputs.irPath.replace(/^.*\//, "").replace(/\.usecase\.yaml$/, "");
  out.set(`${stem}.integration.ts`, renderPlaywright(inputs, files, "integration"));
  out.set(`${stem}.e2e.ts`, renderPlaywright(inputs, files, "e2e"));
  for (const [path, body] of renderUnit(inputs)) out.set(path, body);
  for (const [path, body] of generateProduct(inputs, inputs.bindings, loadRegistry(registryPath))) out.set(path, body);
  return out;
}

// ---- CLI ------------------------------------------------------------------------------------

export const EXAMPLE = {
  ir: "examples/order-cancel.usecase.yaml",
  bindings: "examples/order-cancel.bindings.yaml",
  steps: "examples/order-cancel.steps.yaml",
  registry: "examples/pattern-registry.yaml",
  out: "examples/order-cancel.generated",
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
  process.chdir(root);
  const check = process.argv.includes("--check");
  const out = generate(loadInputs(EXAMPLE.ir, EXAMPLE.bindings, EXAMPLE.steps));
  let differs = false;
  for (const [path, body] of out) {
    const target = join(EXAMPLE.out, path);
    if (check) {
      let current = "";
      try {
        current = readFileSync(target, "utf8");
      } catch {}
      if (current !== body) {
        console.error(`differs: ${target}`);
        differs = true;
      }
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
      console.log(`wrote ${target}`);
    }
  }
  if (differs) process.exit(1);
}
