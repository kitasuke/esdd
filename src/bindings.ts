// ESDD bindings (locator/literal 契約) のパースと検査。
// フォーマット仕様: docs/qa/esdd/bindings.md
//
// bindings は「生成される component と生成されるテストの両方が読む単一のソース」
// (frontend-generation.md「Locator 契約」)。co-generation は自己整合的
// (誤った binding は誤った実装と誤ったテストを同時に産み、両者は一致して通る) なので、
// この検査が契約レビューの機械側の安全網になる。

import { parse as parseYaml } from "yaml";
import type { Finding, Model } from "./types.ts";

/** 要素の指し方。ちょうど1つの addressing form を持つ (playwright-ir.md の locator 優先度) */
export interface ElementBinding {
  role?: string;
  name?: string;
  label?: string;
  testid?: string;
  /** 最終手段の可視テキスト */
  text?: string;
  /** 任意の補足 (検査対象外) */
  note?: string;
}

export interface EventBinding {
  operation?: string;
  kind?: "mutation" | "query";
  called_api?: string;
}

/** rule id ごとの literal 態度表明。literal_coverage の値 */
export type LiteralCoverageEntry =
  | { literal: string; ui_text?: undefined; reason?: string }
  | { ui_text: "none"; literal?: undefined; reason?: string };

export interface BindingsDoc {
  bindings: string;
  platform: string;
  graph?: string;
  events?: Record<string, EventBinding>;
  elements: Record<string, ElementBinding>;
  literals?: Record<string, string>;
  literal_coverage?: Record<string, LiteralCoverageEntry>;
}

// platform プロファイルは拡張点 — v0.1 は web (Playwright/ARIA) のみ
const PLATFORMS = new Set(["web"]);

// 実 UI で使う ARIA ロールの許容集合。プロジェクトのロール対応表と同期して育てる。
// ここに無いロールは typo か許容集合の未登録 — どちらも先に直す。
const ALLOWED_ROLES = new Set([
  "button",
  "link",
  "textbox",
  "checkbox",
  "radio",
  "combobox",
  "listbox",
  "option",
  "menu",
  "menuitem",
  "dialog",
  "heading",
  "tab",
  "tabpanel",
  "row",
  "rowheader",
  "gridcell",
  "columnheader",
  "table",
  "grid",
  "list",
  "listitem",
  "spinbutton",
  "switch",
  "group",
  "region",
  "alert",
  "alertdialog",
  "slider",
  "status",
]);

const ELEMENT_KEYS_BY_PLATFORM: Record<string, Set<string>> = {
  web: new Set(["role", "name", "label", "testid", "text", "note"]),
};
const CALLED_API_PATTERN = /^called[A-Z][A-Za-z0-9]*(Query|Mutation)$/;
const PENDING_MARKERS = ["要確認", "TODO", "TBD", "FIXME"];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function findPendingMarker(text: string): string | undefined {
  return PENDING_MARKERS.find((m) => text.includes(m));
}

/** YAML を BindingsDoc に整形する。構造エラーは findings に積み、doc は best-effort で返す */
export function parseBindings(source: string): {
  doc: BindingsDoc | undefined;
  findings: Finding[];
} {
  const findings: Finding[] = [];
  let raw: unknown;
  try {
    raw = parseYaml(source);
  } catch (e) {
    return {
      doc: undefined,
      findings: [
        {
          level: "error",
          check: "bindings-schema",
          message: `YAML をパースできません: ${(e as Error).message}`,
        },
      ],
    };
  }
  if (!isRecord(raw)) {
    return {
      doc: undefined,
      findings: [
        {
          level: "error",
          check: "bindings-schema",
          message: "トップレベルはマップである必要があります",
        },
      ],
    };
  }
  for (const key of ["bindings", "platform", "elements"]) {
    if (!(key in raw)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `必須キー ${key} がありません`,
      });
    }
  }
  if (findings.some((f) => f.level === "error")) {
    return { doc: undefined, findings };
  }
  const doc = raw as unknown as BindingsDoc;
  if (typeof doc.bindings !== "string" || doc.bindings === "") {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "bindings は対象 usecase id の文字列である必要があります",
    });
  }
  if (!PLATFORMS.has(doc.platform)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: `platform は ${[...PLATFORMS].join(" | ")} のいずれかです: ${String(doc.platform)}`,
    });
  }
  if (doc.platform === "web" && !doc.graph) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "platform: web では graph が必須です",
    });
  }
  if (!isRecord(doc.elements)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "elements はマップである必要があります",
    });
    return { doc: undefined, findings };
  }
  return { doc, findings };
}

