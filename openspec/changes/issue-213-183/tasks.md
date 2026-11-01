# Tasks

## 1. Material Catalog に特性と礼装の条件を足す

- [ ] 1.1 `lib/material-catalog.ts` の `MaterialCatalogServant` に任意の `traits: number[]` を足し、`nice_servant` の `traits` の ID を1要素以上・正の整数・重複なしのときだけ蒸留する。`buildMaterialCatalog` がサーヴァントの項目を組み直す箇所で `traits` も写す。`lib/material-catalog.test.ts` に、正常な特性が入るケースと、欠落・空・正の整数でない ID で省かれ候補が拒否されないケースを足し、`pnpm vitest run lib/material-catalog.test.ts` が通る
- [ ] 1.2 `MaterialCatalogBondUpCraftEssence` に `appliesTo: number[][]`(型は任意項目)と任意の `supportRate` を足し、`distillBondUpCraftEssences` を design.md の Decision 2 の規則で書き換える。合成した小さな fixture で、条件なし(`[]`)、`functvals` の1つ(キャスター)、`functvals` の複数(悪または星)、`overWriteTvalsList` の組(秩序かつ女性)、`overWriteTvalsList` が `functvals` より優先されること、`followerVals` の値が違うときだけ `supportRate` が入ること、読めない効果(`Individuality` が0でない、未知の `svals` のキー、`funcquestTvals`、負の ID、空の組)の除外、条件が混ざる礼装の除外をテストして通す
- [ ] 1.3 カタログの検証に、各絆アップ礼装が `appliesTo` を持ち(持たない礼装を含む候補は拒否する)、各組が空でなく各 ID が正の整数であること、`supportRate` を持つときは有限の0以上であること、サーヴァントの `traits` を持つときは1要素以上の正の整数で重複がないこと、を足す。`appliesTo` のない礼装、不正な条件、不正な `supportRate` で候補が拒否されるテストを足して通す
- [ ] 1.4 `lib/material-catalog-updater.ts` の `servantValidatorFor` を、既存カタログのサーヴァントが誰も `traits` を持たないときも検証子なしにし、`equipValidatorFor` を、既存の絆アップ礼装がどれも `appliesTo` を持たないときも検証子なしにする。`lib/material-catalog-updater.test.ts` に、それぞれ取り直しが起きることと、`nice_servant.json` が304のとき既存の `traits` が引き継がれることを足して通す

## 2. 提案の計算

- [ ] 2.1 `lib/bond/craft-essence-advice.ts` の `CraftEssenceAdviceServant` に任意の `traits` を足し、design.md の Decision 3 どおり、礼装ごとの効く相手のマスクを種類の鍵に入れ、サーヴァントごとに効く増加率と固定を数える探索に書き換える。`lib/bond/craft-essence-advice.test.ts` を spec に合わせて改め、「コストに余裕がある」(キャスター3体、各5,125、合計15,375、コスト84)、「条件に合う相手にだけ効く」(キャスター各4,936、セイバー4,176、合計14,048、上限72)、誰にも効かない礼装が組み合わせにも言い換えにも入らないこと、`traits` のないサーヴァントに全員に効く礼装の効果だけが数えられること、「コストが足りず安い礼装だけ入る」(各3,847、合計11,541)、「効く相手が違う礼装は言い換えにならない」(キャスターかつ中立とセイバーの2体、上限56で、同点の組からランチタイムと手稿の翼が選ばれ、手稿の翼の言い換えに記憶の大図書館が並び、流転の剣聖は並ばない)、合計・コスト・枚数が同じ組で図鑑番号の列が小さいものが選ばれること、自身に効く礼装を条件に合うサーヴァントにだけ、効く相手の人数を超えずに付けること、を確かめて `pnpm vitest run lib/bond` が通る

## 3. 画面

- [ ] 3.1 `components/bond/craft-essence-advisor.tsx` で、選んだサーヴァントの `traits` をカタログから提案の関数に渡し、`appliesTo` のない礼装を候補から外し、残りが0件のときは礼装のデータを読み込めない旨を出す。`components/bond/craft-essence-advisor.test.tsx` に、どの礼装も `appliesTo` を持たないカタログで読み込めない旨が出て見積もりタブは描けること、セイバーだけを選んだときに〔キャスター〕にだけ効く礼装が表示されないことを足し、`pnpm vitest run components/bond` が通る

## 4. 全体の確認

- [ ] 4.1 `pnpm type-check`、`pnpm lint`、`pnpm vitest run` が通ることを確かめる <!-- verify-only -->
- [ ] 4.2 Atlas の実データの `nice_equip.json` と `nice_servant.json` で蒸留した結果が design.md の実測(イベント限定を除いて59件、表の効果・コスト・条件の組、カルデア・ティータイムのサポート時150、サーヴァントの特性が平均17個程度)と合うことを確かめる <!-- verify-only -->
- [ ] 4.3 KV のない `pnpm dev`(ローカルで Atlas の実データからカタログを作る経路)で `/bond` を開き、礼装の提案タブで、セイバーだけを選んだときに〔キャスター〕に効く礼装が出ないことと、キャスターを選んだときに〔キャスター〕に効く礼装がそのサーヴァントにだけ数えられることを、verify skill の手順でブラウザから確かめる <!-- verify-only -->
