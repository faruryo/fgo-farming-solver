## Why

進捗パネルの tier（達成度）が `reducedAp`（目標までの残りAPの減少量・ソルバー再計算）**だけ**で決まっている。これは「ウィッシュリストの消化度」を測る指標で、以下の不整合を生む:

- 素材を**育成に消費**した日は、残り必要量がむしろ増えて `reducedAp ≤ 0` → tier=none →「今日はゆっくり休んでください」になる。実際にはユーザーは活発に活動している（本番で確認: 06-03→06-06 にユグドラシルの芽39個ほか計279素材を消費して★5ウルズを育成、QPも約5,156万消費）。
- 新規入手サーヴァントの育成は、(a) 過去スナップショットに存在しないため `growthTotal` に構造的にカウントされず、(b) tier にも一切寄与しない。

ユーザーの要望は「育成目標の増減（目標までの距離）ではなく、**アイテムの獲得個数と消費個数だけで進捗を見たい**」。すなわち「ゴールへの距離」ではなく「その期間の素材**活動量（farm ＋ 育成投入）**」を進捗の主役にする。

## What Changes

新指標「**素材スループット**」を導入し、tier・見出し・マシュのメッセージの駆動をこれに置き換える。`reducedAp` は廃止せず、ゴールへ純粋に前進した日の参考副指標として残す（案2）。

- **ADDED**: `lib/progress/throughput.ts` に純関数を追加。
  - `computeItemThroughput(pastPosession, nowPosession)` → `{ itemsFarmed, itemsConsumed }`。所持の増減を素材ごとに集計（正の差＝farm、負の差＝育成投入）。**QP（atlasId `1`）は桁が壊れるため除外**。
  - `classifyTierByThroughput(throughput, elapsedMinutes)` → スループット合計（farm＋投入）を経過日数でならして tier 判定。しきい値は素材個数ベースの暫定値（調整可能）。
- **MODIFIED**: `PeriodSummary` に `itemsFarmed?` / `itemsConsumed?` を追加（`lib/progress/types.ts`）。
- **MODIFIED**: `hooks/use-progress-report.ts` の `enriched` で、baseline の `pastPosession` と localStorage の現在 `posession` からスループットを算出し、tier を `classifyTierByThroughput` で確定。`reducedAp/Lap/Yen` は従来どおり算出して副指標として保持（ソルバー再計算は維持）。`zero_progress` 判定はスループット・育成・新規入手・reducedAp すべてが無いときのみ。
- **MODIFIED**: `components/farming/progress-report-content.tsx` に「獲得素材 +N」「育成投入 N」を表示。`reducedAp` ブロックは `> 0` のときだけ参考表示（≤0 の日は非表示にし tier を引きずらない）。
- **MODIFIED (spec)**: `progress-visualizer` の進捗判定要件を、tier の駆動を素材スループットに変更する旨へ更新。`reducedAp` は副指標として残す。

## Capabilities

### Modified Capabilities
- `progress-visualizer`: 進捗 tier の判定根拠を「目標までの残りAP減少（reducedAp）」から「素材スループット（farm＋育成投入の個数、QP除外）」へ変更。育成・新規入手があった日が tier=none にならないようにする。

## Impact

- **算出層**: 新規 `lib/progress/throughput.ts`（純関数・テスト付き）。
- **クライアント**: `hooks/use-progress-report.ts`（tier 駆動をスループットへ）。
- **UI**: `components/farming/progress-report-content.tsx`（獲得/投入の表示、reducedAp を副指標化）。
- **型**: `lib/progress/types.ts`。
- **後方互換**: `reducedAp` 算出・表示は維持。dev モック（`mocks/progress.json`）は `itemsFarmed/itemsConsumed` 未設定でも表示が壊れないようガード。QP 以外の所持差分のみを進捗に用いるため、所持データが無い初期ユーザーは従来どおりフォールバック表示。
