// UseCase IR の意味検査群。
// すべて単純なグラフ走査で、モデル検査器は使わない。
// 検査の失敗は「仕様への質問」として読めるメッセージにする。

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

/** 網羅性: 非終端の全state × 全event が transition か impossible で宣言されているか */
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
            `${state} × ${event}: 未定義です。「${state}のときに${label}が起きたら?」に答えてください` +
            `(遷移を定義するか、impossible: true と reason を宣言する)`,
        });
      }
    }
  }
  return findings;
}

/** 決定性: 同じ (from, on) に複数の宣言がないか */
export function checkDeterminism(model: Model): Finding[] {
  const findings: Finding[] = [];
  for (const [key, list] of model.cells) {
    if (list.length > 1) {
      findings.push({
        level: "error",
        check: "determinism",
        message: `${key.replace(" ", " × ")}: 宣言が${list.length}件あります(transitions[${list
          .map((c) => c.entryIndex)
          .join("], transitions[")}])。1セルにつき宣言は1つです`,
      });
    }
  }
  return findings;
}

/** 終端状態から出る遷移がないか */
export function checkTerminals(model: Model): Finding[] {
  const findings: Finding[] = [];
  for (const c of transitionCells(model)) {
    if (model.states.get(c.from)?.terminal) {
      findings.push({
        level: "error",
        check: "terminals",
        message: `${c.from} は terminal ですが遷移 (on: ${c.on}) が定義されています`,
      });
    }
  }
  return findings;
}

/** 到達性: initial から全stateに到達できるか */
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
        message: `${s}: initial (${model.initial}) からどのイベント列でも到達できません`,
      });
    }
  }
  return findings;
}

/** 脱出可能性: 全ての非終端stateから終端に到達できるか(ユーザーが詰まないか) */
export function checkEscapability(model: Model): Finding[] {
  const findings: Finding[] = [];
  const terminals = [...model.states.values()].filter((s) => s.terminal).map((s) => s.id);
  if (terminals.length === 0) {
    findings.push({
      level: "error",
      check: "escapability",
      message: "terminal な state がありません。少なくとも1つの終端状態が必要です",
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
        message: `${s}: どの終端状態にも到達できません(この状態に入るとユーザーが詰みます)`,
      });
    }
  }
  return findings;
}

/**
 * 競合宣言の義務: 同一stateに異なるactorのイベントによる遷移が複数ある場合、
 * そのペアの競合時の振る舞いが races に宣言されているか。
 */
export function checkRaces(model: Model): Finding[] {
  const findings: Finding[] = [];
  const races = model.ir.races ?? [];

  // 宣言自体の妥当性
  races.forEach((r, i) => {
    const at = `races[${i}]`;
    if (!model.states.has(r.state)) {
      findings.push({ level: "error", check: "races", message: `${at}: state が未定義です: ${r.state}` });
      return;
    }
    for (const e of r.between) {
      if (!model.events.has(e)) {
        findings.push({ level: "error", check: "races", message: `${at}: event が未定義です: ${e}` });
      } else {
        const cell = one(model, r.state, e);
        if (!cell || cell.impossible) {
          findings.push({
            level: "warn",
            check: "races",
            message: `${at}: ${r.state} で ${e} は遷移として定義されていません(競合は発生しません)`,
          });
        }
      }
    }
    if (!r.between.includes(r.winner)) {
      findings.push({
        level: "error",
        check: "races",
        message: `${at}: winner (${r.winner}) は between のどちらかである必要があります`,
      });
    }
  });

  // 義務: 異actorペアの検出
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
              `${state}: ${a.actor} の ${a.id} と ${b.actor} の ${b.id} が競合し得ます。` +
              `「ほぼ同時に起きたらどちらが勝ち、ユーザーには何が見えるか?」を races に宣言してください`,
          });
        }
      }
    }
  }
  return findings;
}

/** パス妥当性: 各シナリオのイベント列を initial からリプレイできるか */
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
          message: `${sc.id}: path[${i}] のevent が未定義です: ${event}`,
        });
        break;
      }
      const cell = one(model, current, event);
      if (!cell || cell.impossible) {
        findings.push({
          level: "error",
          check: "paths",
          message:
            `${sc.id}: path[${i}] ${event} は ${current} から実行できません` +
            (cell?.impossible ? `(impossible: ${cell.reason})` : "(遷移が未定義)"),
        });
        break;
      }
      current = cell.to!;
    }
  }
  return findings;
}

