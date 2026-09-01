# ESDD — Executable Spec-Driven Development

**ESDD turns a product spec into a machine-checkable intermediate representation (UseCase IR), asks the questions the spec forgot to answer, and generates tests — and eventually implementation — from the same single contract.**

A spec written in prose can silently omit half its own decision space. ESDD makes the omissions mechanical: declare the state machine (or the input axes) of a feature, and the checker enforces exhaustiveness — every state × event cell, every input × condition cell, every race between actors, every rule's UI literal — must be either specified, declared impossible (with a reason), or explicitly flagged as an open question. What survives the check is a contract that both tests and implementation can be generated from, so that when they disagree, the disagreement is a detected spec drift rather than a silent bug.

*Documentation and checker messages are currently in Japanese.*

---

## パイプライン

```
仕様 (PRD など)
   ↓ 変換 + 検査 (このリポジトリの checker)
UseCase IR ……… 振る舞いの単一ソース (states/events/transitions/races/inputs/scenarios/rules)
   +
bindings ……… locator / literal の契約 (UI 語彙の単一ソース)
   ↓ 生成
テストコード / 実装コード / テスト計画・チェックリスト (品質はすべて上流の契約に集約される)
```

設計原則:

- **網羅性は機械が強制する** — 宇宙 (states×events、inputs×条件、rule 全件) は機械が
  知っている。閉包 (各セルの態度表明) は人間が書く。全数性は checker が検査する
- **発明の禁止** — 生成物は IR / bindings に由来しない振る舞い・文言・locator を
  持ってはいけない。仕様に無い決定は生成せず、質問リストに載せる
- **未決は消さずに刻む** — 答えの出ていない仕様質問は `要確認` マーカーで IR に残す。
  checker が warn として追跡し、承認前に回収させる
- **Red は検出器** — 生成テストが実装に対して Red になったら、それは spec と実装の
  drift の検出。どちらが正かは人間が裁定する (テストを黙って Green に直さない)

## クイックスタート

Node.js 22.6+ (TypeScript を直接実行します)。

```bash
npm install   # または pnpm install

# states モードの例: 状態機械の網羅検査 + 未カバー遷移のパス提案
npm run check -- examples/order-cancel.usecase.yaml --suggest-paths

# フォームモード (states なし) + bindings (locator/literal 契約) の突合
npm run check -- examples/contact-email.usecase.yaml --bindings examples/contact-email.bindings.yaml

npm test
```

## checker が検査すること

**UseCase IR** (`docs/usecase-ir.md`):

| 検査 | 内容 |
| --- | --- |
| 網羅性 | 非終端 state × event の全セルが遷移か `impossible: true` + reason で宣言されている |
| 決定性 | 同一セルへの重複宣言がない |
| 到達性 / 脱出可能性 | 初期状態から到達できない state、終端に到達できない state がない |
| 競合宣言 | 同一 state で異なる actor のイベントが両方成立するなら `races` の勝者宣言が必要 |
| パス妥当性 / カバレッジ | シナリオの `path` が実行可能で、全遷移がシナリオに踏まれている |
| 入力軸マトリクス | `inputs` の field/option × 条件の全セルが `covers` か `na` + reason で表明されている |
| pending | `要確認` / `TODO` などの未回答マーカーを warn として追跡する |

**bindings** (`docs/bindings.md`):

| 検査 | 内容 |
| --- | --- |
| スキーマ | 要素は addressing form (role+name / label / testid / text) をちょうど 1 つ持つ |
| 一意性 | 同じ指し方の要素 2 つ = locator 取り違えの予告 warn |
| 命名導出 | イベントの `called_api` は operation/kind から機械導出した名前と一致する |
| literal_coverage | **IR の rule 全件**に文言の態度表明 (`literal: <key>` / `ui_text: none` / `要確認`) がある |

## なぜ literal_coverage か

契約 (bindings) から実装とテストを**同時生成**すると、両者は構成的に一致する —
つまり間違った契約は間違った実装と間違ったテストを産み、両者は一致して通ってしまう。
だから契約レビューが品質の安全網になる。literal_coverage は「rule は UI 文言を
要求しているのに契約に文言が無い」という不整合クラスを、生成後の発見ではなく
契約レビュー時の機械指摘に変える。

## ドキュメント

- [docs/usecase-ir.md](docs/usecase-ir.md) — UseCase IR のフォーマットと記述モード
- [docs/bindings.md](docs/bindings.md) — bindings (locator/literal 契約) のフォーマット
- [docs/generation.md](docs/generation.md) — 生成側の原則 (受け入れ駆動・セマンティック
  ドライバ・パターンレジストリ・生成決定レコード)

## ステータス

v0.1 — IR checker と bindings checker (web/Playwright プロファイル) を含む。
platform プロファイルは拡張点として設計されている (モバイル等は各プロジェクトで
locator 語彙を差し替えて拡張する)。生成器そのものは含まない — 生成は
`docs/generation.md` の原則に従って各プロジェクトの語彙レジストリと共に運用する。

## License

MIT
