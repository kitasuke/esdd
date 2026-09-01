# UseCase IR — フォーマット

UseCase IR は仕様 (PRD など) から変換した**振る舞いの単一ソース**。下流 (テスト生成・
実装生成・テスト計画) はすべてこの IR を読む。IR に無い振る舞いを下流が発明することは
禁止 — 仕様に無い決定は質問リストに載せ、回答を IR に反映してから生成する。

検査の正は `src/` の checker (このドキュメントは説明)。

## 2 つの記述モード

| モード | 使いどころ | 網羅性エンジン |
| --- | --- | --- |
| **states モード** | 対象が状態機械 (注文・申請・セッションなど遷移するもの) | states × events の全セル |
| **フォームモード** (states なし) | 対象が入力と保存 (設定画面・登録フォーム) | inputs × 条件の全セル |

## 共通ヘッダ

```yaml
usecase: UC-ORDER-CANCEL-001   # UC- で始まる ID
name: 注文のキャンセル
source:
  spec: "https://…"            # 仕様へのリンク (必須)
  version: "v1"                # 仕様の版 (任意 — drift 追跡に使う)
```

## states モード

```yaml
initial: PLACED
states:
  - { id: PLACED, label: 注文受付済み }
  - { id: COMPLETED, label: 配達完了, terminal: true }
events:
  - { id: cancel, label: キャンセルする, actor: customer } # actor は自由語彙
transitions:
  - from: PLACED
    on: cancel
    to: CANCELED
    outcome: ["「キャンセル済み」と表示される"]   # 観測可能な結果 (literal で書く)
  - from: PLACED
    on: [hand_over, complete]       # from/on は配列でまとめ宣言できる
    impossible: true
    reason: "梱包前は引き渡しに到達しない"        # impossible には理由が必須
races:
  - state: PLACED
    between: [pack, cancel]         # 異なる actor のイベント対
    winner: cancel
    outcome: ["先に確定した操作が勝つ"]
```

checker の検査: 網羅性 (全セル宣言) / 決定性 (重複なし) / 到達性 / 脱出可能性 /
競合宣言の義務 / パス妥当性 / 遷移カバレッジ。`--suggest-paths` は未カバー遷移を
踏むシナリオパスを提案する。

## inputs (入力軸マトリクス — 両モードで使用可)

states の無い対象 (フォーム) にも網羅の宇宙を与える仕組み。宣言した入力 × 条件の
全セルについて、`covers` (どこかのシナリオ / rule ケースが踏む) か `na` (成立しない
理由) の態度表明が義務になる。

```yaml
inputs:
  - id: メールアドレス
    kind: field        # field の既定条件: 未入力 / 境界値
  - id: お知らせメールを受け取る
    kind: option       # option の既定条件: 既定 / 設定時
  - id: 郵便番号
    kind: field
    conditions: [未入力, 形式不正, 境界値]   # 条件は上書きできる
    na: { 境界値: "固定 7 桁で境界が存在しない" }
```

シナリオ / rule ケース側で `covers: "メールアドレス×未入力"` のように踏んだセルを宣言する。

## scenarios / rules

```yaml
scenarios:
  - id: SC-001
    name: 注文が配達完了まで進む
    critical: true              # E2E 化する最重要パスの印
    path: [pack, hand_over, complete]  # states モード: initial からのイベント列
    given: ["支払い済みの注文が1件ある"]
    when: ["…"]
    then: ["…"]                 # 観測可能な結果のみ。literal で書く
rules:
  - id: RULE-001
    name: キャンセル料
    cases:
      - { input: "梱包前のキャンセル", expected: "キャンセル料 0 円" }
```

- **expected / then / outcome は literal で書く** — 「適切なエラーを表示」は禁止。
  文言が仕様に無ければ `要確認` を残して質問リストへ
- `要確認` / `TODO` / `TBD` / `FIXME` は checker が pending warn として追跡する。
  warn ゼロ = 質問がすべて回答済み、が承認条件

## ASSUMPTION と質問リスト

仕様が沈黙している決定は、勝手に埋めずに 2 択:

1. 暫定値で進める必要があるなら `ASSUMPTION(Q1: …)` を reason / expected に刻む
2. 進められないなら `要確認` を刻む (pending warn)

どちらも仕様オーナーへの質問リストの行になり、回答が IR に反映された時点で消える。
**checker の warn が質問リストそのもの**である状態を保つ。

## 検査コマンド

```bash
npm run check -- <ir.yaml> [--suggest-paths] [--bindings <bindings.yaml>] [--json] [--strict]
```

- 終了コード: 0 = エラーなし / 1 = エラーあり (`--strict` では warn も) / 2 = 入力不正
- `--definitions <registry.yaml>`: outcome の `observation:` 名を語彙レジストリ
  (`observations.<name>.keys.<key>` 形式の YAML) と突合する (任意)