/** 遷移カバレッジ: 全遷移がいずれかのシナリオに踏まれているか */
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
          `${c.from} × ${c.on} → ${c.to}: どのシナリオにも踏まれていません` +
          `(--suggest-paths でパス案を提案できます)`,
      });
    }
  }
  return findings;
}

/** シナリオが実際に踏むセルの集合(リプレイ結果) */
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

/** 語彙: outcome の observation 参照が definitions レジストリに存在するか */
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
            message: `${at}: observation "${item.observation}" は e2e-definitions.yaml の observations レジストリに存在しません`,
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

/** 全検査の実行 */
// 未回答の仕様質問マーカー。ASSUMPTION 仮置き時に outcome / reason / rules.expected へ
// 「要確認」等を残す規約(usecase-ir.md)を機械可視にする。warn = 承認前に人間が回収する印。
const PENDING_MARKERS = ["要確認", "TODO", "TBD", "FIXME"];

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

/** pending: 未回答の仕様質問マーカー(要確認/TODO/TBD/FIXME)が残っていないか */
export function checkPending(model: Model): Finding[] {
  const findings: Finding[] = [];
  const push = (at: string, marker: string) => {
    findings.push({
      level: "warn",
      check: "pending",
      message: `${at}: 未回答の仕様質問マーカー(${marker})が残っています。PRDオーナーの回答を反映してから承認してください`,
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

// 入力軸の kind 別の既定条件セット。ハッピーパス(有効値)は scenarios が担うため、
// 軸が問うのはエッジ条件のみ。conditions で上書き可能。
export const INPUT_DEFAULT_CONDITIONS: Record<string, string[]> = {
  field: ["未入力", "境界値"],
  option: ["既定", "設定時"],
};

/** input ごとの実効条件セット (conditions ?? kind別既定) */
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
 * inputs: 宣言された入力 × 条件の全セルが covers か na で態度表明されているか。
 * statesなしモードの exhaustiveness 相当 — 未カバーのセルは仕様への質問として報告する。
 */
export function checkInputs(model: Model): Finding[] {
  const inputs = model.ir.inputs ?? [];
  if (inputs.length === 0) return [];
  const findings: Finding[] = [];
  const conds = inputConditions(model);

  // na の条件が宣言済みか
  for (const inp of inputs) {
    for (const cond of Object.keys(inp.na ?? {})) {
      if (!(conds.get(inp.id) ?? []).includes(cond)) {
        findings.push({
          level: "error",
          check: "inputs",
          message: `inputs (${inp.id}): na の条件「${cond}」がこの入力の条件セットに存在しません (条件: ${(conds.get(inp.id) ?? []).join(", ")})`,
        });
      }
    }
  }

  // covers の収集と照合 (typo は宣言との不一致としてエラーになる)
  const covered = new Set<string>();
  const claim = (ref: string, at: string) => {
    const parts = ref.split("×").map((s) => s.trim());
    if (parts.length !== 2 || parts.some((p) => p === "")) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers は「入力ID×条件」形式で指定してください: ${JSON.stringify(ref)}`,
      });
      return;
    }
    const [id, cond] = parts as [string, string];
    if (!conds.has(id)) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers の入力IDが inputs に宣言されていません: ${id}`,
      });
      return;
    }
    if (!conds.get(id)!.includes(cond)) {
      findings.push({
        level: "error",
        check: "inputs",
        message: `${at}: covers の条件「${cond}」が入力「${id}」の条件セットに存在しません (条件: ${conds.get(id)!.join(", ")})`,
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

  // 義務: 全セルが covers か na のどちらかで態度表明されていること
  for (const inp of inputs) {
    for (const cond of conds.get(inp.id) ?? []) {
      const key = `${inp.id}×${cond}`;
      const isNa = inp.na !== undefined && cond in inp.na;
      const isCovered = covered.has(key);
      if (isNa && isCovered) {
        findings.push({
          level: "warn",
          check: "inputs",
          message: `${key}: na 宣言と covers の両方があります (na の理由が古い可能性 — どちらかに揃えてください)`,
        });
      }
      if (!isNa && !isCovered) {
        findings.push({
          level: "error",
          check: "inputs",
          message: `${inp.id} × ${cond}: 未カバーです。「${inp.id}が${cond}のとき何が起きるか?」に答えてください(rules のケース / scenario に covers で紐づけるか、inputs の na で理由を宣言する)`,
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
