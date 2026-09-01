import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runChecks } from "./checks.ts";
import { parseIR } from "./parse.ts";
import { suggestPaths } from "./paths.ts";
import type { Finding } from "./types.ts";

const PILOT = join(
  import.meta.dirname,
  "../examples/order-cancel.usecase.yaml",
);

function check(source: string): Finding[] {
  const { model, findings } = parseIR(source);
  if (!model) return findings;
  return [...findings, ...runChecks(model)];
}

function errorsOf(findings: Finding[], checkName?: string): Finding[] {
  return findings.filter(
    (f) => f.level === "error" && (!checkName || f.check === checkName),
  );
}

const MINIMAL = `
usecase: UC-TEST-001
name: テスト
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
events:
  - { id: go, actor: operator }
transitions:
  - from: A
    on: go
    to: B
    outcome: ["Bになる"]
scenarios:
  - { id: SC-001, name: 正常, path: [go] }
`;

describe("parse + checks", () => {
  it("最小の正しいIRが全検査を通過する", () => {
    expect(check(MINIMAL)).toEqual([]);
  });

  it("実例 (注文キャンセル) が全検査を通過する", () => {
    const findings = check(readFileSync(PILOT, "utf8"));
    expect(errorsOf(findings)).toEqual([]);
    expect(findings.filter((f) => f.level === "warn")).toEqual([]);
  });

  it("網羅性: 未定義セルをエラーにする", () => {
    const src = MINIMAL.replace(
      "events:",
      `events:
  - { id: stop, actor: staff }`,
    );
    const findings = check(src);
    // A × stop が未定義
    expect(errorsOf(findings, "exhaustiveness").length).toBe(1);
    expect(errorsOf(findings, "exhaustiveness")[0]!.message).toContain("A × stop");
  });

  it("決定性: 同一セルへの重複宣言をエラーにする", () => {
    const src = MINIMAL.replace(
      "scenarios:",
      `  - from: A
    on: go
    impossible: true
    reason: 重複テスト
scenarios:`,
    );
    expect(errorsOf(check(src), "determinism").length).toBe(1);
  });

  it("到達性: 到達できないstateをエラーにする", () => {
    const src = MINIMAL.replace(
      "events:",
      `  - { id: ORPHAN }
events:`,
    );
    const findings = check(src);
    expect(errorsOf(findings, "reachability").some((f) => f.message.includes("ORPHAN"))).toBe(
      true,
    );
  });

  it("脱出可能性: 終端に到達できないstateをエラーにする", () => {
    const src = `
usecase: UC-TEST-002
name: 詰みテスト
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: TRAP }
  - { id: B, terminal: true }
events:
  - { id: go, actor: operator }
  - { id: fall, actor: operator }
transitions:
  - { from: A, on: go, to: B, outcome: ["Bになる"] }
  - { from: A, on: fall, to: TRAP, outcome: ["TRAPになる"] }
  - { from: TRAP, on: [go, fall], impossible: true, reason: 出口なし }
scenarios:
  - { id: SC-001, name: 正常, path: [go] }
`;
    const findings = check(src);
    expect(errorsOf(findings, "escapability").some((f) => f.message.includes("TRAP"))).toBe(
      true,
    );
  });

  it("競合宣言: 異なるactorのイベントペアに races 宣言を要求する", () => {
    const src = `
usecase: UC-TEST-003
name: 競合テスト
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
  - { id: C, terminal: true }
events:
  - { id: accept, actor: staff }
  - { id: cancel, actor: operator }
transitions:
  - { from: A, on: accept, to: B, outcome: ["Bになる"] }
  - { from: A, on: cancel, to: C, outcome: ["Cになる"] }
scenarios:
  - { id: SC-001, name: 受注, path: [accept] }
  - { id: SC-002, name: キャンセル, path: [cancel] }
`;
    const findings = check(src);
    expect(errorsOf(findings, "races").length).toBe(1);
    // races を宣言すれば通る
    const declared = src.replace(
      "scenarios:",
      `races:
  - { state: A, between: [accept, cancel], winner: cancel, outcome: ["Cになる"] }
scenarios:`,
    );
    expect(errorsOf(check(declared), "races")).toEqual([]);
  });

  it("パス妥当性: 実行できないパスをエラーにする", () => {
    const src = MINIMAL.replace("path: [go]", "path: [go, go]");
    const findings = check(src);
    expect(errorsOf(findings, "paths").length).toBe(1);
  });

  it("カバレッジ: 踏まれていない遷移をwarnにする", () => {
    const src = `
usecase: UC-TEST-004
name: カバレッジテスト
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B, terminal: true }
  - { id: C, terminal: true }
events:
  - { id: go, actor: operator }
  - { id: alt, actor: operator }
transitions:
  - { from: A, on: go, to: B, outcome: ["Bになる"] }
  - { from: A, on: alt, to: C, outcome: ["Cになる"] }
scenarios:
  - { id: SC-001, name: 正常, path: [go] }
`;
    const findings = check(src);
    const warns = findings.filter((f) => f.level === "warn" && f.check === "coverage");
    expect(warns.length).toBe(1);
    expect(warns[0]!.message).toContain("A × alt");
  });

  it("パス提案: 未カバー遷移を踏むパスを提案する", () => {
    const { model } = parseIR(`
usecase: UC-TEST-005
name: 提案テスト
source: { spec: "https://example.com" }
initial: A
states:
  - { id: A }
  - { id: B }
  - { id: DONE, terminal: true }
events:
  - { id: next, actor: operator }
  - { id: finish, actor: operator }
transitions:
  - { from: A, on: next, to: B, outcome: ["Bになる"] }
  - { from: A, on: finish, impossible: true, reason: Bを経由する必要がある }
  - { from: B, on: next, impossible: true, reason: 一度きり }
  - { from: B, on: finish, to: DONE, outcome: ["完了"] }
scenarios:
  - { id: SC-001, name: 途中まで, path: [next] }
`);
    const paths = suggestPaths(model!);
    // B → finish が未カバー。提案は initial から実行可能な列になっている
    expect(paths.length).toBe(1);
    expect(paths[0]).toEqual(["next", "finish"]);
  });

  it("要確認/TODO マーカーが残っていると pending の warn になる", () => {
    const src = `
usecase: UC-TEST-007
name: 未回答質問テスト
source: { spec: "https://example.com" }
scenarios:
  - id: SC-001
    name: フォーム送信
    given: [フォームを開いている]
    when: [送信する]
    then: [完了画面が表示される]
rules:
  - id: RULE-001
    name: オプションの挙動
    cases:
      - { input: { 通知: true }, expected: "要確認: 通知先が仕様に未記載" }
`;
    const findings = check(src);
    const pending = findings.filter((f) => f.check === "pending");
    expect(pending.length).toBe(1);
    expect(pending[0]!.level).toBe("warn");
    expect(pending[0]!.message).toContain("rules[RULE-001].cases[0]");
  });

  it("マーカーが無ければ pending は出ない", () => {
    const findings = check(readFileSync(PILOT, "utf8"));
    expect(findings.filter((f) => f.check === "pending")).toEqual([]);
  });

  it("inputs: 未カバーのセルは仕様への質問としてエラーになる", () => {
    const src = `
usecase: UC-TEST-008
name: 入力軸テスト
source: { spec: "https://example.com" }
inputs:
  - { id: 顧客, kind: field }
  - { id: 到着通知, kind: option }
scenarios:
  - id: SC-001
    name: 正常系
    given: [フォームを開いている]
    when: [送信する]
    then: [完了する]
rules:
  - id: RULE-001
    name: バリデーション
    cases:
      - { input: { field: 顧客, value: 未入力 }, expected: エラー表示, covers: 顧客×未入力 }
`;
    const findings = check(src);
    const errors = errorsOf(findings, "inputs").map((f) => f.message);
    // 顧客×境界値 / 到着通知×既定 / 到着通知×設定時 の3セルが未カバー
    expect(errors.length).toBe(3);
    expect(errors.some((m) => m.includes("顧客 × 境界値"))).toBe(true);
    expect(errors.some((m) => m.includes("到着通知 × 既定"))).toBe(true);
    expect(errors.some((m) => m.includes("到着通知 × 設定時"))).toBe(true);
  });

  it("inputs: na 宣言と covers で全セルに態度表明すれば通過する", () => {
    const src = `
usecase: UC-TEST-009
name: 入力軸テスト
source: { spec: "https://example.com" }
inputs:
  - id: 顧客
    kind: field
    na:
      境界値: 選択式のため境界値が存在しない
  - id: 到着通知
    kind: option
scenarios:
  - id: SC-001
    name: 正常系
    given: [フォームを開いている]
    when: [送信する]
    then: [完了する]
    covers: [到着通知×既定]
rules:
  - id: RULE-001
    name: バリデーション
    cases:
      - { input: { field: 顧客, value: 未入力 }, expected: エラー表示, covers: 顧客×未入力 }
      - { input: { option: 到着通知, value: true }, expected: 通知される, covers: 到着通知×設定時 }
`;
    const findings = check(src);
    expect(errorsOf(findings, "inputs")).toEqual([]);
  });

  it("inputs: covers の入力ID・条件の typo はエラーになる", () => {
    const src = `
usecase: UC-TEST-010
name: 入力軸テスト
source: { spec: "https://example.com" }
inputs:
  - { id: 顧客, kind: field }
scenarios:
  - id: SC-001
    name: 正常系
    given: [フォームを開いている]
    when: [送信する]
    then: [完了する]
rules:
  - id: RULE-001
    name: バリデーション
    cases:
      - { input: {}, expected: エラー表示, covers: 顧客×末入力 }
      - { input: {}, expected: エラー表示, covers: 客×未入力 }
`;
    const errors = errorsOf(check(src), "inputs").map((f) => f.message);
    expect(errors.some((m) => m.includes("条件「末入力」"))).toBe(true);
    expect(errors.some((m) => m.includes("入力IDが inputs に宣言されていません: 客"))).toBe(true);
  });

  it("状態機械なしのユースケースは given/when/then を要求する", () => {
    const src = `
usecase: UC-TEST-006
name: フォームテスト
source: { spec: "https://example.com" }
scenarios:
  - { id: SC-001, name: 成功 }
`;
    const findings = check(src);
    expect(errorsOf(findings, "structure").some((f) => f.message.includes("given"))).toBe(
      true,
    );
  });
});
