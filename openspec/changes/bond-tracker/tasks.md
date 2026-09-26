# Tasks

## 1. Material Catalog に bondGrowth を載せる

- [ ] 1.1 `NiceServant` と `MaterialCatalogServant` に `bondGrowth?: number[]` を追加し、`isValidBondGrowth`(1要素以上・有限の正値・単調非減少)を pure 関数で実装する。正常・空・負値・NaN・減少のケース表テストが通り、条件を反転すると赤くなることを確認する
- [ ] 1.2 `buildMaterialCatalog` で有効な `bondGrowth` だけを蒸留し、不正値のサーヴァントは項目を省いて候補を作る。不正な1騎を含む入力でもカタログ検証が通るテストで確認する
- [ ] 1.3 `updateMaterialCatalog` で、前回カタログのサーヴァントがどれも `bondGrowth` を持たないとき `nice_servant` を検証子なしで取得する。前回に項目なし・Atlas 未変更の入力で条件なし取得が起き、項目ありの前回では条件付き取得のままであることをテストで確認する
- [ ] 1.4 ローカルモックのカタログ再生成経路(`lib/material-catalog-local.ts`)でも `bondGrowth` が入ることを、再生成後のモックに値があることで確認する

## 2. 見積もりロジック(pure 関数)

- [ ] 2.1 `lib/bond/` に `bondIncrement` と `remainingBond` を実装する。spec の「目標が次のLv」「複数Lv先が目標」、Lv0 起点、残りポイント範囲外、目標Lv以下のケースをテストし、1件を壊すと赤くなることを確認する
- [ ] 2.2 `bondPerRun` を実装する。spec の前衛と控え、絆15サーヴァントの加算、切り捨てのケースをテストで確認する
- [ ] 2.3 `estimateRuns` を実装する。spec の端数切り上げ、ティーポット所持数で足りる/尽きる、残り0以下、ティーポットなしのケースをテストで確認する
- [ ] 2.4 `rankBondQuests` を実装する。`bondPoints / computeEffectiveAp` の降順、`bondPoints` なしの除外、AP 割引キャンペーンの反映をテストで確認する
- [ ] 2.5 `BondTrackerState` と `parseBondTrackerState` を実装する。正常値、JSON 不正、フィールド欠落・型違い、範囲外の数値で空状態または補正値が返ることをテストで確認する

## 3. 保存とクラウド同期

- [ ] 3.1 `STORAGE_KEYS.BOND_TRACKER = 'bondTracker'` を追加して `CLOUD_SYNC_KEYS` に含め、`lib/constants/storage-keys.test.ts` の期待配列を更新して通ることを確認する

## 4. 絆トラッカー画面

- [ ] 4.1 カタログ取得を絆ページから使えるようにする(素材計算機のローダーに閉じていれば hook に切り出す)。素材計算機の既存テストが通り、`/material` の表示が変わらないことを確認する
- [ ] 4.2 `app/bond/page.tsx` とサーヴァント名検索による追加・削除を実装し、`useLocalStorage(STORAGE_KEYS.BOND_TRACKER, …, { onGet: parseBondTrackerState })` で保存する。重複追加できないこと、再訪時に復元されることを実画面で確認する
- [ ] 4.3 各騎の絆状態入力(現在Lv・次のLvまでの残り・目標Lv・前衛/控え)と、範囲外の項目表示を実装する。範囲外で見積もりが消え、どの値が範囲外かが出ることを実画面で確認する
- [ ] 4.4 クエスト選択(絆/実効AP 上位の候補と名前検索)、絆ボーナス入力、ティーポットの切り替えと所持数入力を実装する。クエスト未選択で選択を促す表示、ティーポット OFF で所持数欄が消えることを実画面で確認する
- [ ] 4.5 見積もりカード(残りポイント・残り周回数・必要AP・ティーポットで縮む周回数・概算の注記・ティーポット共有の注記)と、`bondGrowth` がない騎の未取得表示を実装する。spec のシナリオの数値が画面に出ることを実画面で確認する
- [ ] 4.6 `components/common/nav.tsx` の Tools に `/bond` を追加し、`locales/ja.json` と `locales/en.json` に `bond` namespace を追加する。ナビから到達でき、英語表示で生キーが出ないことを確認する

## 5. 統合確認

- [ ] 5.1 `pnpm run lint:ratchet`、`pnpm run type-check`、`pnpm vitest run` がすべて通ることを確認する
- [ ] 5.2 375px 幅を含む実画面で、サーヴァント登録から見積もり表示、リロード後の復元までを通して確認する
- [ ] 5.3 `openspec validate bond-tracker --strict` が通ることを確認する
