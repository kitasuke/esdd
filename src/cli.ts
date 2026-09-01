// ESDD UseCase IR checker CLI
//
// 使い方:
//   node src/cli.ts <ir.yaml> [<ir.yaml> ...] [--definitions <e2e-definitions.yaml>]
//                   [--bindings <bindings.yaml>] [--suggest-paths] [--json] [--strict]
//
// --bindings は locator/literal 契約 (docs/qa/esdd/bindings.md) を検査する。
// 対象 usecase の IR を同時に渡すと literal_coverage の全数突合まで行う。
//
// 終了コード: 0 = エラーなし / 1 = エラーあり(--strict時はwarnも) / 2 = 入力不正

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

// pnpm --filter 経由の実行では cwd がパッケージディレクトリになるため、
// 相対パスは呼び出し元 (INIT_CWD = リポジトリルート想定) を基準に解決する
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
      // pnpm run 経由では `--` がそのまま渡ってくるので区切りとして無視する
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
      console.error(`不明なオプション: ${a}`);
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
      "使い方: node src/cli.ts <ir.yaml> [--definitions <path>] [--bindings <path>] [--suggest-paths] [--json] [--strict]",
    );
    process.exit(2);
  }

  let observationNames: Set<string> | undefined;
  if (args.definitions) {
    try {
      observationNames = loadObservationNames(resolveInput(args.definitions));
    } catch (e) {
      console.error(`definitions を読み込めません: ${(e as Error).message}`);
      process.exit(2);
    }
  }

  let hasError = false;
  let hasWarn = false;
  const jsonOut: Record<string, unknown>[] = [];
  // --bindings のクロスチェック用に、パース済み IR を usecase id で引けるようにしておく
  const models = new Map<string, Model>();

  for (const file of args.files) {
    let source: string;
    try {
      source = readFileSync(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`読み込めません: ${file}: ${(e as Error).message}`);
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
        `状態機械: states=${model.states.size} events=${model.events.size} ` +
          `セル ${m.transitions + m.impossible}/${m.total} 宣言済み ` +
          `(遷移${m.transitions} / impossible ${m.impossible})`,
      );
      console.log(`遷移カバレッジ: ${cov.covered}/${cov.total} がシナリオに踏まれている`);
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
        `入力軸: ${model.ir.inputs!.length}入力 セル${totalCells} (うち na 宣言 ${naCells})`,
      );
    }
    for (const f of errors) console.log(`  ERROR [${f.check}] ${f.message}`);
    for (const f of warns) console.log(`  WARN  [${f.check}] ${f.message}`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("  ✓ すべての検査を通過しました");
    } else {
      console.log(`  → ERROR ${errors.length} / WARN ${warns.length}`);
    }
    if (suggestions.length > 0) {
      console.log("  未カバー遷移を踏むパス案:");
      suggestions.forEach((p, i) => console.log(`    案${i + 1}: [${p.join(", ")}]`));
    }
  }

  for (const file of args.bindings) {
    let source: string;
    try {
      source = readFileSync(resolveInput(file), "utf8");
    } catch (e) {
      console.error(`読み込めません: ${file}: ${(e as Error).message}`);
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
          message: `対象 usecase ${doc.bindings} の IR が入力にありません (対応する IR を一緒に渡してください)`,
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
        `要素 ${Object.keys(doc.elements).length}`,
        doc.events ? `イベント ${Object.keys(doc.events).length}` : undefined,
        doc.literals ? `literal ${Object.keys(doc.literals).length}` : undefined,
        matched ? `IR 突合: ${matched}` : "IR 突合: なし",
      ].filter((s) => s !== undefined);
      console.log(`bindings: ${stats.join(" / ")}`);
    }
    for (const f of errors) console.log(`  ERROR [${f.check}] ${f.message}`);
    for (const f of warns) console.log(`  WARN  [${f.check}] ${f.message}`);
    if (errors.length === 0 && warns.length === 0) {
      console.log("  ✓ すべての検査を通過しました");
    } else {
      console.log(`  → ERROR ${errors.length} / WARN ${warns.length}`);
    }
  }

  if (args.json) console.log(JSON.stringify(jsonOut, null, 2));
  process.exit(hasError || (args.strict && hasWarn) ? 1 : 0);
}

main();
