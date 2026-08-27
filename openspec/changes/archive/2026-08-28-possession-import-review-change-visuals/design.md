## Context

レビューUIは `PossessionImportDialog` の `review` 段階。各行は `currentQuantity → 入力値` を出すが、増減の分類も強調もなく、並びは `mergeCandidates` が `needsReview` を先頭にするだけである。既存仕様の「変動幅が大きい候補を目立たせる」は未実装に近い。

分類と並びは編集中の入力値に依存するため、OCR統合（`mergeCandidates`）ではなくレビュー表示の純関数に置く。確定時の `posession` 書き込みは変えない。

## Goals / Non-Goals

**Goals:**
- 増加・減少・変更なしを、色・左縁・符号の三重エンコードで読み分けられるようにする。
- 要確認を増減より先に固定し、変更なしを既定で畳む。
- 分類・比較・グルーピングをテスト可能な純関数に切り出す。

**Non-Goals:**
- OCR精度・カード検出・矛盾統合ロジックの変更。
- 変更なし行を確定対象から外すこと（値は同じなので上書きしてよい）。
- フィルタ／折りたたみ状態の永続化。
- ユーザー任意のソートキー（名前順ドロップダウン等）。既定並びの改善で足りる。
- 増加・減少行へのクロップボタン追加。クロップは要確認のまま。

## Decisions

### D1: 分類と並びはレビュー表示の純関数に置く

`lib/possession-import/review-presentation.ts` を新設する。

```ts
type QuantityChangeClass = 'increase' | 'decrease' | 'unchanged' | 'unknown'
type ReviewSection = 'needs-review' | 'increase' | 'decrease' | 'unchanged'

classifyQuantityChange(current: number, proposed: number | null): QuantityChangeClass
signedDelta(current: number, proposed: number | null): number | null
reviewSection(candidate, parsedProposed: number | null): ReviewSection
compareReviewRows(a, b): number
```

`proposed` は OCR の `proposedQuantity` ではなく、入力欄を `parsePossessionInput` した値を使う。空・非数値は `unknown`。`reviewSection` は `needsReview || hasConflict || class === 'unknown'` なら `needs-review`、それ以外は増減クラスへ写す。

`mergeCandidates` の `needsReview` 先頭ソートは削除し、統合結果の順序は Atlas ID などで安定させる。表示順は Dialog 側で編集値を渡して決める。

代替: `mergeCandidates` に delta ソートを足す → 編集後に並びが古いままになるので不採用。

### D2: 色だけに頼らない三重エンコード（赤緑は使わない）

色覚多様性と、本アプリで赤=`--destructive`（エラー）である制約を同時に満たす。

| 分類 | 背景 | 左縁 3px | 符号 |
|---|---|---|---|
| 増加 | 青緑の薄塗り | 実線 | `+N` バッジ |
| 減少 | オレンジの薄塗り | 破線 | `-N` バッジ |
| 変更なし | 無彩色・不透明度を下げる | なし | なし |
| 要確認 | 既存の警告黄 | 既存どおり | 数値化できるときだけ `+N`/`-N` |

減少に赤を使わない。所持の減少は失敗ではなく、エラー行と衝突する。トークンは Dialog 内（または `globals.css` の当該クラス）に閉じ、`--destructive` は流用しない。

ダークモードは既存の CSS 変数に合わせ、薄塗りの alpha だけ調整する。

### D3: セクションは排他、変更なしは既定で折りたたむ

グループは相互排他で、要確認の行は増加／減少セクションに出さない。

```
[サマリ] 要確認 2 · 増加 8 · 減少 3 · 変更なし 41
[フィルタ] すべて | 変更あり | 要確認

要確認
増加
減少
変更なし (既定 collapsed、件数は見出しに出す)
```

変更なしを既定で畳むのは、「確認しなくてよい」を操作コストに落とすため。完全非表示にしないのは、OCRが偶然現在値と一致した行を後から開けるようにするため。折りたたみはセッション内のみ。フィルタ「すべて」以外では変更なし見出し自体を出さない。

### D4: フィルタは表示だけ変える

「変更あり」= 要確認 + 増加 + 減少。「要確認」= `needs-review` のみ。隠した行の除外チェックと確定対象は変えない。永続化しない。

代替: 変更なしを確定から外す → 手で直して変更なしになった行が silently drop されるので不採用。

### D5: i18n は新規キーだけ kebab-case

新規文言（サマリ、フィルタ、セクション見出し、`+N` の aria）は `t('kebab-key', '日本語フォールバック')` と `quests` の ja/en。既存の日本語キー（矛盾あり、要確認、反映する 等）は改名しない。

Dialog テストの `t` mock は identity のままなので、フォールバック無しだと生キーでテストが通る。新規は第2引数必須、テストは `t: (key, fallback) => fallback ?? key` に寄せる。

## Risks / Trade-offs

- [Risk] 変更なしを既定で畳むと、一致して見える誤認識を見落とす
  → Mitigation: 件数は常時表示し、展開できる。完全非表示にはしない。
- [Risk] 編集のたびに行が別セクションへ飛び、入力中の行を見失う
  → Mitigation: 分類は `onChange` で更新してよいが、フォーカス中の行はスクロール位置を奪わない。セクション移動は値が確定したあと（blur でも可）にすると実装が楽だが、サマリの即時更新を優先し、フォーカス維持は Dialog 実装時に確認する。
- [Risk] 既存テストが「候補順（101, 202）」のチェック位置に依存している
  → Mitigation: 並び契約を明示したケースを足し、除外テストは名前や atlasId で行を取る。
- [Trade-off] 固定並びのため、名前順で突き合わせたい操作は弱くなる
  → 今回の主目的は確認漏れ防止。名前順は入れない。

## Migration Plan

フロントエンドのみ。保存スキーマも確定 API も変わらない。ロールバックは当該 UI のリバートで足りる。

## Open Questions

なし。フィルタの初期値は「すべて」（変更なし折りたたみ付き）で固定する。
