## Context

tier は `classifyTier(reducedAp, elapsed)` で算出され、`reducedAp = solve(目標−過去所持) − solve(目標−現在所持)`（目標固定）。これは「ゴールまでの距離の縮小」を測るため、素材を育成に消費した日は残り必要量が増え `reducedAp ≤ 0` → tier=none となる。ユーザーは「素材の獲得・消費の活動量」を進捗としたい。

実データ（本番 06-03→06-06）:
- 素材 farm（純増）= 57 個
- 素材 消費（純減）= 279 個（★5ウルズ育成）
- QP（atlasId `1`）消費 ≈ 5,156 万（所持は実質カンスト ~1e20）

## Goals / Non-Goals

### Goals
- tier・見出し・メッセージを「素材スループット（farm＋育成投入の個数）」で駆動する。
- 育成に素材を使った日・新規入手鯖を育成した日が tier=none にならない。
- reducedAp は副指標として残し、ゴールへ前進した日のみ表示する。

### Non-Goals
- スナップショット保存スキーマの変更。
- ソルバーロジックの変更（reducedAp の算出方法は不変）。
- AP 重み付けの導入（ユーザー要望どおり「個数」で測る）。

## Decisions

### スループットの定義
`computeItemThroughput(pastPos, nowPos)`:
- 対象キー = `keys(pastPos) ∪ keys(nowPos)`、ただし QP（atlasId `'1'`）を除外。
- 各素材 `delta = now − past`。`delta > 0` を `itemsFarmed` に、`delta < 0` の絶対値を `itemsConsumed` に加算。
- 2スナップショット間では**純差分（net）**しか観測できない（同一素材を farm して消費した gross は復元不可）。net で十分とする。
- `throughput = itemsFarmed + itemsConsumed`。

### QP 除外
- QP（atlasId `'1'`）は所持が ~1e20 で、消費も数千万単位。個数ベースの進捗では他素材を完全に埋もれさせるため除外する。データ上、選択の余地のない前提。
- 実装は除外集合 `EXCLUDED_ATLAS_IDS = new Set(['1'])` とし、将来の拡張に備える。

### tier 判定（スループットベース）
`classifyTierByThroughput(throughput, elapsedMinutes)`:
- `throughput <= 0` → `none`。
- 経過日数 `days = max(1, elapsedMinutes / 1440)` でならし、`perDay = throughput / days`。
- `perDay < 10` → `small`、`< 50` → `medium`、`>= 50` → `large`。
- しきい値は暫定（コメントで「調整可能」と明示）。本番データ 336/3.13日 ≈ 107/日 → `large`。
- 旧 `classifyTier`（reducedAp 用）は削除せず残すが、tier 駆動には用いない。

### reducedAp の扱い（副指標）
- `enriched` は従来どおりソルバー再計算で `reducedAp/Lap/Yen` を算出して保持。
- 表示は `reducedAp > 0` のときのみ「残りAP −○」。`≤ 0` の日は非表示（tier は throughput が決めるので none に引きずられない）。

### 算出場所はクライアント（enriched）
- スループットは `baseline.pastPosession`（サーバが付与済み）＋ localStorage の現在 `posession` から算出でき、ソルバー不要。既存の reducedAp 再計算と同じ `enriched` 内で完結させる。
- サーバ（`/api/progress`）には現在所持を送っていないため、サーバ側算出は採らない（リクエスト拡張を避ける）。

### fallback（zero_progress）
- `throughput == 0 && growthTotal <= 0 && newServantCount === 0 && reducedAp <= 0` のときのみ `zero_progress`。いずれかがあれば実進捗として扱う。

## Risks / Trade-offs

- **net しか測れない**: farm 直後に同素材を消費すると相殺され過小評価。2スナップショット比較の本質的限界として許容。
- **しきい値の妥当性**: 個数ベースの絶対しきい値はゲーム進行度で体感が変わる。暫定値とし、調整余地をコメントで明示。
- **reducedAp と二重表示**: 活動量（throughput）と消化度（reducedAp）が併存し情報量が増えるが、意味が異なるため両立を許容（reducedAp は >0 の日のみ）。

## Migration Plan
1. 純関数 `throughput.ts` ＋テストを追加。
2. `enriched` の tier 駆動を throughput へ。reducedAp は副指標として維持。
3. 表示・メッセージ・spec を更新。
4. type-check / vitest 緑を確認しデプロイ。実画面で「育成投入」表示と tier 上昇を確認。

## Open Questions
- tier しきい値の最終値（暫定値で運用し、実利用の体感で調整）。
