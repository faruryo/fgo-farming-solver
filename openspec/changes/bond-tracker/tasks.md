# Tasks

## 1. Material Catalog に bondGrowth を載せる

- [x] 1.1 `NiceServant` と `MaterialCatalogServant` に `bondGrowth?: number[]` を追加し、`isValidBondGrowth`(1要素以上・有限の正値・単調非減少)を pure 関数で実装する。正常・空・負値・NaN・減少のケース表テストが通り、条件を反転すると赤くなることを確認する
- [x] 1.2 `buildMaterialCatalog` で有効な `bondGrowth` だけを蒸留し、不正値のサーヴァントは項目を省いて候補を作る。不正な1騎を含む入力でもカタログ検証が通るテストで確認する
- [x] 1.3 `updateMaterialCatalog` で、前回カタログのサーヴァントがどれも `bondGrowth` を持たないとき `nice_servant` を検証子なしで取得する。前回に項目なし・Atlas 未変更の入力で条件なし取得が起き、項目ありの前回では条件付き取得のままであることをテストで確認する
- [x] 1.4 ローカルモックのカタログ再生成経路(`lib/material-catalog-local.ts`)でも `bondGrowth` が入ることを、再生成後のモックに値があることで確認する

## 2. 見積もりロジック(pure 関数)

- [x] 2.1 `lib/bond/` に `bondIncrement` と `remainingBond` を実装する。spec の「目標が次のLv」「複数Lv先が目標」、Lv0 起点、残りポイント範囲外、目標Lv以下、`bondGrowth` が目標Lvに足りない(15要素で目標16)ケースをテストし、1件を壊すと赤くなることを確認する
- [x] 2.2 `bondPerRun` を実装する。ティーポット周回の値の半減を換算より先に行うこと(10,480→5,240→6,552)、ティーポット周回で1を拒否すること、推定フラグ、計測クエストがないときのエラーをテストで確認する
- [x] 2.3 `estimateRuns` を実装する。spec の端数切り上げ、ティーポット所持数で足りる/尽きる、残り0以下、ティーポットなしのケースをテストで確認する
- [x] 2.4 `bondQuestCandidates` を実装する。基本7クラスの冠位研鑽戦は同クラスのみ、〔エクストラⅠ/Ⅱ〕は基本7クラス以外のみで対象クラス未確認の印付き、クラスを判定できない冠位研鑽戦は除外、`bondPoints / computeEffectiveAp` の降順と AP 割引の反映をケース表テストで確認する。画面から `useActiveCampaigns` を通した有効期間中のキャンペーンだけを渡す
- [x] 2.5 `groupByQuest` を実装する。spec の「同じクエストの2騎」(最大値)と「合計」、ポッド判定(`questConsumesPod`)、入力エラーの騎を集計から除くことをテストで確認する
- [x] 2.6 `BondTrackerState` と `parseBondTrackerState` を実装する。正常値、JSON 不正、フィールド欠落・型違い、範囲外の数値をテストで確認する
- [x] 2.7 `reconcileEntry` を実装する。周回クエストが候補にないとき確認済み候補の先頭へ置き換えること、計測クエストが消えたとき入れ直しが必要な状態になることをテストで確認する

## 3. 保存とクラウド同期

- [x] 3.1 `STORAGE_KEYS.BOND_TRACKER = 'bondTracker'` を追加して `CLOUD_SYNC_KEYS` に含め、`lib/constants/storage-keys.test.ts` の期待配列を更新して通ることを確認する

## 4. 絆トラッカー画面

- [x] 4.1 カタログ取得を絆ページから使えるようにする(素材計算機のローダーに閉じていれば hook に切り出す)。素材計算機の既存テストが通り、`/material` の表示が変わらないことを確認する
- [x] 4.2 `app/bond/page.tsx` に入力・見積もりのタブと、サーヴァント名検索による追加・削除を実装し、`useLocalStorage(STORAGE_KEYS.BOND_TRACKER, …, { onGet: parseBondTrackerState })` で保存する。重複追加できないこと、再訪時に復元されることを実画面で確認する
- [x] 4.3 サーヴァントカード(周回クエストの選択、現在Lv・次のLvまで・目標Lv・1周の獲得絆、ティーポット周回の指定)と範囲外表示を実装する。キャスターに他クラスの冠位研鑽戦が出ないこと、範囲外で見積もりが消えて許される範囲が出ることを実画面で確認する
- [x] 4.4 カード内の見積もり(残り絆・残り周回・AP・ポッド数・ティーポットで縮む周回・推定表示)と、`bondGrowth` がない騎の未取得表示を実装する。クエストを切り替えると推定表示になり、獲得絆を入れ直すと消えることを実画面で確認する
- [x] 4.5 ティーポットの切り替えと所持数入力、見積もりタブのクエスト別集計と合計を実装する。OFF で所持数欄が消えること、同じクエストの騎の周回数が最大値になることを実画面で確認する
- [ ] 4.6 `components/common/nav.tsx` の Tools に `/bond` を追加し、`locales/ja.json` と `locales/en.json` に `bond` namespace を追加する。ナビから到達でき、英語表示で生キーが出ないことを確認する

## 5. 統合確認

- [x] 5.1 `pnpm run lint:ratchet`、`pnpm run type-check`、`pnpm vitest run` がすべて通ることを確認する
- [x] 5.2 375px 幅を含む実画面で、サーヴァント登録から見積もり表示、リロード後の復元までを通して確認する
- [x] 5.3 `openspec validate bond-tracker --strict` が通ることを確認する