/** 要素エントリの addressing form 検査 (platform ごとに許容 form が異なる) */
function checkElements(doc: BindingsDoc, findings: Finding[]): void {
  const allowedKeys =
    ELEMENT_KEYS_BY_PLATFORM[doc.platform] ?? ELEMENT_KEYS_BY_PLATFORM["web"]!;
  const formKeys = [...allowedKeys].filter((k) => k !== "note" && k !== "name");
  const seenIdentity = new Map<string, string>();
  for (const [id, entry] of Object.entries(doc.elements)) {
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: マップである必要があります`,
      });
      continue;
    }
    const unknown = Object.keys(entry).filter((k) => !allowedKeys.has(k));
    if (unknown.length > 0) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: 不明なキー ${unknown.join(", ")} (platform: ${doc.platform} の許容: ${[...allowedKeys].join(", ")})`,
      });
    }
    const e = entry as ElementBinding;
    const forms = formKeys.filter(
      (k) => (entry as Record<string, unknown>)[k] !== undefined,
    );
    if (forms.length !== 1) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: addressing form (${formKeys.join("/")}) はちょうど1つ必要です (現在: ${forms.length === 0 ? "なし" : forms.join("+")})`,
      });
      continue;
    }
    if (e.name !== undefined && e.role === undefined) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: name は role とセットでのみ使えます`,
      });
    }
    if (e.role !== undefined) {
      if (!ALLOWED_ROLES.has(e.role)) {
        findings.push({
          level: "error",
          check: "bindings-schema",
          message: `elements.${id}: 未知のロール ${e.role} (playwright-ir.md のロール対応表を確認)`,
        });
      }
      if (e.name === undefined) {
        findings.push({
          level: "warn",
          check: "bindings-schema",
          message: `elements.${id}: role に name がありません (無名ロールは strict mode で壊れやすい)`,
        });
      }
    }
    if (e.testid !== undefined && !/^[a-z][a-z0-9-]*$/.test(e.testid)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `elements.${id}: testid は静的な kebab-case 英語です: ${e.testid}`,
      });
    }
    // アクセシブルな同一性の重複 = strict mode violation の予告
    const formKey = forms[0]!;
    const identity =
      formKey === "role"
        ? `role:${e.role}:${e.name ?? ""}`
        : `${formKey}:${String((entry as Record<string, unknown>)[formKey])}`;
    const prev = seenIdentity.get(identity);
    if (prev !== undefined) {
      findings.push({
        level: "warn",
        check: "bindings-unique",
        message: `elements.${id} と elements.${prev} が同じ指し方 (${identity}) — strict mode violation の予告`,
      });
    } else {
      seenIdentity.set(identity, id);
    }
  }
}

