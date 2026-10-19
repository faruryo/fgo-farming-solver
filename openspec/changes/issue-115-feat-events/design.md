# Design

## Context

`scripts/refresh-event-data.ts` は Atlas の `basic_event.json` から eventQuest を選び、イベントごとに `nice_event` を取って、`decideEventImport`（ロトか交換所があれば取り込む。#127）で選んだイベントを、ロト（`compactLotteries`）・交換所（`compactShop`）・周回クエストのドロップ（`compactFarmingNodes`）にコンパクト化し、KV `event_data_json` に蓄積マージ（`mergeEvents`）で書く。品目の名前とアイコンは `export/JP/nice_item.json` から作る `ItemMap` で引く。`rewards`（ポイント報酬）と `missions`（ミッション）は読んでいない（動機は proposal.md の Why）。

2026-10-19 に Atlas から取った実データ:

| イベント | rewards | missions | 備考 |
|---|---|---|---|
| 80627 くたばれ！パンプキンファーム | 180（`groupId` はすべて0。gifts は item 172・servant 5・commandCode 3。累計ポイントの最大 3,000,000） | 0 | ポイントの品目 94160904（`type: eventPoint`）が、周回クエストのドロップに1回 600〜700 で入っている |
| 80632 復刻版:盈月剣風帖 | 0 | 100（gifts は item 88・servant 9・commandCode 3。`condType` は missionConditionDetail 87・eventMissionAchieve 65・date 63・questClear 43 など） | ロト・ポイント報酬は無い |

## Goals / Non-Goals

**Goals:**
- #132（素材の総量）と #133（不足の充足）に要るポイント報酬とミッション報酬を KV に入れる
- C2（#138。普通に周回していれば達成するミッションの見分け）で取り込み直さずに済むよう、ミッションの達成条件の要点も入れる
- 旧データと、取得の失敗に強くする

**Non-Goals:**
- 交換所の素材以外の品目（礼装・サーヴァント・霊衣）。#127・#128 の交換所（素材だけ）と重ねない。#132 は素材の総量なので要らない
- ポイント報酬かミッションしか無い（ロトも交換所も無い）イベントの取り込み。取り込みの条件は #127 の仕様（archive 前）が決めていて、ここで変えると同じ要件を2つの change が書き換えることになる
- 画面の表示（#132）
- 本番の KV への書き込みの確認。取り込みの結果は、純粋関数のテストと、手元で KV に書かずに整形結果を出して確かめる

## Decisions

### 1. 仕様は ADDED の要件にする

`event-planner` の「イベントデータの取り込み」要件は、archive 前の #127 の change が MODIFIED で書き換えている。同じ要件をこの change でも MODIFIED にすると、archive の順番で片方が消える。そのため、取り込みの条件と既存の内容には触れず、「ポイント報酬とミッションの取り込み」を ADDED で足す。

### 2. 型

`EventPlannerEvent` に任意のフィールドを3つ足す。

```ts
pointRewards?: { point: number; gifts: EventGift[] }[]          // 累計ポイントの昇順
missions?: {
  id: number; dispNo: number; name: string; gifts: EventGift[]
  conds: { condType: string; targetIds: number[]; targetNum: number }[]
}[]                                                                // dispNo の順
pointItemId?: number                                               // eventPoint 型の品目
// EventGift = { type: 'item' | 'servant' | 'commandCode' | string; objectId: number; num: number; name?: string; icon?: string }
```

任意にするのは、旧データ（フィールドの無いエントリー）をそのまま読むため。読み手は `?? []` で空として扱う。ミッションの `conds` は Atlas の `conds` から `condType`・`targetIds`・`targetNum` だけを残す（`conditionMessage` は表示名と重なるので落とす）。ポイント報酬の `groupId` は実データで0だけなので落とす（複数グループのイベントが出たら足す）。

### 3. コンパクト化は純粋関数にし、失敗をイベント単位で閉じ込める

`lib/refresh-event-data-compact.ts` に `compactPointRewards(rewards, itemMap)`・`compactMissions(missions, itemMap)`・`findPointItemId(farmingNodes, itemTypes)` を足す。`ItemMap` に品目の種類（`type`）を足し、`eventPoint` の判定に使う。スクリプトは、ポイント報酬とミッションの整形を try で囲み、失敗したらそのフィールドを空にしてイベントの取り込みは続ける（ロト・交換所・周回クエストの保存を止めない）。

### 4. 確かめ方

純粋関数は、80627 と 80632 の実データから切り出した fixture でテストする。スクリプト全体は、もともと整形結果を手元のファイル（第1引数、既定は `./event_data.json`）に書くだけで、KV への書き込みは別の手順（ワークフロー）が行う。手元でスクリプトを実行し（Atlas への読み取りの通信だけ）、出力ファイルの 80627 と 80632 の件数と中身、整形後のサイズを確かめる。本番の KV には書かない。

## Risks / Trade-offs

- [KV のサイズが増える] → 80632 のミッションは整形前で約187KB、整形後は表示名・報酬・条件の要点だけになる。1イベントあたり数十KB の見込みで、KV の値の上限（25MB）に対して小さい。整形後のサイズを確かめ方で測る
- [ポイント報酬のグループが複数のイベント] → 今の実データでは無い。出てきたら `groupId` を足す
