## 1. 選定ロジック

- [x] 1.1 `lib/progress/snapshot.ts`: `selectBaselineRow(rows, nowMs)`(30日前に最も近い行)を実装し、`fetchAllSnapshotsByPeriod` をこれ基準に変更(week/month は null)。
- [x] 1.2 旧 `fetchSnapshotByPeriod` / 未使用 `daysAgo` を削除。
- [x] 1.3 `lib/progress/snapshot.test.ts`: 直近のみ→最古、30日前またぎ→近接、1ヶ月超のみ→近接(最新)、不正日付無視 を検証。

## 2. 表示

- [x] 2.1 `compareLabel` のコメントを単一 baseline(動的 N日前)前提に更新。

## 3. spec

- [x] 3.1 `specs/progress-visualizer/spec.md` 差分: 単一比較の baseline を「約1ヶ月前に最も近いスナップショット」に変更。

## 4. 検証

- [x] 4.1 `pnpm run type-check` / vitest 緑。
- [ ] 4.2 デプロイ後、実画面で baseline が最古(例: 06-02)になり「N日前と比べて」+ 積み上げ進捗が出ることを確認（[[feedback_verify_before_push]]）。
