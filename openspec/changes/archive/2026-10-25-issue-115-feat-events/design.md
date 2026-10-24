# Design

## Context

`scripts/refresh-event-data.ts` は Atlas の `basic_event.json` から eventQuest を選び、イベントごとに `nice_event` を取って、`decideEventImport`（ロトか交換所があれば取り込む。#127）で選んだイベントを、ロト・交換所・周回クエストのドロップにコンパクト化する。結果は既存の KV を第2引数で受け取り、`mergeEvents`（id ごとにエントリーを丸ごと置き換える蓄積マージ）で手元のファイルに書く。KV への put は GitHub Actions（`.github/workflows/refresh-event-data.yml`）が、既存の取得に失敗したら put しない安全策つきで行う。`event_data_json` は `lib/get-events.ts` の `getEvents` がリクエストのたびに丸ごと `JSON.parse` し、`/events`・`/events/[id]`・`/api/dashboard-meta`・通知のスクリプトが読む。Workers の無料プランは CPU 10ms を超えると止まる（スクリプト冒頭のコメント）。`rewards`（ポイント報酬）と `missions`（ミッション）は読んでいない（動機は proposal.md の Why）。

2026-10-19 に Atlas から取った実データ:

| イベント | 会期 | 交換所 | rewards | missions |
|---|---|---|---|---|
| 80627 くたばれ！パンプキンファーム | 2026-09-16〜10-07 | 56 | 180（`groupId` はすべて0。gifts は item 172・servant 5・commandCode 3） | 0 |
| 80632 復刻版:盈月剣風帖 | 2026-10-14〜11-04 | 54 | 0 | 100（`type` はすべて event。gifts は item 88・servant 9・commandCode 3。cond の `condType` は missionConditionDetail 87 など。missionConditionDetail は `details[]` に `missionCondType` と対象クエスト ID を持つ） |

80627 のポイントの品目 94160904（`type: eventPoint`）は、周回クエストのドロップに1回 600〜700 で入っていて、今の `farmingNodes` に取り込まれている。

整形後の大きさの見積もり（名前とアイコンを付けた場合）: 80632 のミッション約65KB、80627 のポイント報酬約29KB。今の `event_data_json` は12件で約268KB（1件あたり約22KB）なので、同じキーに入れると1件あたり数倍になり、蓄積マージで増え続ける。

## Goals / Non-Goals

**Goals:**
- #132（素材の総量）と #133（不足の充足）に要るポイント報酬・ミッション報酬・ポイントの品目を KV に入れる
- C2（#138。普通に周回していれば達成するミッションの見分け）で取り込み直さずに済むよう、ミッションの種類と達成の条件の要点（詳細の対象クエスト ID まで）も入れる
- イベント一覧・ダッシュボード・通知が読む `event_data_json` の大きさを変えない
- 整形の失敗で既存の値を失わない

**Non-Goals:**
- 交換所の素材以外の品目（礼装・サーヴァント・霊衣）。#127・#128 の交換所（素材だけ）と重ねない
- ポイント報酬かミッションしか無い（ロトも交換所も無い）イベントの取り込み。取り込みの条件は archive 前の #127 の change が決めている
- 画面の表示（#132）
- 本番の KV への書き込み。実装の確認は手元のファイルへの出力で行う

## Decisions

### 1. イベントごとの KV キー `event_rewards:<id>` に入れる（推奨。オーナーの判断点）

`kvGetJson` はキーの値を丸ごと `JSON.parse` するので、読む量はキーの大きさで決まる。

| 案 | イベントページが毎回パースする量 | 一覧・ダッシュボード | ワークフロー |
|---|---|---|---|
| A: `event_data_json` の各イベントに足す | 全イベントの報酬込み（蓄積で増え続ける） | 同じく増える。CPU 10ms の制約に近づく | 変えない |
| B: 1つの別キー（`event_rewards_json`）に全イベント分 | `event_data_json` ＋ 全イベントの報酬（蓄積で増え続ける） | 変わらない | 取得・マージ・put を足す |
| C（推奨）: イベントごとのキー | `event_data_json` ＋ そのイベントの報酬だけ（数十KB） | 変わらない | 取り込んだイベントのキーを `wrangler kv bulk put` で書く。取得もマージも要らない |

C を推奨する。値の形は `{ pointRewards: EventPointReward[], missions: EventMission[], pointItemId?: number, updatedAt: number }`。読み手は `lib/get-events.ts` に `getEventRewards(eventId)` を足し、イベントページ（#132 から使う）だけが読む。

### 2. 型

