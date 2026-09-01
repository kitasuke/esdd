// YAMLの読み込みと構造検証、Model(展開済みセル表)の構築。
// 意味検査は checks.ts。ここでは「形」だけを見る。

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
// actor は自由語彙 (例: customer / staff / system)。同一 usecase 内の一貫性はレビューで担保する

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
    err(`YAMLとして解釈できません: ${(e as Error).message}`);
    return { findings };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    err("トップレベルはオブジェクトである必要があります");
    return { findings };
  }
  const ir = raw as UseCaseIR;

  if (!ir.usecase || !USECASE_ID.test(ir.usecase)) {
    err(`usecase は UC- で始まるIDが必須です (例: UC-ORDER-CANCEL-001)`);
  }
  if (!ir.name) err("name は必須です");
  if (!ir.source?.spec) err("source.spec (仕様へのリンク) は必須です");

  const hasStates = Array.isArray(ir.states) && ir.states.length > 0;
  const hasEvents = Array.isArray(ir.events) && ir.events.length > 0;
  const hasTransitions = Array.isArray(ir.transitions) && ir.transitions.length > 0;
  const hasStateMachine = hasStates || hasEvents || hasTransitions;

  if (hasStateMachine && !(hasStates && hasEvents && hasTransitions)) {
    err("states / events / transitions は3つセットで定義してください");
  }
  if (hasStates && !ir.initial) {
    err("statesがある場合、initial (初期状態) は必須です");
  }

  const states = new Map<string, (typeof ir.states extends (infer T)[] | undefined ? T : never)>();
  for (const s of ir.states ?? []) {
    if (!s?.id || !STATE_ID.test(s.id)) {
      err(`state id が不正です: ${JSON.stringify(s?.id)} (大文字スネークケース)`);
      continue;
    }
    if (states.has(s.id)) err(`state id が重複しています: ${s.id}`);
    states.set(s.id, s);
  }
  const events = new Map<string, NonNullable<typeof ir.events>[number]>();
  for (const e of ir.events ?? []) {
    if (!e?.id || !EVENT_ID.test(e.id)) {
      err(`event id が不正です: ${JSON.stringify(e?.id)} (小文字スネークケース)`);
      continue;
    }
    if (events.has(e.id)) err(`event id が重複しています: ${e.id}`);
    if (typeof e.actor !== "string" || e.actor.trim() === "") {
      err(`event ${e.id}: actor は必須です (例: customer / staff / system)`);
    }
    events.set(e.id, e);
  }
  if (ir.initial && hasStates && !states.has(ir.initial)) {
    err(`initial が states に存在しません: ${ir.initial}`);
  }

  // transitions → セル展開
  const cells = new Map<string, Cell[]>();
  (ir.transitions ?? []).forEach((t, i) => {
    const at = `transitions[${i}]`;
    const froms = toArray(t.from);
    const ons = toArray(t.on);
    if (froms.length === 0) err(`${at}: from は必須です`);
    if (ons.length === 0) err(`${at}: on は必須です`);
    if (t.impossible) {
      if (!t.reason) err(`${at}: impossible には reason が必須です`);
      if (t.to || t.outcome) err(`${at}: impossible と to/outcome は同時に指定できません`);
    } else {
      if (!t.to) err(`${at}: to (遷移先) が必要です (不可能なら impossible: true)`);
      if (!t.outcome || t.outcome.length === 0) {
        err(`${at}: outcome (観測可能な期待結果) が必要です`);
      }
    }
    for (const f of froms) {
      if (hasStates && !states.has(f)) err(`${at}: from の state が未定義です: ${f}`);
      for (const o of ons) {
        if (hasEvents && !events.has(o)) err(`${at}: on の event が未定義です: ${o}`);
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
      err(`${at}: to の state が未定義です: ${t.to}`);
    }
  });

  // scenarios
  if (!Array.isArray(ir.scenarios) || ir.scenarios.length === 0) {
    err("scenarios は1件以上必須です");
  } else {
    const seen = new Set<string>();
    ir.scenarios.forEach((sc, i) => {
      const at = `scenarios[${i}]`;
      if (!sc?.id || !SCENARIO_ID.test(sc.id)) {
        err(`${at}: id は SC- で始まるIDが必須です`);
      } else if (seen.has(sc.id)) {
        err(`${at}: scenario id が重複しています: ${sc.id}`);
      } else {
        seen.add(sc.id);
      }
      if (!sc?.name) err(`${at}: name は必須です`);
      if (hasStateMachine) {
        if (!sc?.path || sc.path.length === 0) {
          err(`${at} (${sc?.id}): 状態機械を持つユースケースのシナリオには path が必須です`);
        }
      } else {
        if (!sc?.given?.length || !sc?.when?.length || !sc?.then?.length) {
          err(`${at} (${sc?.id}): given / when / then がすべて必要です`);
        }
      }
    });
  }

  // races (形だけ)
  (ir.races ?? []).forEach((r, i) => {
    const at = `races[${i}]`;
    if (!r?.state) err(`${at}: state は必須です`);
    if (!Array.isArray(r?.between) || r.between.length !== 2) {
      err(`${at}: between はイベント2つの配列が必須です`);
    }
    if (!r?.winner) err(`${at}: winner は必須です`);
    if (!r?.outcome?.length) err(`${at}: outcome は必須です`);
  });

  // rules (形だけ)
  (ir.rules ?? []).forEach((r, i) => {
    const at = `rules[${i}]`;
    if (!r?.id || !RULE_ID.test(r.id)) err(`${at}: id は RULE- で始まるIDが必須です`);
    if (!r?.cases?.length) err(`${at}: cases は1件以上必須です`);
  });

  // inputs (入力軸の宣言。セル網羅の意味検査は checks.ts checkInputs)
  const INPUT_KINDS = new Set(["field", "option"]);
  const inputIds = new Set<string>();
  (ir.inputs ?? []).forEach((inp, i) => {
    const at = `inputs[${i}]`;
    if (!inp?.id || typeof inp.id !== "string" || inp.id.trim() === "") {
      err(`${at}: id は必須です`);
      return;
    }
    if (inp.id.includes("×")) {
      err(`${at}: id に「×」は使えません (covers のセル表記「入力ID×条件」の区切り文字のため)`);
    }
    if (inputIds.has(inp.id)) err(`${at}: input id が重複しています: ${inp.id}`);
    inputIds.add(inp.id);
    if (!inp.kind || !INPUT_KINDS.has(inp.kind)) {
      err(`${at} (${inp.id}): kind は field | option のいずれかが必須です`);
    }
    if (inp.conditions !== undefined) {
      if (!Array.isArray(inp.conditions) || inp.conditions.length === 0) {
        err(`${at} (${inp.id}): conditions は1件以上の配列で指定してください (省略時は kind 別の既定)`);
      } else if (inp.conditions.some((c) => typeof c !== "string" || c.trim() === "")) {
        err(`${at} (${inp.id}): conditions は空でない文字列の配列で指定してください`);
      }
    }
    for (const [cond, reason] of Object.entries(inp.na ?? {})) {
      if (typeof reason !== "string" || reason.trim() === "") {
        err(`${at} (${inp.id}): na の「${cond}」には理由が必須です (impossible の reason と同じ義務)`);
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
