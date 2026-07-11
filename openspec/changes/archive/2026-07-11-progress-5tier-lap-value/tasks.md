# Tasks: progress-5tier-lap-value

## 1. 前提整理

- [x] 1.1 実装済みの `progress-consumption-neutral-reduced-ap` をアーカイブして本スペックに delta を同期する（本 change の MODIFIED はその最終状態を上書きする前提）

## 2. 周回換算コア

- [x] 2.1 `lib/progress/lap-value.ts` 新設: 単価解決（`選択クエスト内最高drop_rate`、無ければ全クエスト率へフォールバック）、前進周回（実効目標=`effectiveRequired` 共有・消費クランプ中立）、労力周回（獲得のみ・QP除外）、AP相当（最安AP単価の独立換算）の純関数群
- [x] 2.2 `lib/progress/types.ts`: `ProgressTier` に `legendary` を追加し、網羅性が要る箇所（switch/map）をコンパイルエラーで洗い出して対応
- [x] 2.3 `lib/progress/tier.ts`: `classifyTier` を周/日ベースの5段階（0/>0/≥5/≥15/≥60）に置換。しきい値は定数として一箇所に集約
- [x] 2.4 `lib/progress/finalize-baseline.ts`: 主判定=前進周回、前進0時は労力周回で補完（上限 `large`）、`zero_progress` 判定は従来条件を維持
- [x] 2.5 単体テスト: 単価フォールバック・バッファON/OFF・クランプ中立・5段階しきい値・補完上限
- [x] 2.6 ペルソナ受け入れテスト（design.md のペルソナを1ケース=1テストで固定）: P1新米(低率クエスト・自然APフル→large到達可) / P2ログイン勢(微周回→small) / P3イベント月(実データ相当42周/日→large) / P3ボックス月(60周/日超→legendary) / P4常時りんご勢(→large〜legendary) / P5備蓄王(前進0・労力大→補完でlarge止まり、legendary不可)

## 3. 算出経路の差し替え

- [x] 3.1 `hooks/use-progress-report.ts`: `efficiency/stockBuffer`・`efficiency/stockEnabled`・legacy `efficiency/surplusThreshold` を読み、`resolveStockBuffer` 経由で lap-value 算出に差し替え。LP再ソルブ（`computeReduction`）呼び出しを撤去
- [x] 3.2 `lib/progress/compute-reduction.ts` の削除（他参照が無いことを確認の上、テストごと撤去）
- [x] 3.3 `lib/progress/throughput.ts`: `classifyTierByThroughput`（個数/日）を撤去し、個数集計（itemsFarmed/Consumed）は表示用に維持

## 4. 表示・メッセージ・演出

- [x] 4.1 `components/farming/progress-report-content.tsx`: 「目標への前進 +N周ぶん」（AP相当・費用併記）、「推定活動量 約N周相当」、計算根拠ツールチップの文言更新（i18n: ja/en）
- [x] 4.2 `lib/progress/mashu-messages.ts`: `legendary` メッセージ群の追加、労力修飾（tier≤medium かつ 労力≥large相当）の選択ロジック
- [x] 4.3 `ServantPraise.tsx` / スタイル: `legendary` の特別演出（配色・装飾）を追加
- [x] 4.4 `legendary` の正式名称とセリフトーンをユーザーに確認して確定（→ legendary で確定済み）

## 5. 検証

- [x] 5.1 `pnpm vitest run lib/progress/` と type-check・lint を通す
- [x] 5.2 本番スナップショット相当のフィクスチャで新旧比較（イベント月が large になること、ボックス想定が legendary になること）をテストで固定
- [x] 5.3 ブラウザ実機確認: devモック5段階で small/medium/large/legendary/none + 備蓄王(労力修飾)の表示・演出・i18n を確認済み(legendaryのオレンジ枠+グロー、「+N周ぶん」「推定活動量 約N周相当」を実機検証)
- [x] 5.4 openspec validate
