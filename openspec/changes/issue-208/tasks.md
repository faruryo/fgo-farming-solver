# Tasks

## 1. 伝承結晶の状態と割り当て

- [ ] 1.1 `lib/event-shop-summary.ts` に伝承結晶の番号の定数を置き、`shopItemStatus` が不足の無い伝承結晶（育成計画で扱う素材の一覧を読めないときを含む）に `always` を返すようにする。`lib/event-shop-summary.test.ts` の `shopItemStatus` に、使わない・足りている・不足あり・一覧を読めないとき（specs の「一覧を読み込めないときの伝承結晶」）の伝承結晶のケースを足し、`pnpm vitest run lib/event-shop-summary.test.ts` が通ることで確かめる
- [ ] 1.2 `allocateShortfallOnly` を design の「割り当て」のとおりにする（`always` と `short` の伝承結晶を在庫上限まで、在庫上限なしは不足の分か 0 と案内）。specs の「不足素材のみ」の伝承結晶の5つの Scenario（2・2・1 の3品目、不足 1・上限 2、不足 5・上限 2 の残り 3、在庫上限なし、不足を埋めた後の在庫上限なし）をテストに足し、`pnpm vitest run lib/event-shop-summary.test.ts` が通ることで確かめる

## 2. 表示

- [ ] 2.1 `components/events/EventShopList.tsx` で `always` に「いつも上限まで交換」を表示し、行を薄くせず、割り当てで在庫上限なしの案内の対象になった伝承結晶の品目（`always` と `short` の両方）で回数 0 のときに「上限なし: 回数を入れてください」を出す。`locales/ja.json` と `locales/en.json` に文言のキーを足す。`components/events/EventHubClient.test.tsx` に、育成計画で使わない伝承結晶の品目が「いつも上限まで交換」と表示され、不足素材のみの操作で在庫上限の回数が入るテストと、不足のある伝承結晶の在庫上限なしの品目に案内が出るテストを足し、`pnpm vitest run components/events/EventHubClient.test.tsx` が通ることで確かめる

## 3. 確認

- [ ] 3.1 `pnpm type-check`、`pnpm lint`、`pnpm vitest run` が通ることを確かめる <!-- verify-only -->
