// ESDD UseCase IR checker CLI
//
// Usage:
//   node src/cli.ts <ir.yaml> [<ir.yaml> ...] [--definitions <definitions.yaml>]
//                   [--bindings <bindings.yaml>] [--suggest-paths] [--json] [--strict]
//
// --bindings checks a locator/literal contract (docs/bindings.md).
// When the target usecase's IR is passed alongside, the full-population
// cross-check of literal_coverage also runs.
//
// Exit codes: 0 = no errors / 1 = errors (with --strict, warns too) / 2 = invalid input

import { readFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import process from "node:process";
import { parseBindings, runBindingsChecks } from "./bindings.ts";
import { coveredCells, inputConditions, runChecks } from "./checks.ts";
import { loadObservationNames } from "./definitions.ts";
import { parseIR } from "./parse.ts";
import { suggestPaths } from "./paths.ts";
import { cellKey, type Finding, type Model } from "./types.ts";

interface Args {
  files: string[];
  bindings: string[];
  definitions?: string;
  suggest: boolean;
  json: boolean;
  strict: boolean;
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
    suggest: false,
    json: false,
    strict: false,
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
    } else if (a === "--suggest-paths") {
      args.suggest = true;
    } else if (a === "--json") {
      args.json = true;
    } else if (a === "--strict") {
      args.strict = true;
    } else if (a.startsWith("--")) {
      console.error(`unknown option: ${a}`);
      process.exit(2);
    } else {
      args.files.push(a);
    }
  }
  return args;
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
  if (args.files.length === 0 && args.bindings.length === 0) {
    console.error(
      "usage: node src/cli.ts <ir.yaml> [--definitions <path>] [--bindings <path>] [--suggest-paths] [--json] [--strict]",
    );
    process.exit(2);
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
    const findings: Finding[] = [...parseFindings];
    let suggestions: string[][] = [];
    if (model) {
      findings.push(...runChecks(model, { observationNames }));
      if (args.suggest) suggestions = suggestPaths(model);
      models.set(model.ir.usecase, model);
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

  if (args.json) console.log(JSON.stringify(jsonOut, null, 2));
  process.exit(hasError || (args.strict && hasWarn) ? 1 : 0);
}

main();
