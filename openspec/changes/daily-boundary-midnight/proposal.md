## Why

デイリーミッションの日界をアプリは 4:00 JST（期限 3:59）でモデル化しているが、実ゲームの開始・締切は 0:00 JST である（ユーザー確認済み）。このずれにより、(1) 0時以降に届くデイリー通知が実締切後で手遅れになる、(2) 0:00〜3:59 の間アプリが前日のデイリーを表示し続ける、(3) 同時間帯の day key が実日付−1 になる。

## What Changes

- **日界の修正**: デイリーの期間境界を 4:00 JST から **0:00 JST** に変更（`lib/todo/period.ts` の `DAILY_RESET_OFFSET_MS` 4h→0）。期限は 23:59 JST になる。
- **通知閾値の再調整**: 期限が 23:59 になるため、`THRESHOLD_MS.daily` を 5h から **2h** に変更（通知開始 21:59 JST、配信は概ね 22:00〜23:30。ユーザー選択: 取りこぼし小リスクと引き換えに23時希望へ最接近）。
- ウィークリー（月曜 0:00 リセット）は変更なし。

## Capabilities

### New Capabilities

*(なし)*

### Modified Capabilities

- `todo-notifications`: 「自動 TODO 追加」のデイリー期限を 23:59 JST・日付基準を 0:00 に修正。「期限間近のプッシュ通知」のデイリー閾値を2時間（通知開始 21:59 JST）に変更。

## Impact

- `lib/todo/period.ts`（境界定数とコメント）、`scripts/send-todo-notifications.ts`（閾値）、`lib/todo/period.test.ts` 等の境界テスト。
- **挙動変化**: 0:00〜3:59 JST の間、新しい日のデイリータスクが即座に生成されるようになる（従来は 4:00 まで前日扱い）。既存の `daily-YYYYMMDD` ID 体系は不変で、同時間帯の day key のみ+1日ずれる。完了済みの旧 ID はそのまま残り無害。
- アーカイブ順: push-settings-isolation → notification-window-until-deadline → daily-notification-evening-threshold → 本 change。
