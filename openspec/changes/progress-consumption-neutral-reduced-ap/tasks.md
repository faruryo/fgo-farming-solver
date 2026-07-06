# Tasks: progress-consumption-neutral-reduced-ap

## 1. 消費中立の reducedAp 算出

- [x] 1.1 `lib/progress/compute-reduction.ts`: アイテムごとの過去所持クランプ（`adjustedNow[i] = max(現在所持[i], 過去所持[i])`）を `computeReduction` に実装する（クランプは need 組み立て前の所持調整として行う）
- [x] 1.2 `lib/progress/compute-reduction.test.ts`: 消費混在シナリオのテストを追加する — (a) 獲得のみ=従来どおり、(b) 獲得+消費で reducedAp が目減りしない、(c) 消費のみで reducedAp=0（負にならない）、(d) 目標増加で増加しない既存不変条件の維持

## 2. 算出経路の一本化

- [x] 2.1 `hooks/use-progress-report.ts`: インライン再ソルブ（`solveTotals`+`buildNeedByApiItemId` 直呼び）を `computeReduction` 呼び出しに置換し、コメント（「>0 の日のみ」「0以下=育成で消費が上回った日」等）を消費中立の実態に合わせて更新する
- [x] 2.2 `lib/progress/finalize-baseline.ts`: ロジックは不変のまま、コメントの「育成で素材消費が上回った・drops 未ロード等」を「獲得ゼロ・drops 未ロード等」に更新する

## 3. 死にコードの削除

- [x] 3.1 `lib/progress/tier.ts`: 未使用の `sumNewServantOffsetAp` を削除する（`detectNewServants`/`NewServantEntry` は summary.ts が使用中のため維持）。`tier.test.ts` の該当テストと、offset 専用になった依存（`RarityApTable` import 等）も合わせて整理する

## 4. 検証

- [x] 4.1 `pnpm vitest run lib/progress/` と type-check を通す
- [x] 4.2 ブラウザ実機確認: ダッシュボードのマシュ進捗パネルで「目標への前進」と tier が表示されること（dev server はユーザー管理・起動しない）。可能なら localStorage の posession を一時的に下げて tier が下がらないことを確認する
- [x] 4.3 openspec validate（delta spec の書式検証）を実行する
