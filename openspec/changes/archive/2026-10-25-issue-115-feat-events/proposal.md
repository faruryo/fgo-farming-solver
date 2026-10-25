# Proposal

## Why

イベントページで「このイベントで手に入る素材の総量」（#132）と「育成計画の不足がどれだけ埋まるか」（#133）を出すには、交換所とドロップに加えて、ポイント報酬とミッション報酬が要る。#127 で交換所（素材）と周回クエストのドロップは KV `event_data_json` に入るようになったが、Atlas の `nice_event` にある `rewards`（ポイント報酬）と `missions`（ミッション）は取り込んでいない（issue #115）。

## What Changes

- 取り込むイベント（ロトか交換所があるイベント。#127 の条件のまま）について、ポイント報酬とミッションもコンパクト化し、イベントごとの KV キー `event_rewards:<id>` に保存する（推奨案。`event_data_json` に足すと、一覧・ダッシュボード・イベントページが毎回読む量が増え続けるため。design の決定 1）
  - ポイント報酬: 必要な累計ポイントと、報酬の品目・個数・種類
  - ミッション: 種類、表示名、報酬の品目・個数・種類、達成の条件の要点（条件の種類・対象・必要数と詳細の対象クエスト）
- 報酬の品目は、素材の名前とアイコンを交換所と同じ方法で引く。素材以外（サーヴァント・コマンドコード）は種類を付けて残す
- イベントポイントの品目（Atlas の `eventPoint` 型）を、どの品目がそのイベントのポイントかとして記録する（1周あたりのポイントは、今の `farmingNodes` のドロップに入っている）
- 取れなかった（Atlas の応答に無い、整形に失敗した）イベントはキーを書かず、KV の前の値を残す
- 範囲外: 交換所の素材以外の品目、ポイント報酬かミッションしか無いイベントの取り込み、画面の表示（#132）

## Capabilities

### New Capabilities
（なし）

### Modified Capabilities
- `event-planner`: イベントデータの取り込みに、ポイント報酬・ミッション・イベントポイントの品目を足す

## Impact

- `scripts/refresh-event-data.ts`、`lib/refresh-event-data-compact.ts`（コンパクト化の純粋関数）
- `lib/master-data/types.ts`（ポイント報酬・ミッションの型）、`lib/get-events.ts`（`getEventRewards`）
- `.github/workflows/refresh-event-data.yml`（イベントごとのキーの `wrangler kv bulk put`）
- `mocks/`（イベントごとのキーの例）、ユニットテスト
