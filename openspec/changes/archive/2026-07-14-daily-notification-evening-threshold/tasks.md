## 1. Threshold Change

- [x] 1.1 `scripts/send-todo-notifications.ts` の `THRESHOLD_MS.daily` を `3 * 60 * 60 * 1000` から `5 * 60 * 60 * 1000` に変更する（通知開始 22:59 JST）。
- [x] 1.2 `pnpm run type-check` と `pnpm test` が通ることを確認する（デイリー閾値3hに依存するテストがあれば5hに更新する）。

## 2. Verification

- [x] 2.1 デプロイ後、22:59 JST 以降の最初のバッチ実行ログで当日のデイリー通知（daily-YYYYMMDD）が送信されることを確認する。（daily-boundary-midnight で開始が 21:59 JST に変更されたため本項の検証は同 change の 2.1 に引き継ぎ）

## 3. Change Ordering Note

- [x] 3.1 アーカイブは push-settings-isolation → notification-window-until-deadline → 本 change の順で行う。
