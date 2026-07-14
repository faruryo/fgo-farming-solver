## Why

デイリーミッションの通知窓 [00:59, 03:59 JST) は全域が深夜帯にあり、notification-window-until-deadline の窓拡張後の初配信は 2:05 JST だった（ユーザー報告で「よろしくない」と確認済み）。就寝前の23時頃に受け取れるべきである。

## What Changes

- **デイリー閾値の変更**: `THRESHOLD_MS.daily` を3時間から5時間に変更し、通知開始を 00:59 JST から **22:59 JST**（前日夜）へ移す。配信は22:59以降の最初のバッチ実行で行われるため、実測の実行間隔（1〜3.5h）では概ね 23:00〜1:00 頃の配信になる。
- ウィークリー（開始 11:59 JST 日曜）・イベント・カスタム（24h前）は変更しない。

## Capabilities

### New Capabilities

*(なし)*

### Modified Capabilities

- `todo-notifications`: 「期限間近のプッシュ通知」要件のデイリー閾値を5時間（通知開始 毎日午後10:59 JST）に変更。

## Impact

- `scripts/send-todo-notifications.ts` の `THRESHOLD_MS.daily` のみ。
- アーカイブ順: push-settings-isolation → notification-window-until-deadline → 本 change（同一要件を段階的に MODIFIED しているため）。
