# Proposal: progress-consumption-neutral-reduced-ap

## Why

進捗レポートの tier 判定の主指標 `reducedAp`（目標を現在に固定した再ソルブによる残りAP減少）は、育成で消費した素材をそのままマイナスとして扱う。育成済み分の素材要求は現在目標（`material/result` = 残量）から消える一方、消費で減った現在所持は他サーヴァント分の不足として残りAPを押し上げるため、「周回もして育成もした日」ほど reducedAp が目減りする。実例として、2026年7月の新規サーヴァント（アスカラポス）を入手・育成したユーザーの tier が medium から small に不当に低下した。既存のスループット補完は `reducedAp <= 0` のときしか発動せず、「正だが目減り」するケースを救えない。

## What Changes

- `reducedAp` / `reducedLap` の算出を消費中立にする: 再ソルブ時、アイテムごとに純消費分を現在所持に足し戻す（`adjustedNow[i] = max(現在所持[i], 過去所持[i])`）。これにより reducedAp は「周回獲得で目標に近づいた分」のみを常に非負で測り、育成消費はペナルティにならない（育成の活動量は従来どおりスループット指標で評価される）。
- tier 判定の入口条件を実質変更: reducedAp が常に非負になるため、スループット補完は `reducedAp == 0`（獲得ゼロ）の期間のみ発動する。
- 表示指標「目標への前進」（reducedAp/減少周回/減少費用）も同じ消費中立の値になる。
- 死にコード `sumNewServantOffsetAp`（`lib/progress/tier.ts`）を削除する（旧設計の残骸で未使用）。

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `progress-visualizer`: 「アイテム入手による残り削減（目標への前進）」要件の算出式を消費中立に変更（過去所持を下回った現在所持を過去所持で下限クランプしてから再ソルブ）。tier 判定要件の補完条件の記述を「算出できない、または 0 のとき」に整合させる。

## Impact

- `lib/progress/compute-reduction.ts`: 消費中立の所持調整を追加（`computeReduction` と、`use-progress-report.ts` がインライン再ソルブしている経路の両方）。
- `hooks/use-progress-report.ts`: インライン再ソルブ（`solveTotals` 直呼び）を消費中立の共通関数経由に統一。
- `lib/progress/tier.ts`: 未使用の `sumNewServantOffsetAp` / `NewServantEntry` の整理（`detectNewServants` の戻り値型は維持）。
- `lib/progress/finalize-baseline.ts`: ロジック変更なし（`noReduced` 条件はそのまま機能する）。コメントの実態整合のみ。
- テスト: `compute-reduction.test.ts` に消費混在シナリオを追加。`finalize-baseline.test.ts` / `tier.test.ts` の影響確認。
- UI/API スキーマ変更なし。スナップショット形式・D1 変更なし。
