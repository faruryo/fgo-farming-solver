## 1. Boundary & Threshold Change

- [x] 1.1 `lib/todo/period.ts` の `DAILY_RESET_OFFSET_MS` を `4 * 60 * 60 * 1000` から `0` に変更し、ヘッダコメント（4:00リセット/3:59期限の記述）を 0:00 リセット / 23:59 期限に更新する。
- [x] 1.2 `scripts/send-todo-notifications.ts` の `THRESHOLD_MS.daily` を `5 * 60 * 60 * 1000` から `2 * 60 * 60 * 1000` に変更し、コメント（22:59開始）を 21:59 開始に更新する。
- [x] 1.3 `lib/todo/period.test.ts` 等、4:00 境界に依存するテストを 0:00 境界の期待値に更新する（テストの意図は保つ。0:00〜3:59 JST が「当日」扱いになる境界ケースを明示的に追加）。
- [x] 1.4 `pnpm run type-check` と `pnpm test` が通ることを確認する。

## 2. Verification

- [x] 2.1 デプロイ後、21:59 JST 以降のバッチ実行ログで当日のデイリー通知が送信され、23:59 以降のバッチでは送信されないことを確認する。（2026-07-15 検証完了: 7/15 22:08 JST バッチで daily-20260715 を2購読へ送信(sent=2)、実機受信も確認。失効購読の410掃除(expiredCleaned=1)も同バッチで実証。前夜の 0:15 JST 以降のバッチで翌日分の誤送信なしも notification_log で確認済み）
- [x] 2.2 実機で 0:00〜3:59 JST の間に新しい日のデイリータスクが表示されることを確認する（可能なら）。（2026-07-15 確認: Cloud Save 上に daily-20260715 が新日界の期限 23:59 JST で生成・同期済み。旧日界の daily-20260714(3:59 JST 期限) と並存しており境界切替をデータで確認）

## 3. Change Ordering Note

- [x] 3.1 アーカイブは push-settings-isolation → notification-window-until-deadline → daily-notification-evening-threshold → 本 change の順で行う。
