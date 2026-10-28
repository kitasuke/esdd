// ESDD UseCase IR checker CLI
//
// Usage:
//   node src/cli.ts <ir.yaml> [<ir.yaml> ...] [--definitions <definitions.yaml>]
//                   [--bindings <bindings.yaml>] [--steps <steps.yaml>] [--suggest-paths] [--json] [--strict]
//                   [--results <unit|backend|integration|e2e>=<junit.xml|dir|go-test.json|log> ...]
//                   [--trace <trace.yaml>] [--scenarios <dir>] [--approved]
//
// --bindings checks a locator/literal contract (docs/bindings.md).
// When the target usecase's IR is passed alongside, the full-population
// cross-check of literal_coverage also runs.
// --steps checks step definitions (docs/generation.md "Step definitions and scenario files").
// With the target IR passed alongside, every IR event / given / outcome / rule case must resolve.
// --results cross-checks that every behavior node of the IR is confirmed by a test that
// actually ran (the behavior trace — docs/trace.md). --trace holds the untested / owned_by /
// negative_controls declarations. --scenarios reads negative_control.controls[].nodes from
// scenario files and checks that every node Green through a direct test has a negative control.
// --approved checks the IRs as approved IRs (docs/approval.md): the approval record and spec version
// are required, the file name must match the usecase id, and pending markers become errors.
//
// Exit codes: 0 = no errors / 1 = errors (with --strict, warns too) / 2 = invalid input

import { readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { parseBindings, runBindingsChecks } from "./bindings.ts";
import { coveredCells, inputConditions, runChecks } from "./checks.ts";
import { loadObservationNames } from "./definitions.ts";
import { checkApproved, escalatePending } from "./approval.ts";
import { parseIR } from "./parse.ts";
import { parseSteps, runStepsChecks } from "./steps.ts";
import { suggestPaths } from "./paths.ts";
import {
  collectScenarioControls,
  formatTraceTable,
  LAYERS,
  type Layer,
  parseGoTestJson,
  parseJUnit,
  parseOutcomeMarkers,
  parseTrace,
  runTrace,
  type ScenarioControls,
  type TestCaseResult,
  type TraceDoc,
  type TraceRow,
  traceSummary,
} from "./trace.ts";
import { cellKey, type Finding, type Model } from "./types.ts";

interface Args {
  files: string[];
  bindings: string[];
  steps: string[];
  results: { layer: Layer; path: string }[];
  scenarios?: string;
  traces: string[];
  definitions?: string;
  suggest: boolean;
  json: boolean;
  strict: boolean;
  approved: boolean;
}

// When run via `pnpm --filter`, cwd is the package directory, so resolve
// relative paths against the caller (INIT_CWD, assumed to be the repo root)
function resolveInput(p: string): string {
  if (isAbsolute(p)) return p;
  return resolve(process.env["INIT_CWD"] ?? process.cwd(), p);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    files: [],
    bindings: [],
    steps: [],
    results: [],
    traces: [],
    suggest: false,
    json: false,
    strict: false,
    approved: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--") {
      // `pnpm run` passes `--` through verbatim, so skip it as a separator
      continue;
    }
    if (a === "--definitions") {
      args.definitions = argv[++i];
    } else if (a === "--bindings") {
      const p = argv[++i];
      if (p) args.bindings.push(p);
    } else if (a === "--steps") {
      const p = argv[++i];
      if (p) args.steps.push(p);
    } else if (a === "--results") {
      const v = argv[++i] ?? "";
      const eq = v.indexOf("=");
      const layer = v.slice(0, eq);
      if (eq < 0 || !(LAYERS as readonly string[]).includes(layer)) {
        console.error(`--results takes <${LAYERS.join("|")}>=<path>: ${v}`);
        process.exit(2);
      }
      args.results.push({ layer: layer as Layer, path: v.slice(eq + 1) });
    } else if (a === "--scenarios") {
      args.scenarios = argv[++i];
    } else if (a === "--trace") {
      const p = argv[++i];
      if (p) args.traces.push(p);
    } else if (a === "--suggest-paths") {
      args.suggest = true;
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "--strict") {
      args.strict = true;
    } else if (a === "--approved") {
      args.approved = true;
    } else if (a.startsWith("--")) {
      console.error(`unknown option: ${a}`);
      process.exit(2);
    } else {
      args.files.push(a);
    }
  }
  return args;
}

