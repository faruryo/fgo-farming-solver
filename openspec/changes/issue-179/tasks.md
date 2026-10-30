# Tasks

## 1. 取り込み

- [ ] 1.1 `lib/master-data/types.ts` の `EventShopItem` に、design の D1 のとおり任意のフィールド `kind?: 'svt'` と `rarity?: number` を足し、`purchaseType='item'` だけを取ると書いたコメント（`EventShopItem` の上と、`event_data_json` の型の上の2か所）を今の条件に直す。`pnpm type-check` が通ること
- [ ] 1.2 `lib/refresh-event-data-compact.ts` の `compactShop` を、design の D2・D3 のとおりにする。`AtlasShopItem` に Atlas のエントリーの見出し `name` を足す。引数に svt の対応表（番号 → 名前・レア度・アイコンの URL。省略可）を足し、`purchaseType` が `servant` で `payType` が `eventItem` のエントリーを、`targetIds` の番号ごとに `kind: 'svt'` の品目にする。対応表に無い番号は、名前を Atlas のエントリーの `name` にし、アイコンとレア度を付けない。`commandCode`・`costumeRelease`・`eventSvtJoin`・`setItem` は取らない。`decideEventImport` を design の D4 のとおり、アイテムの品目の最初の対価を通貨にし、アイテムの品目が無いときだけサーヴァント扱いの品目の最初の対価を通貨にする。`lib/refresh-event-data-compact.test.ts` に次をテストする。fixture は design の Context の 80632 の形（種火・フォウくん・同じ礼装が3つの通貨で在庫上限 2・1・1）を手で書く
  - 種火・フォウくん・礼装の品目が `kind: 'svt'`・名前・レア度・アイコン・1回の個数・対価・在庫上限とともに出る
  - 同じ礼装の3つの交換が、通貨と在庫上限の違う3つの品目になる
  - コマンドコードと霊衣開放権のエントリーが出ない
  - 対応表に無い番号と、対応表を渡さないときは、名前が Atlas のエントリーの `name` になり、アイコンとレア度が無い
  - アイテムの品目は今までどおり出て、`kind` を持たない
  - 最初のエントリーが礼装で、その後にアイテムの交換があるとき、通貨はアイテムの交換の対価になる。サーヴァント扱いの交換だけの交換所は `shop` として取り込まれ、通貨はその最初の対価になる
- [ ] 1.3 `scripts/refresh-event-data.ts` で、イベントを処理する前に `export/JP/basic_svt.json` を無条件に1回取得して番号 → `{ name, rarity, face }` の対応表を作り、`compactShop` に渡す。取得に失敗したら警告を出し、対応表なしで取り込みを続ける（アイテムの交換とロトの取り込みを止めない）。取得の関数は `fetchItemMap` と同じ形にする。`pnpm test lib/refresh-event-data-compact.test.ts` と `pnpm type-check` が通ること

## 2. 計算と画面

- [ ] 2.1 `lib/event-shop-summary.ts` と `components/events/EventShopList.tsx` を design の D5 のとおりにする（型が連動するので1つのタスクにする）。`shopItemStatus` と `allocateShortfallOnly` の `statusOf` を、番号ではなく品目（または `kind`）を受け取る形に変え、呼び出し元（`EventShopList.tsx`・`lib/event-shop-summary.test.ts`）を合わせる。`shopItemStatus` は `kind` が `'svt'` の品目を、育成計画の必要数と素材の集合を見ずに「計画の対象外」にする。素材の集合が無いときは、アイテムの品目と同じく状態なしにする。不足素材のみの回数（`allocateShortfallOnly`）が受け取る「必要」の集合を、アイテムの品目は番号の文字列、サーヴァント扱いの品目は `svt:<番号>` のキーで引くようにする。効率順の並び（`orderShopByEfficiency` など）は `kind` が `'svt'` の品目を AP 換算値の無い品目にする。`lib/event-shop-summary.test.ts` に次をテストする
  - `kind: 'svt'` の品目は、番号が育成計画の必要数や素材の集合に入っていても「計画の対象外」になり、素材の集合が undefined のときは状態なしになる
  - 在庫上限 100 の種火を「必要」、在庫上限 2 の礼装を「不要」にして不足素材のみの回数を出すと、種火は 100、礼装は 0 になる
  - 番号 9305420 のアイテムの品目と `kind: 'svt'` の品目があり、`svt:9305420` だけが「必要」のとき、アイテムの品目は「必要」として扱われない。逆も同じ
  - 全部交換（`selectAllCurrenciesUpToLimit`）で、`kind: 'svt'` の品目も在庫上限の回数になり、通貨の必要量に対価が入る
  - `kind: 'svt'` の品目は、ドロップ表に同じ番号の価格があっても効率と順位を持たず、前に並ぶ
  あわせて `EventShopList.tsx` の必要／不要の保存（`useWantedItems`）を design の D5 のキーにする。サーヴァント扱いの品目は `svt:<番号>` のキーで読み書きし、保存の形（キー → `true`、「不要」に戻したらキーを消す）と保存先のキー `events/shopWantedItems` は変えない。`app/events/[id]/page.tsx` で、`kind` が `'svt'` の品目には AP 換算値を引かない。`components/events/EventHubClient.test.tsx` に次をテストする。`pnpm type-check` が通ること
  - ロトの無い交換所のイベントで、種火・フォウくん・礼装の品目が名前とアイコンとともに並び、「計画の対象外」と必要／不要の切り替えが出る
  - 礼装を「必要」にすると localStorage の `events/shopWantedItems` に `svt:<番号>` のキーで入り、同じ番号のアイテムのキーは作られない
  - 全部交換を押すと、サーヴァント扱いの品目も在庫上限の回数になる
  - 育成計画が `empty` のとき、また素材カタログの読み込みに失敗したとき、サーヴァント扱いの品目にも切り替えが出ない
- [ ] 2.2 ボックス計画で、`lib/event-plan.ts` の素材の需要との突き合わせと名前の対応表、`components/events/EventPlannerClient.tsx` の直接指定モードの選べる素材の候補（`collectSelectableItems`）から、`kind` が `'svt'` の品目を除く（design の D5）。`lib/event-plan.test.ts` に、需要のある素材と同じ番号の `kind: 'svt'` の品目が交換所にあっても、ボックス計画の交換に選ばれず、名前の対応表がアイテムの名前のままであることをテストする。直接指定の候補に `kind: 'svt'` の品目が出ず、同じ番号のアイテムの候補名がアイテムの名前のままであることをテストする（`collectSelectableItems` を export して単体で確かめるか、既存の `EventPlannerClient` のテストに足す）

## 3. 確認

- [ ] 3.1 `pnpm test`・`pnpm lint`・`pnpm type-check` がすべて通ることを確かめる <!-- verify-only -->
- [ ] 3.2 dev server を 3000/3001 以外のポートで起動し、ロトの無い交換所のイベントの交換所に、種火・フォウくん・礼装の品目がアイコン付きで並び、全部交換・必要／不要・不足素材のみ・周回の内訳が動くことを 375px と PC 幅で確かめる。交換所だけのイベントの KV が手元に無いときは、ブラウザでモックを一時的に差し替えて確かめ、差し替えは commit しない <!-- verify-only -->
