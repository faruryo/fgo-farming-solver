# Tasks

## 1. 型と整形

- [ ] 1.1 `lib/master-data/types.ts` に、design の決定 1・2 の `EventGift`・`EventPointReward`・`EventMission` と、イベントごとのキー `event_rewards:<id>` の値の型（`pointRewards`・`missions`・`pointItemId?`・`updatedAt`）を足す。`EventPlannerEvent` と `event_data_json` の形は変えない
- [ ] 1.2 `lib/refresh-event-data-compact.ts` の `ItemMap` に品目の種類（Atlas の `type`）を足し（既存テストの ItemMap の fixture も合わせる）、`compactPointRewards`（累計ポイントの昇順、アイテムに名前とアイコン）、`compactMissions`（`dispNo` の順、種類・表示名・報酬・`missionProgressType` が clear の条件の要点と `details` の `missionCondType`・`targetIds`）、`findPointItemId`（種類が `eventPoint` の品目のうち1周あたりの見込みの合計が最大、同じなら ID が小さい、無ければ undefined）、`tryCompact`（例外のとき、または入力のフィールドが無いとき undefined）、取り込んだイベントから bulk put の行（`{ key: "event_rewards:<id>", value }`）を作り、ポイント報酬かミッションが undefined のイベントを入れない関数を、純粋関数として足す。fixture は design の決定 3 の実データの形に沿って手で数件ずつ書き（Atlas は取りに行かない）、並び順・報酬の種類の区別・名前とアイコン・clear 以外の条件が落ちること・details の要点・ポイントの品目が複数と無しのとき・例外の入力とフィールドの無い入力で undefined になること・取れなかったイベントが bulk の行に入らないことを `lib/refresh-event-data-compact.test.ts` でテストする

## 2. スクリプト・ワークフロー・読み手

- [ ] 2.1 `scripts/refresh-event-data.ts` で、取り込むイベントごとに 1.2 の関数でポイント報酬・ミッション・ポイントの品目を作り、環境変数 `EVENT_REWARDS_OUT` があれば、そのパスに bulk put 用のファイル（`[{ key, value }]`）を書く。書くのは `event_data_json` 側の途中終了（変化が無いとき・取り込むイベントが0件のとき）より前にする。位置引数・取り込みの条件（`decideEventImport`）・`event_data_json` の出力は変えない。整形の失敗はログに出してイベントの取り込みを続ける。`AtlasEvent` の型と `validateAtlasEvent` に `rewards`・`missions` を任意として足す（無くても既存のイベントを捨てない）
- [ ] 2.2 `.github/workflows/refresh-event-data.yml` の build ステップに `EVENT_REWARDS_OUT` を渡し、出力ファイルが空でないときだけ `wrangler kv bulk put` する別のステップを足す。`event_data_json` の取得・build の条件・put は変えない（報酬の bulk put は `event_data_json` の取得が error のときも build が走らないので行われない。それ以外では `event_data_json` の put の有無に関係なく行う）
- [ ] 2.3 `lib/get-events.ts` に `getEventRewards(eventId)` を足し、キー `event_rewards:<id>` を読む（無ければ undefined。ローカルでは mock を読む）。一覧・ダッシュボード・通知の読み手は変えない。`mocks/` にイベントごとのキーの小さな例を足し、`getEventRewards` のテスト（あるイベント・無いイベント）を足す

## 3. 品質ゲート

- [ ] 3.1 `pnpm test --run`、`pnpm run lint:ratchet`、`pnpm run type-check` が通ることを確かめる <!-- verify-only -->

## 4. 実データでの確認

- [ ] 4.1 手元でスクリプトを、既存の KV を渡さず、出力と `EVENT_REWARDS_OUT` を worktree の外の一時ファイルにして実行し（Atlas への読み取りの通信だけ。本番の KV には書かない）、bulk put 用の出力に 80627（ポイント報酬180件・ポイントの品目 94160904）と 80632（ミッション100件）の行があること、イベントあたりの値の大きさ、`event_data_json` 用の出力の `events`（`updatedAt` を除く）が同じ日に main で実行したものと同じことを確かめ、結果を実装 PR に載せる <!-- verify-only -->