/** A file is returned as is; a directory yields the files under it with the given extensions, recursively */
function collectFiles(path: string, exts: string[]): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path, { withFileTypes: true }).flatMap((e) => {
    const child = join(path, e.name);
    if (e.isDirectory()) return collectFiles(child, exts);
    return exts.some((x) => e.name.endsWith(x)) ? [child] : [];
  });
}

/** Collects, from scenario files, the negative control records that name IR nodes */
function loadScenarioControls(dir: string): ScenarioControls {
  let files: string[];
  try {
    files = collectFiles(resolveInput(dir), [".yaml", ".yml"]);
  } catch (e) {
    console.error(`cannot read --scenarios ${dir}: ${(e as Error).message}`);
    process.exit(2);
  }
  return collectScenarioControls(files.map((f) => ({ path: f, text: readFileSync(f, "utf8") })));
}

function loadResults(specs: Args["results"]): TestCaseResult[] {
  const results: TestCaseResult[] = [];
  for (const { layer, path } of specs) {
    let files: string[];
    try {
      files = collectFiles(resolveInput(path), [".xml"]);
    } catch (e) {
      console.error(`cannot read --results ${path}: ${(e as Error).message}`);
      process.exit(2);
    }
    if (files.length === 0) {
      console.error(`--results contains no JUnit XML: ${path}`);
      process.exit(2);
    }
    for (const f of files) {
      // .json / .jsonl are read as `go test -json` output; .log / .txt as a log that only carries
      // outcome markers (e.g. a device log — no test cases). A directory scan picks up .xml only
      const text = readFileSync(f, "utf8");
      if (/\.jsonl?$/.test(f)) results.push(...parseGoTestJson(text, layer, f));
      else if (!/\.(log|txt)$/.test(f)) results.push(...parseJUnit(text, layer, f));
      results.push(...parseOutcomeMarkers(text, layer, f));
    }
  }
  return results;
}

function matrixStats(model: Model): { total: number; transitions: number; impossible: number } {
  const nonTerminal = [...model.states.values()].filter((s) => !s.terminal).length;
  const total = nonTerminal * model.events.size;
  let transitions = 0;
  let impossible = 0;
  for (const list of model.cells.values()) {
    for (const c of list) {
      if (model.states.get(c.from)?.terminal) continue;
      if (c.impossible) impossible++;
      else transitions++;
    }
  }
  return { total, transitions, impossible };
}