```ts
type EventGift = { objType: string; itemId: number; num: number; name?: string; icon?: string }  // 既存の rareRewards・drops と同じ名前
type EventPointReward = { point: number; gifts: EventGift[] }                                     // point の昇順
type EventMission = {
  id: number; dispNo: number; type: string; name: string; gifts: EventGift[]
  conds: { condType: string; targetIds: number[]; targetNum: number
           details?: { missionCondType: number; targetIds: number[] }[] }[]                    // missionProgressType が clear のものだけ
}
```

開放・開始の条件（`missionProgressType` が open や start）は落とす。`conditionMessage` は表示名と重なるので落とす。ポイント報酬の `groupId` は実データで0だけなので落とす（複数グループのイベントが出たら足す）。

### 3. 整形は純粋関数にし、失敗を「取れなかった」として返す（fixture は手書き）

`lib/refresh-event-data-compact.ts` に `compactPointRewards`・`compactMissions`・`findPointItemId` を足す。`ItemMap` に品目の種類（`type`）を足し、`findPointItemId(farmingNodes, itemMap)` は種類が `eventPoint` の品目のうち、1周あたりの見込みの合計が最大のもの（同じなら ID が小さいもの）を返す。整形を試みて、失敗したら `undefined`（取れなかった）を返す小さな関数（`tryCompact`）も純粋関数にし、例外を投げる入力でテストする。Atlas の応答に `rewards` か `missions` のフィールド自体が無いときも `undefined` とする（Atlas のスキーマの変化で前の値を消さないため）。テストの fixture は、下の実データの形に沿って手で数件ずつ書く（sandbox の中から Atlas を取りに行かない）。

実データの形（2026-10-19 の Atlas の応答から抜粋）:

```json
// nice_event 80627 rewards[0]
{ "groupId": 0, "point": 1000, "gifts": [{ "type": "item", "objectId": 102, "num": 1 }] }
// nice_event 80632 missions[5] の cond（gifts は item 100 など）
{ "missionProgressType": "clear", "condType": "missionConditionDetail", "targetIds": [80632001], "targetNum": 3,
  "details": [{ "missionCondType": 10, "targetIds": [94162800, 94162801, 94162802] }] }
// 80632 missions の開放条件の例
{ "missionProgressType": "open", "condType": "date", "targetIds": [], "targetNum": 1791968400 }
// nice_item 94160904
{ "id": 94160904, "name": "パンプキン収穫ポイント", "type": "eventPoint" }
```

### 4. 取れなかったイベントは書かず、前の値を KV に残す

キーをイベントごとに分けたので、既存の値を取ってマージする必要はない。ポイント報酬かミッションのどちらかが取れなかった（`undefined`）イベントは、bulk put のファイルに入れない。KV の前の値はそのまま残る。どちらも取れたイベント（空配列を含む）だけを書く。

スクリプトは、`event_data_json` 側の途中終了（変化が無いときの `return`、取り込むイベントが0件のときの `return`）より前に、bulk put 用のファイル（`[{ key, value }]`）を書く。出力先は環境変数 `EVENT_REWARDS_OUT` で受け取り、無ければ書かない（位置引数は変えない）。ワークフローは、build ステップでこの環境変数を渡し、ファイルが空でなければ別のステップで `wrangler kv bulk put` する。`event_data_json` の取得・put の手順と条件は変えないので、報酬の処理が失敗しても `event_data_json` は今までどおり進む。

### 5. 確かめ方

純粋関数は、80627 と 80632 の実データから切り出した fixture でテストする。スクリプトは、整形結果を手元のファイル（`event_data_json` 用と、`EVENT_REWARDS_OUT` で指定した bulk put 用）に書くだけで、KV への put はワークフローが行う。手元でスクリプトを実行し（Atlas への読み取りの通信だけ。80627 は終了から30日以内なので取り込み窓に入る）、出力の 80627・80632 の件数と中身、整形後の大きさ、`event_data_json` 側の出力の `events`（`updatedAt` を除く）が同じ日に main で実行したものと変わらないことを確かめる。

## Risks / Trade-offs

- [bulk put だけ失敗する] → `event_data_json` の put とは別のステップなので、`event_data_json` は進む。報酬のキーは前の値のまま残り、次の実行で書き直される
- [キーが増える] → 取り込んだイベントの数だけ（年に数十）。値は1つ数十KB で、KV の無料枠の書き込み回数（1日1,000）にも、1日1回の実行なら収まる
- [ポイント報酬のグループが複数のイベント] → 今の実データでは無い。出てきたら `groupId` を足す

## Open Questions

- 決定 1 で C でよいか（オーナーの判断）。A を選ぶ場合は、仕様の「イベントごとの KV キー」と「イベント一覧は読まない」のシナリオを外し、ワークフローのタスクが要らなくなる
