import { describe, expect, it } from "vitest";
import { parseBindings, runBindingsChecks } from "./bindings.ts";
import { parseIR } from "./parse.ts";
import type { Finding, Model } from "./types.ts";

function check(source: string, model?: Model): Finding[] {
  const { doc, findings } = parseBindings(source);
  if (!doc) return findings;
  return [...findings, ...runBindingsChecks(doc, { model })];
}

function errorsOf(findings: Finding[], checkName?: string): Finding[] {
  return findings.filter(
    (f) => f.level === "error" && (!checkName || f.check === checkName),
  );
}

function warnsOf(findings: Finding[], checkName?: string): Finding[] {
  return findings.filter(
    (f) => f.level === "warn" && (!checkName || f.check === checkName),
  );
}

const MINIMAL = `
bindings: UC-TEST-001
platform: web
graph: account
events:
  削除を実行する: { operation: DeleteThing, kind: mutation, called_api: calledDeleteThingMutation }
elements:
  削除ボタン: { role: button, name: "削除する" }
  名前入力: { label: "名前" }
  一覧: { testid: "thing-list" }
literals:
  削除成功トースト: "削除しました"
literal_coverage:
  RULE-001: { literal: 削除成功トースト }
  RULE-002: { ui_text: none, reason: "並び順の規則 — 文言なし" }
`;

const IR_FOR_MINIMAL = `
usecase: UC-TEST-001
name: テスト
source: { spec: "test" }
scenarios:
  - id: SC-001
    name: 削除できる
    given: ["対象が1件登録済み"]
    when: ["削除を実行する"]
    then: ["削除される"]
rules:
  - id: RULE-001
    name: 削除成功の通知
    cases:
      - { input: "削除成功", expected: "トーストを表示" }
  - id: RULE-002
    name: 並び順
    cases:
      - { input: "複数件", expected: "作成日時降順" }
`;

function modelOf(source: string): Model {
  const { model } = parseIR(source);
  if (!model) throw new Error("IR がパースできません");
  return model;
}

describe("bindings parse + checks", () => {
  it("最小の正しい bindings が全検査を通過する", () => {
    const findings = check(MINIMAL, modelOf(IR_FOR_MINIMAL));
    expect(findings).toEqual([]);
  });

  it("必須キーの欠落をエラーにする", () => {
    const findings = check("platform: web\nelements: {}\n");
    expect(errorsOf(findings, "bindings-schema").length).toBeGreaterThan(0);
  });

  it("addressing form の重複・欠落をエラーにする", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  二重指定: { role: button, name: "保存", label: "保存" }
  指定なし: { note: "あとで決める" }
`);
    const errors = errorsOf(findings, "bindings-schema");
    expect(errors.some((f) => f.message.includes("二重指定"))).toBe(true);
    expect(errors.some((f) => f.message.includes("指定なし"))).toBe(true);
  });

  it("name 単独 (role なし) をエラーにする", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  変な指定: { name: "保存", testid: "save" }
`);
    expect(
      errorsOf(findings, "bindings-schema").some((f) =>
        f.message.includes("role とセット"),
      ),
    ).toBe(true);
  });

  it("未知のロールと動的 testid をエラーにする", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  ボタン: { role: buton, name: "保存" }
  行: { testid: "row-{id}" }
`);
    const errors = errorsOf(findings, "bindings-schema");
    expect(errors.some((f) => f.message.includes("buton"))).toBe(true);
    expect(errors.some((f) => f.message.includes("kebab-case"))).toBe(true);
  });

  it("同じ指し方の要素を strict mode 予告 warn にする", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  保存A: { role: button, name: "保存" }
  保存B: { role: button, name: "保存" }
`);
    expect(warnsOf(findings, "bindings-unique").length).toBe(1);
  });

  it("called_api の命名不一致をエラーにする (operation/kind から機械導出)", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
events:
  登録する: { operation: CreateThing, kind: mutation, called_api: calledCreateThingQuery }
elements:
  ボタン: { role: button, name: "登録" }
`);
    expect(
      errorsOf(findings, "bindings-events").some((f) =>
        f.message.includes("calledCreateThingMutation"),
      ),
    ).toBe(true);
  });

  it("literal_coverage: IR の rule 全件の態度表明を要求する", () => {
    const withoutRule2 = MINIMAL.replace(
      /  RULE-002: .*\n/,
      "",
    );
    const findings = check(withoutRule2, modelOf(IR_FOR_MINIMAL));
    expect(
      errorsOf(findings, "literal-coverage").some((f) =>
        f.message.includes("RULE-002"),
      ),
    ).toBe(true);
  });

  it("literal_coverage: IR に無い rule id をエラーにする", () => {
    const withExtra = MINIMAL.replace(
      "literal_coverage:",
      "literal_coverage:\n  RULE-999: { ui_text: none }",
    );
    const findings = check(withExtra, modelOf(IR_FOR_MINIMAL));
    expect(
      errorsOf(findings, "literal-coverage").some((f) =>
        f.message.includes("RULE-999"),
      ),
    ).toBe(true);
  });

  it("literal_coverage: 存在しない literal キーをエラーにする", () => {
    const broken = MINIMAL.replace("literal: 削除成功トースト", "literal: 存在しないキー");
    const findings = check(broken, modelOf(IR_FOR_MINIMAL));
    expect(
      errorsOf(findings, "literal-coverage").some((f) =>
        f.message.includes("存在しないキー"),
      ),
    ).toBe(true);
  });

  it("literal: 要確認 と literal 内の要確認 を pending warn にする", () => {
    const pendingCoverage = MINIMAL.replace(
      "literal: 削除成功トースト",
      "literal: 要確認",
    ).replace('削除成功トースト: "削除しました"', '削除成功トースト: "削除しました(要確認: 文言未承認)"');
    const findings = check(pendingCoverage, modelOf(IR_FOR_MINIMAL));
    expect(warnsOf(findings, "pending").length).toBe(2);
    expect(errorsOf(findings).length).toBe(0);
  });

  it("literals / literal_coverage がマップでない場合を schema error にする", () => {
    const brokenLiterals = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  ボタン: { role: button, name: "保存" }
literals: ["削除しました"]
`);
    expect(
      errorsOf(brokenLiterals, "bindings-schema").some((f) =>
        f.message.includes("literals はマップ"),
      ),
    ).toBe(true);
    const brokenCoverage = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  ボタン: { role: button, name: "保存" }
literal_coverage: "RULE-001"
`);
    expect(
      errorsOf(brokenCoverage, "bindings-schema").some((f) =>
        f.message.includes("literal_coverage はマップ"),
      ),
    ).toBe(true);
  });

  it("playwright-ir 対応表のロール (slider/alertdialog) を許容する", () => {
    const findings = check(`
bindings: UC-TEST-001
platform: web
graph: account
elements:
  音量: { role: slider, name: "音量" }
  警告ダイアログ: { role: alertdialog, name: "確認" }
`);
    expect(errorsOf(findings)).toEqual([]);
  });

          it("usecase id の不一致をエラーにする", () => {
    const other = modelOf(IR_FOR_MINIMAL.replace("UC-TEST-001", "UC-OTHER-001"));
    const findings = check(MINIMAL, other);
    expect(errorsOf(findings, "bindings-usecase").length).toBe(1);
  });
});