function coverageStats(model: Model): { covered: number; total: number } {
  const covered = coveredCells(model);
  let total = 0;
  let hit = 0;
  for (const list of model.cells.values()) {
    for (const c of list) {
      if (c.impossible) continue;
      total++;
      if (covered.has(cellKey(c.from, c.on))) hit++;
    }
  }
  return { covered: hit, total };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.files.length === 0 && args.bindings.length === 0 && args.steps.length === 0) {
    console.error(
      "usage: node src/cli.ts <ir.yaml> [--definitions <path>] [--bindings <path>] [--steps <path>] [--suggest-paths] [--json] [--strict] [--approved] [--results <layer>=<path> ...] [--trace <path>] [--scenarios <dir>]",
    );
    process.exit(2);
  }

  if ((args.traces.length > 0 || args.scenarios) && args.results.length === 0) {
    console.error("--trace / --scenarios must be passed together with --results (the JUnit XML of the tests that ran)");
    process.exit(2);
  }
  const testResults = args.results.length > 0 ? loadResults(args.results) : undefined;
  const scenarioControls = args.scenarios ? loadScenarioControls(args.scenarios) : undefined;
  const traceDocs = new Map<string, TraceDoc>();
  const traceFindings: Finding[] = [];
  for (const file of args.traces) {
    let source: string;
    try {
      source = readFileSync(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`cannot read ${file}: ${(e as Error).message}`);
      process.exit(2);
    }
    const { doc, findings } = parseTrace(source);
    traceFindings.push(...findings.map((f) => ({ ...f, message: `${file}: ${f.message}` })));
    if (doc) traceDocs.set(doc.trace, doc);
  }

  let observationNames: Set<string> | undefined;
  if (args.definitions) {
    try {
      observationNames = loadObservationNames(resolveInput(args.definitions));
    } catch (e) {
      console.error(`cannot load definitions: ${(e as Error).message}`);
      process.exit(2);
    }
  }

  let hasError = false;
  let hasWarn = false;
  const jsonOut: Record<string, unknown>[] = [];
  // Index parsed IRs by usecase id for the --bindings cross-check
  const models = new Map<string, Model>();

  for (const file of args.files) {
    let source: string;
    try {
      source = readFileSync(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`cannot read ${file}: ${(e as Error).message}`);
      process.exit(2);
    }
    const { model, findings: parseFindings } = parseIR(source);
    let findings: Finding[] = [...parseFindings];
    let suggestions: string[][] = [];
    let traceRows: TraceRow[] | undefined;
    if (model) {
      findings.push(...runChecks(model, { observationNames }));
      if (args.suggest) suggestions = suggestPaths(model);
      models.set(model.ir.usecase, model);
      if (testResults) {
        const trace = runTrace(model, testResults, traceDocs.get(model.ir.usecase), scenarioControls);
        findings.push(...trace.findings);
        traceRows = trace.rows;
      }
      if (args.approved) {
        findings = escalatePending(findings);
        findings.push(...checkApproved(model, file));
      }
    }

    const errors = findings.filter((f) => f.level === "error");
    const warns = findings.filter((f) => f.level === "warn");
    if (errors.length > 0) hasError = true;
    if (warns.length > 0) hasWarn = true;

    if (args.json) {
      jsonOut.push({
        file,
        ok: errors.length === 0,
        findings,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        trace: traceRows,
      });
      continue;
    }

    console.log(`\n=== ${file} ===`);
    if (model?.hasStateMachine) {
      const m = matrixStats(model);
      const cov = coverageStats(model);
      console.log(
        `state machine: states=${model.states.size} events=${model.events.size} ` +
          `cells ${m.transitions + m.impossible}/${m.total} declared ` +
          `(transitions ${m.transitions} / impossible ${m.impossible})`,
      );
      console.log(`transition coverage: ${cov.covered}/${cov.total} exercised by scenarios`);
    }
    if (model && (model.ir.inputs?.length ?? 0) > 0) {
      const conds = inputConditions(model);
      let totalCells = 0;
      let naCells = 0;
      for (const inp of model.ir.inputs!) {
        const c = conds.get(inp.id) ?? [];
        totalCells += c.length;
        naCells += Object.keys(inp.na ?? {}).filter((k) => c.includes(k)).length;
      }
      console.log(
        `inputs: ${model.ir.inputs!.length} inputs, ${totalCells} cells (${naCells} declared na)`,
      );
    }
    for (const f of errors) console.log(`  ERROR [${f.check}] ${f.message}`);
    for (const f of warns) console.log(`  WARN  [${f.check}] ${f.message}`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("  ✓ all checks passed");
    } else {
      console.log(`  → ERROR ${errors.length} / WARN ${warns.length}`);
    }
    if (suggestions.length > 0) {
      console.log("  suggested paths for uncovered transitions:");
      suggestions.forEach((p, i) => console.log(`    path ${i + 1}: [${p.join(", ")}]`));
    }
    if (traceRows) {
      console.log(`\n${traceSummary(traceRows)}\n`);
      console.log(formatTraceTable(traceRows));
    }
  }

  // A trace.yaml whose target IR is not among the inputs would pass without being cross-checked, so fail it
  for (const id of traceDocs.keys()) {
    if (!models.has(id)) {
      traceFindings.push({
        level: "error",
        check: "trace-usecase",
        message: `the IR of the trace target usecase ${id} is not among the inputs`,
      });
    }
  }
  if (traceFindings.length > 0) {
    hasError ||= traceFindings.some((f) => f.level === "error");
    hasWarn ||= traceFindings.some((f) => f.level === "warn");
    if (args.json) {
      jsonOut.push({
        file: "(trace)",
        ok: !traceFindings.some((f) => f.level === "error"),
        findings: traceFindings,
      });
    } else {
      console.log("\n=== trace ===");
      for (const f of traceFindings) {
        console.log(`  ${f.level === "error" ? "ERROR" : "WARN "} [${f.check}] ${f.message}`);
      }
    }
  }

  for (const file of args.bindings) {
    let source: string;
    try {
      source = readFileSync(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`cannot read ${file}: ${(e as Error).message}`);
      process.exit(2);
    }
    const { doc, findings: parseFindings } = parseBindings(source);
    const findings: Finding[] = [...parseFindings];
    let matched: string | undefined;
    if (doc) {
      const model = models.get(doc.bindings);
      if (model) {
        matched = doc.bindings;
      } else if (args.files.length > 0) {
        findings.push({
          level: "error",
          check: "bindings-usecase",
          message: `the IR of the target usecase ${doc.bindings} is not among the inputs (pass the corresponding IR alongside)`,
        });
      }
      findings.push(...runBindingsChecks(doc, { model }));
    }

    const errors = findings.filter((f) => f.level === "error");
    const warns = findings.filter((f) => f.level === "warn");
    if (errors.length > 0) hasError = true;
    if (warns.length > 0) hasWarn = true;

    if (args.json) {
      jsonOut.push({ file, ok: errors.length === 0, findings });
      continue;
    }

    console.log(`\n=== ${file} (bindings) ===`);
    if (doc) {
      const stats = [
        `elements ${Object.keys(doc.elements).length}`,
        doc.events ? `events ${Object.keys(doc.events).length}` : undefined,
        doc.literals ? `literals ${Object.keys(doc.literals).length}` : undefined,
        matched ? `IR cross-check: ${matched}` : "IR cross-check: none",
      ].filter((s) => s !== undefined);
      console.log(`bindings: ${stats.join(" / ")}`);
    }
    for (const f of errors) console.log(`  ERROR [${f.check}] ${f.message}`);
    for (const f of warns) console.log(`  WARN  [${f.check}] ${f.message}`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("  ✓ all checks passed");
    } else {
      console.log(`  → ERROR ${errors.length} / WARN ${warns.length}`);
    }
  }

  for (const file of args.steps) {
    let source: string;
    try {
      source = readFileSync(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`cannot read ${file}: ${(e as Error).message}`);
      process.exit(2);
    }
    const { doc, findings: parseFindings } = parseSteps(source);
    const findings: Finding[] = [...parseFindings];
    const model = doc ? models.get(doc.steps) : undefined;
    if (doc) {
      if (!model && args.files.length > 0) {
        findings.push({
          level: "error",
          check: "steps-usecase",
          message: `the IR of the target usecase ${doc.steps} is not among the inputs (pass the corresponding IR alongside)`,
        });
      }
      findings.push(...runStepsChecks(doc, { model }));
    }

    const errors = findings.filter((f) => f.level === "error");
    const warns = findings.filter((f) => f.level === "warn");
    if (errors.length > 0) hasError = true;
    if (warns.length > 0) hasWarn = true;

    if (args.json) {
      jsonOut.push({ file, ok: errors.length === 0, findings });
      continue;
    }

    console.log(`\n=== ${file} (steps) ===`);
    if (doc) {
      const counts = (["states", "givens", "events", "outcomes", "rules"] as const)
        .map((k) => `${k} ${Object.keys(doc[k] ?? {}).length}`)
        .join(" / ");
      console.log(`steps: ${counts} / IR cross-check: ${model ? doc.steps : "none"}`);
    }
    for (const f of errors) console.log(`  ERROR [${f.check}] ${f.message}`);
    for (const f of warns) console.log(`  WARN  [${f.check}] ${f.message}`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("  ✓ all checks passed");
    } else {
      console.log(`  → ERROR ${errors.length} / WARN ${warns.length}`);
    }
  }

  if (args.json) console.log(JSON.stringify(jsonOut, null, 2));
  process.exit(hasError || (args.strict && hasWarn) ? 1 : 0);
}

main();
