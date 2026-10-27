# Proposal

## Why

イベントの交換所の画面に、種火・フォウくん（英霊結晶）・礼装が出てこない（#179）。どれもほとんどのイベントで交換する品で、交換に要るイベントアイテムの数と周回数に効く。利用者は全部交換しても、これらの分の対価を自分で足さないと周回数が合わない。

Atlas はこれらの交換を `purchaseType: servant`（サーヴァント扱いの交換）として返し、取り込み（`compactShop`）は `purchaseType: item` の交換だけを取るので、ここで落ちている。#175（PR #188）で「計画の対象外」の品目に「必要／不要」を選べるようになったので、育成計画で扱わないこれらの品も同じ枠で扱える。

## What Changes

- 取り込みで、`purchaseType` が `servant` で対価がイベントアイテムの交換も交換所のデータに入れる。品目がサーヴァント扱い（種火・フォウくん・礼装・宝具強化専用のサーヴァントなど）であることを区別できる形で保存し、名前・レア度・アイコンを付ける
- 交換所の一覧に、これらの品目をアイテムの品目と同じ行で並べる。交換回数・全部交換・必要量・周回の内訳・AP 予算の計算に入れる
- これらの品目は育成計画で扱わないので「計画の対象外」とし、「必要／不要」を選べるようにする。選択はアイテムの品目と取り違えないよう、サーヴァント扱いの品目どうしで保存する
- コマンドコード（`purchaseType: commandCode`）・霊衣開放権（`costumeRelease`）は今回も取り込まない

## Capabilities

### New Capabilities

- `event-shop-servant-exchange`: イベントの交換所に、サーヴァント扱いの交換（種火・フォウくん・礼装など）を取り込んで並べ、交換回数と周回の計算に入れ、計画の対象外として必要／不要を選べるようにする

### Modified Capabilities

なし（`event-planner` の「イベントデータの取り込み」は未 archive の `issue-127-bug-events` が delta を持つため変更せず、交換所の取り込みの追加分はこの新しい capability に書く。`event-shop-roster-need`・`event-shop-efficiency` の要件はそのまま当てはまり、変えない）

## Impact

- `lib/refresh-event-data-compact.ts`（`compactShop`）と `scripts/refresh-event-data.ts`: サーヴァント扱いの交換の取り込み、対象のサーヴァント／礼装の名前・レア度・アイコンの取得
- `lib/master-data/types.ts`（`EventShopItem`）: 品目の種類を表す任意のフィールドを足す。古い KV データ（フィールドが無い）はアイテムの品目として読む
- `lib/event-shop-summary.ts`・`components/events/EventShopList.tsx`: サーヴァント扱いの品目の表示と、計画の対象外の判定、必要／不要の保存のキー
- KV の `event_data_json` の形が変わる（後方互換の追加のみ）。既存のイベントにも並べるには、マージ後に「Refresh event_data KV cache」を手動で実行して作り直す（PR 本文の「人がやること」）
