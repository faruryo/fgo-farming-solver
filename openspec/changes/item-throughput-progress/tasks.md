## 1. 算出層（純関数）

- [x] 1.1 `lib/progress/throughput.ts` を新規作成。`computeItemThroughput(pastPos, nowPos)` → `{ itemsFarmed, itemsConsumed }`（QP=atlasId `'1'` 除外）と、`classifyTierByThroughput(throughput, elapsedMinutes)` を実装。
- [x] 1.2 `lib/progress/throughput.test.ts` を追加。farm のみ/消費のみ/混在/QP 除外/tier しきい値（none/small/medium/large）を網羅。

## 2. 型・クライアント

- [x] 2.1 `lib/progress/types.ts` の `PeriodSummary` に `itemsFarmed?` / `itemsConsumed?` を追加。
- [x] 2.2 `hooks/use-progress-report.ts` の `enriched` で throughput を算出し、tier を `classifyTierByThroughput` で確定。`reducedAp/Lap/Yen` は従来どおり保持。`zero_progress` は throughput・育成・新規・reducedAp すべて無いときのみ。

## 3. 表示

- [x] 3.1 `components/farming/progress-report-content.tsx` に「獲得素材 +N」「育成投入 N」を表示。見出しを throughput 基準に。`reducedAp` ブロックは `> 0` のときだけ参考表示。
- [x] 3.2 dev モック（`itemsFarmed/itemsConsumed` 未設定）でも表示が壊れないよう `?? 0` ガード。

## 4. spec

- [x] 4.1 `specs/progress-visualizer/spec.md` 差分: tier 駆動をスループットへ変更、reducedAp を副指標化。

## 5. 検証

- [x] 5.1 `pnpm run type-check` / vitest 緑。
- [x] 5.2 `openspec validate item-throughput-progress --strict`。
- [ ] 5.3 デプロイ後、実画面で「育成投入」表示と、育成した日に tier が none でなくなることを確認（[[feedback_verify_before_push]]）。