/** events の operation / called_api 命名検査 (fake-client 命名パターン) */
function checkEvents(doc: BindingsDoc, findings: Finding[]): void {
  if (!doc.events) return;
  if (!isRecord(doc.events)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "events はマップである必要があります",
    });
    return;
  }
  for (const [id, entry] of Object.entries(doc.events)) {
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `events.${id}: マップである必要があります`,
      });
      continue;
    }
    const e = entry as unknown as EventBinding;
    if (typeof e.operation !== "string" || !/^[A-Z][A-Za-z0-9]*$/.test(e.operation)) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: operation は PascalCase の操作名です: ${String(e.operation)}`,
      });
      continue;
    }
    if (e.kind !== "mutation" && e.kind !== "query") {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: kind は mutation | query です: ${String(e.kind)}`,
      });
      continue;
    }
    if (typeof e.called_api !== "string" || !CALLED_API_PATTERN.test(e.called_api)) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: called_api は called<Operation><Query|Mutation> 形式です: ${String(e.called_api)}`,
      });
      continue;
    }
    const expected = `called${e.operation}${e.kind === "mutation" ? "Mutation" : "Query"}`;
    if (e.called_api !== expected) {
      findings.push({
        level: "error",
        check: "bindings-events",
        message: `events.${id}: called_api は ${expected} であるべきです (operation/kind から機械導出): ${e.called_api}`,
      });
    }
  }
}

/** literals の pending マーカー検査 */
function checkLiterals(doc: BindingsDoc, findings: Finding[]): void {
  if (!doc.literals) return;
  if (!isRecord(doc.literals)) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "literals はマップ (key → 文言) である必要があります",
    });
    return;
  }
  for (const [key, value] of Object.entries(doc.literals)) {
    if (typeof value !== "string") {
      findings.push({
        level: "error",
        check: "bindings-schema",
        message: `literals.${key}: 文字列である必要があります`,
      });
      continue;
    }
    const m = findPendingMarker(value);
    if (m) {
      findings.push({
        level: "warn",
        check: "pending",
        message: `literals.${key}: 「${m}」が残っています (承認前に回収)`,
      });
    }
  }
}

/**
 * literal_coverage の全数検査 (IR とのクロスチェック)。
 * 宇宙 = IR の rule id 全件 (機械既知)。閉包 = 人間の態度表明
 * (literal 指定 | ui_text: none | literal: 要確認)。states×events の網羅性と同じ哲学。
 */
function checkLiteralCoverage(
  doc: BindingsDoc,
  model: Model,
  findings: Finding[],
): void {
  const ruleIds = new Set((model.ir.rules ?? []).map((r) => r.id));
  const coverage = doc.literal_coverage ?? {};
  if (ruleIds.size === 0) return;
  for (const id of ruleIds) {
    if (!(id in coverage)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `rule ${id} の literal 態度表明がありません (literal: <key> | literal: 要確認 | ui_text: none)`,
      });
    }
  }
  for (const [id, entry] of Object.entries(coverage)) {
    if (!ruleIds.has(id)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: IR に存在しない rule id です (typo か IR 側の削除漏れ)`,
      });
      continue;
    }
    if (!isRecord(entry)) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: マップである必要があります`,
      });
      continue;
    }
    const hasLiteral = typeof entry.literal === "string";
    const isNone = entry.ui_text === "none";
    if (hasLiteral === isNone) {
      findings.push({
        level: "error",
        check: "literal-coverage",
        message: `literal_coverage.${id}: literal: <key> か ui_text: none のちょうど一方を書きます`,
      });
      continue;
    }
    if (hasLiteral) {
      const key = entry.literal as string;
      if (key === "要確認") {
        findings.push({
          level: "warn",
          check: "pending",
          message: `literal_coverage.${id}: literal 未決 (要確認) — 質問リストで回収`,
        });
      } else if (!(doc.literals && key in doc.literals)) {
        findings.push({
          level: "error",
          check: "literal-coverage",
          message: `literal_coverage.${id}: literals.${key} が存在しません`,
        });
      }
    }
  }
}

export interface BindingsCheckOptions {
  /** クロスチェック対象の IR モデル (省略時は bindings 単体の検査のみ) */
  model?: Model;
}

export function runBindingsChecks(
  doc: BindingsDoc,
  options: BindingsCheckOptions = {},
): Finding[] {
  const findings: Finding[] = [];
  checkElements(doc, findings);
  checkEvents(doc, findings);
  checkLiterals(doc, findings);
  // literal_coverage の型はモデル有無に関わらず検査する (IR なしの単体検査でも壊れ方を隠さない)
  const coverageShapeOk =
    doc.literal_coverage === undefined || isRecord(doc.literal_coverage);
  if (!coverageShapeOk) {
    findings.push({
      level: "error",
      check: "bindings-schema",
      message: "literal_coverage はマップ (rule id → 態度表明) である必要があります",
    });
  }
  if (options.model) {
    if (doc.bindings !== options.model.ir.usecase) {
      findings.push({
        level: "error",
        check: "bindings-usecase",
        message: `bindings の対象 (${doc.bindings}) と IR の usecase (${options.model.ir.usecase}) が一致しません`,
      });
    } else if (coverageShapeOk) {
      checkLiteralCoverage(doc, options.model, findings);
    }
  }
  return findings;
}
