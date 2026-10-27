# Tasks

## 1. 編成コストの上限

- [ ] 1.1 `lib/master-profile/max-cost.ts` に design.md の変化点テーブルと `maxCostForLevel(level)` を足し、`lib/master-profile/max-cost.test.ts` で Lv1→56、Lv130→111、Lv200→118、範囲外のレベルの扱い(`maxApForLevel` と同じ丸め)を確かめ、`pnpm vitest run lib/master-profile` が通る

## 2. Material Catalog にコストと絆アップ礼装を足す

- [ ] 2.1 `lib/material-catalog.ts` のサーヴァントに任意の `cost` を、カタログに任意の `bondUpCraftEssences` と `sources.niceEquip` を足し、`nice_servant` の `cost` を0以上の整数のときだけ蒸留する。`lib/material-catalog.test.ts` に★5のコスト16、コスト0、不正なコストで省かれるケースを足して通す
- [ ] 2.2 `nice_equip` から絆アップ礼装の一覧を蒸留する関数を design.md の「蒸留の規則」どおりに実装し、合成した小さな fixture で、パーティ全体の増加率(最大解放の段を読む)、自身の固定値、イベント限定と特性限定の除外、効果が残らない礼装の除外、対象が混ざる礼装の除外をテストして通す
- [ ] 2.3 `lib/material-catalog-updater.ts` に `nice_equip.json` の条件付き取得を足す。304 なら parse せず既存の一覧を引き継ぐ、3つとも 304 なら書かない、既存カタログに `bondUpCraftEssences` がなければ検証子なしで取る、サーヴァントが誰も `cost` を持たなければ `nice_servant.json` を検証子なしで取る、`nice_equip.json` だけが200で一覧が変わったときに書き込まれる(`materialCatalogFingerprint` に `bondUpCraftEssences` を含める)、`nice_servant.json` が304のとき既存の `cost` が引き継がれる、を `lib/material-catalog-updater.test.ts` に足して通す
- [ ] 2.4 カタログの検証に絆アップ礼装の検証(ID の一意性、名前と顔画像 URL が空でない、コストが正の整数、増加率と固定値が有限の0以上でいずれかが正、空の一覧と件数の20%超の減少の拒否)を足し、不正な礼装と空の一覧と件数の減少で候補が拒否されるテストを足して通す
- [ ] 2.5 `lib/material-catalog-phase.ts` と `scripts/run-updater.ts` に `nice_equip` の URL(`getUrl('nice_equip', 'ja')` 相当)を渡し、`lib/material-catalog-local.ts` も `nice_equip` から `bondUpCraftEssences` と `sources.niceEquip` を組むようにして、`pnpm type-check` が通る

## 3. 提案の計算

- [ ] 3.1 `lib/bond/craft-essence-advice.ts` に、選んだサーヴァント(コスト)・基本絆ポイント・コストの上限・絆アップ礼装の一覧から提案を返す純関数を design.md の Decision 3 どおりに実装する。`lib/bond/craft-essence-advice.test.ts` で spec の「コストに余裕がある」(各6,075、合計18,225、コスト84)、「コストが足りず安い礼装だけ入る」(各3,847、合計11,541)、サーヴァントだけでコストを超える、コストが不明、同じ効果の礼装の言い換え(図鑑番号の小さい3種類と残り9種類)、合計が同じときにコストの小さい組を、合計とコストも同じときに枚数の少ない組を選ぶこと、自身に効く礼装を先頭のサーヴァントに付けること、サーヴァントのコストの合計が上限とちょうど同じときに礼装なしの提案が出ることを確かめて通す
- [ ] 3.2 選んだサーヴァントの周回クエストの候補の共通部分と初期値を返す関数を `lib/bond/` に足し、選んだサーヴァントが0体(候補を返さない)、共通の候補がない、クラスの異なるサーヴァントで冠位研鑽戦が共通の候補から外れる、先頭のサーヴァントの周回クエストが共通の候補にある/ない、をテストして通す

## 4. 画面

- [ ] 4.1 `components/bond/craft-essence-advisor.tsx` を作り、`components/bond/index.tsx` の Tabs に「礼装の提案」タブを足す。サーヴァントの選択(初期は登録順の先頭5体、6体目は選べない)、クエストの選択、マスターレベルの入力(`useMasterLevel` に保存)、結果(サーヴァントごとの礼装と獲得絆、合計、礼装なしの合計、コストの合計と上限、言い換えの候補)、エラーの表示(サーヴァントを選んでいない、一緒に回せるクエストがない、コスト超過、コスト不明、礼装のデータなし)を描く。文言は `locales/ja.json` と `locales/en.json` に足す
- [ ] 4.2 `components/bond/craft-essence-advisor.test.tsx` で、7体登録時に先頭5体が選ばれること、6体目を選べないこと、選択をすべて外すとサーヴァントを選ぶ必要がある旨が出ること、マスターレベルの変更が保存されること、クエストの初期値が先頭のサーヴァントの周回クエストになること、カタログに絆アップ礼装の一覧がないときに読み込めない旨が出て見積もりタブは描けることを確かめ、`pnpm vitest run components/bond` が通る

## 5. 全体の確認

- [ ] 5.1 `pnpm type-check`、`pnpm lint`、`pnpm vitest run` が通ることを確かめる <!-- verify-only -->
- [ ] 5.2 Atlas の実データの `nice_equip.json` と `nice_servant.json` で蒸留した結果が design.md の実測(イベント限定を除いて59件、8通りの効果とコスト、★5のコスト16)と合うことを確かめる <!-- verify-only -->
- [ ] 5.3 KV のない `pnpm dev`(ローカルで Atlas の実データからカタログを作る経路)で `/bond` を開き、礼装の提案タブで spec のシナリオどおりに表示されることを、verify skill の手順でブラウザから確かめる <!-- verify-only -->
