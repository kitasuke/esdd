# bindings — locator / literal 契約のフォーマット

bindings は UseCase IR の語彙 (日本語 id) を locator・API 操作・UI 文言に対応させる
**usecase 単位の契約ファイル**。生成される component と生成されるテストの両方が
このファイルだけから語彙を取る。

co-generation は自己整合的 — 誤った binding は誤った実装と誤ったテストを同時に産み、
両者は一致して通ってしまう。だから bindings のレビューが安全網であり、このフォーマットは
checker で機械検査できることを最優先に設計している。

## 検査

```bash
npm run check -- <usecase.yaml> --bindings <bindings.yaml>
```

IR を同時に渡すと literal_coverage の全数突合まで行う (下記)。検査の正は
`src/bindings.ts` (このドキュメントは説明、checker が規範)。

## フォーマット

```yaml
bindings: UC-PROFILE-EMAIL-001 # 対象 usecase id (IR と一致必須)
platform: web                  # v0.1 は web (Playwright/ARIA) プロファイルのみ
graph: account                 # API グラフ名 (platform: web では必須)

events: # IR のイベント語彙 → API 操作 (called_api は operation/kind から機械導出)
  保存する: { operation: UpdateContactEmail, kind: mutation, called_api: calledUpdateContactEmailMutation }

elements: # 日本語 id → locator。addressing form はちょうど1つ
  保存ボタン: { role: button, name: "保存する" } # role は name とセット
  メールアドレス入力: { label: "メールアドレス" }
  一覧コンテナ: { testid: "contact-list" }        # 静的 kebab-case のみ
  補足テキスト: { text: "変更は即時に反映されます" } # role で取れない要素の最終手段

literals: # 承認済み or 提案中の UI 文言。key → text
  保存成功トースト: "メールアドレスを変更しました"

literal_coverage: # IR の rule 全件の態度表明 (全数突合される。literal は literals のキーを指す)
  RULE-001: { literal: 保存成功トースト }
  RULE-002: { ui_text: none, reason: "並び規則 — 文言なし" }
  RULE-003: { literal: 要確認 } # 未決 → pending warn (質問リストで回収)
```

## 検査規則

| check | level | 内容 |
| --- | --- | --- |
| bindings-schema | error | 必須キー (bindings/platform/elements、web は graph)。element は role(+name)/label/testid/text のちょうど1つ。role は許容集合内。testid は静的 kebab-case。未知キーは typo として error |
| bindings-unique | warn | 同じ指し方 (同一 role+name / label / testid / text) の要素が2つ — strict mode violation の予告 |
| bindings-events | error | operation は PascalCase、kind は mutation/query、called_api は `called<Operation><Query\|Mutation>` に機械導出一致 |
| bindings-usecase | error | `bindings:` の id が渡された IR の usecase と一致しない / 対応する IR が入力に無い |
| literal-coverage | error | IR の rule 全件に態度表明 (`literal: <key>` / `ui_text: none`) があること。IR に無い rule id、存在しない literal キーも error |
| pending | warn | literal 値や `literal: 要確認` に 要確認/TODO/TBD/FIXME — 承認前に回収する印 |

## literal_coverage の考え方

states×events の網羅性・inputs の軸マトリクスと同じ哲学:
**宇宙は機械が知っている (IR の rule id 全件)、閉包は人間が表明する、
全数性は checker が強制する**。

- UI 文言を伴う rule → `literal: <key>` (literals に実在すること)
- 文言を伴わない rule (並び規則・サーバー側責務など) → `ui_text: none` + reason
- 文言が未決 → `literal: 要確認` (pending warn = 質問リスト行き)

これにより「rule は文言を要求しているのに bindings に literal が無い」クラスの
契約不整合が、生成時の発見ではなく契約レビュー時の機械指摘になる。

## ライフサイクル

1. IR 承認と同時に bindings をレビューする (受け入れ駆動 — generation.md)
2. `literal: 要確認` の行は質問リストとして仕様オーナーに送る
3. 回答された literal は IR の rules expected に昇格し、bindings は対応表として残る
4. 生成 (component / テスト / セマンティックドライバ) は bindings の語彙だけを使う
   — bindings に無い要素の参照は発明の禁止違反

## platform プロファイルの拡張

addressing form の語彙は platform ごとに差し替えられる設計 (checker の
`ELEMENT_KEYS_BY_PLATFORM`)。モバイルネイティブ等に拡張する場合は、その UI 基盤の
locator 語彙 (例: テストタグ / アクセシビリティ記述 / 宣言的な画面状態) で
プロファイルを追加する。
