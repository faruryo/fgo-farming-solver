## 1. Dispatcher Window Expansion (send-todo-notifications)

- [x] 1.1 `scripts/send-todo-notifications.ts` の `isDueForNotification` を `now >= dueAt && now < dueAt + ONE_HOUR_MS` から `now >= dueAt && now < deadlineMs` に変更する。未使用になる場合は `ONE_HOUR_MS` を削除し、ワンショット窓前提のコメント（ヘッダの毎時実行前提の記述含む）を更新する。
- [x] 1.2 通知タイトルを非定量文言に変更する（デイリー「デイリーミッションの期限が近づいています！」、ウィークリー「ウィークリーミッションの期限が近づいています！」、イベント「[イベント名] の交換期限が近づいています！」、カスタム「[タスク名] の期限が近づいています！」）。

## 2. Verification

- [x] 2.1 `isDueForNotification`（必要なら `buildCandidates` も）を export してテスト可能にし、`scripts/send-todo-notifications.dedup.test.ts` または新規テストで「窓開始から1時間経過後・期限前 → 送信」「期限超過 → 送信しない」「窓開始前 → 送信しない」を追加する。`pnpm run type-check` と `pnpm test` が通ることを確認する。
- [ ] 2.2 デプロイ後、次回バッチ実行のログで、窓内の未送信タスクが配信されること（または対象なしで正常終了すること）を確認する。

## 3. Change Ordering Note

- [ ] 3.1 アーカイブは push-settings-isolation → 本 change の順で行う（両方が todo-notifications の同一要件を MODIFIED しており、本 change のデルタは isolation 適用後の文面を前提に書かれているため）。
