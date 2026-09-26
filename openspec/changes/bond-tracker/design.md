# Design

## Context

- サーヴァントの表示情報は Material Catalog(`material_catalog_v1`)が持つ。GitHub Actions の updater が `nice_servant.json` 全体を条件付き GET で取り込み、蒸留して KV に置く。クライアントは `/api/material-catalog` から受け取る。
- updater は前回カタログを schemaVersion を確かめずに読み、検証子で条件付き GET を送る。304 なら前回のサーヴァント一覧をそのまま再利用する(`lib/material-catalog-updater.ts` の `servantSection`)。
- クエストの基本絆ポイントは FGODrop CSV 由来の `Quest.bondPoints` にあり、モックでは304クエストすべてが持つ。クライアントは `useDrops()`(`/api/drops`)で quests と campaigns を得る。実効APは `computeEffectiveAp`(`lib/solver.ts`)。
- ストームポッドを消費するクエストは `questConsumesPod(area)`(`lib/quest-consumes-pod.ts`)が area 名で判定している。
- 冠位研鑽戦のクラス縛りは Atlas の quest phase `restrictions`(`individuality equal [クラス特性]`)にあるが、〔エクストラⅠ/Ⅱ〕は `aaQuestId` を持たず Atlas から引けない。
- localStorage は `useLocalStorage`(`hooks/use-local-storage.ts`)で読み書きし、`STORAGE_KEYS` に登録したキーは同期エンジンの変更追跡に乗る。

## Goals / Non-Goals

**Goals:**
- 見積もりの判断(残りポイント、1周の獲得絆の換算、周回数、ティーポット、クエスト候補の絞り込みと並び、クエスト別集計、保存値の解釈)をすべて pure 関数にし、ケース表でテストする。
- 新しい KV キーや更新ジョブを増やさず、既存の Material Catalog 経路に `bondGrowth` を載せる。

**Non-Goals:**
- 絆キャンペーン(`questFriendship`)の自動反映。倍率はユーザー入力にも設けない。
- ティーポットの失効日・月次交換数の管理。見積もりに効くのは所持数だけなので入力しない。
- 礼装・編成ボーナスからの獲得絆の計算、および絆礼装の組み合わせの提案(D7)。
- 複数騎・複数クエストをまたいだ、ティーポット共有の最適配分。
- ストームポッドの所持数や日々の流入を踏まえた日程の計算。必要数の表示にとどめる。
- 冠位研鑽戦のグランドサーヴァント編成条件の判定。
- 絆Lv16 の上限解放状態の判定。目標Lv16は入力どおり計算する。
- スクリーンショットからの絆状態取り込み。
- 周回ソルバーの直近結果(周回予定)から得られる絆の見積もり。後続 change で扱う。`bondPerRun` と `estimateRuns` はクエスト単位の入力にしておき、周回予定の各クエストへ同じ関数を適用できる形を保つ。

## Decisions

### D1. `bondGrowth` は Material Catalog のサーヴァントに任意項目として載せる

`MaterialCatalogServant` に `bondGrowth?: number[]` を足し、`buildMaterialCatalog` が `NiceServant` から蒸留する。`NiceServant` 型にも `bondGrowth?: number[]` を足す。

- 代替: 新しい KV キー(例 `servant_bond_v1`)を同じ phase で書く。絆ページの転送量は減るが、KV キー・検証・API ルート・テストが一式増え、サーヴァント表示情報も二重に持つ。
- 採用理由: 1騎16数値で全体でも数十KB。絆ページはサーヴァント選択のために表示情報も必要で、カタログを1回読めば両方そろう。任意項目の追加なので既存 consumer と互換で、spec の「互換性を壊す変更は新キー」には当たらない。

### D2. 前回カタログに `bondGrowth` がなければ nice_servant を条件なしで取る

`updateMaterialCatalog` で、`previous.servants` のどれも `bondGrowth` を持たないとき、`nice_servant` の検証子を空にして取得する。項目を足した直後は Atlas の JSON が未変更で 304 が返り続け、`bondGrowth` のない一覧が再利用されて固定されるため。

- 代替: schemaVersion を 2 に上げる。spec 上は新キーへの移行が必要になり、KV キーと API の切り替えを伴う。
- 判定を「どれも持たない」にするのは、Atlas 側で一部のサーヴァントだけ欠ける通常状態で毎回フル取得しないため。

### D3. 不正な `bondGrowth` はそのサーヴァントから省く

`isValidBondGrowth`(1要素以上、各要素が有限の正値、単調非減少)を満たさない値は蒸留時に落とす。カタログ全体の検証失敗にはしない。絆データの異常で素材計算機の更新まで止めないため。要素数は16に固定しない(将来の上限拡張に追従する)。

### D4. 見積もりロジックを `lib/bond/` の pure 関数に集める

- `bondIncrement(growth, level)`: Lv→Lv+1 の必要増分(`growth[level] - growth[level-1]`、Lv0 は `growth[0]`)。
- `remainingBond(growth, { currentLevel, remainingToNext, targetLevel })`: 残りポイント、または範囲外の項目を示すエラー。
- `bondPerRun({ observed, teapotRun, measuredBase, questBase })`: ティーポット周回の値なら `floor(observed/2)`、計測クエストと異なれば `floor(値 × questBase / measuredBase)`。推定かどうかも返す。
- `estimateRuns(remaining, perRun, teapotStock | null)`: `{ runs, runsWithoutTeapot, teapotRuns }`。ティーポット周回を先に充てる。
- `bondQuestCandidates(quests, campaigns, className)`: 編成できるクエスト(D8)を `bondPoints / computeEffectiveAp` の降順で返す。`bondPoints` のないクエストは除く。
- `groupByQuest(estimates)`: クエスト別に周回数(最大値)・AP・ポッド数と全体合計を返す。ポッド判定は `questConsumesPod` を使う。
- `parseBondTrackerState(unknown, questIds)`: 保存値を検証し、壊れていれば空状態を返す。存在しないクエストは候補の先頭に置き換える。`useLocalStorage` の `onGet` に渡す。

### D5. 保存は単一キー `bondTracker`

```ts
type BondTrackerState = {
  entries: {
    servantId: number
    questId: string
    currentLevel: number
    remainingToNext: number
    targetLevel: number
    observedPerRun: number
    observedTeapotRun: boolean
    measuredQuestId: string
  }[]
  teapot: { enabled: boolean; stock: number }
}
```

- 代替: 登録一覧と設定を別キーにする。同期キーが2つ増え、縮小ガードの「キー欠落2件以上」に1機能で届きうる。
- `STORAGE_KEYS.BOND_TRACKER` を追加して `CLOUD_SYNC_KEYS` に入れる。縮小ガードの指標(サーヴァント数・アイテム種類数)は `material` と `posession` だけを見るので影響しない。

### D6. 画面構成

- `app/bond/page.tsx`(client)。カタログは `/api/material-catalog`、クエストは `useDrops()` で取る。素材計算機のローダーに取得処理が閉じている場合は hook に切り出して共用する。
- サーヴァント追加は名前検索(Input + 絞り込みリスト)。素材計算機の全件グリッドは登録済みの管理に向かないため流用しない。
- 入力タブは登録サーヴァントごとのカード(周回クエストの選択、絆状態、1周の獲得絆、ティーポット周回の指定)と、その場の見積もりを出す。見積もりタブはクエスト別のまとまりと合計(周回・AP・ポッド)を出す。
- ナビは `components/common/nav.tsx` の Tools グループに1件追加する。文言は新しい namespace `bond` を `locales/{ja,en}.json` に足す。

### D7. 1周の獲得絆はリザルト画面の実測値を入力させる

礼装・位置・絆15・イベントのボーナスを入力させて式で計算する案は採らない。

- 式そのものは Chaldea(chaldea-center/chaldea `lib/app/modules/bond/formation_bond.dart`)の実装で確認できた: `floor(floor(基本絆 × (1+位置%)) × (1+min(割合%, 500%))) + 固定値`、最後にティーポットで×2。位置%は前衛20%・フレンド前衛4%、割合%は礼装・イベント・自軍の絆15サーヴァント1騎25%。
- それでも入力が重い。ユーザーは装備礼装の%を覚えておらず、自身だけに効く礼装やフレンドの礼装で合計の意味も揺れる。実測値ならすべてのボーナスと上限が含まれ、入力は1騎1つの数値で済む。
- 代償は、未計測のクエストの値が基本絆の比による近似になること。絆上げは同じクエストを繰り返すので、1周目の値を入れれば実測に戻る。

### D8. クラス縛りはクエスト名から判定する

冠位研鑽戦の〔セイバー〕〜〔バーサーカー〕はクエスト名の括弧内を `className` に対応づけ、一致するサーヴァントにだけ候補に出す。〔エクストラⅠ/Ⅱ〕は基本7クラス以外に出す。

- 代替: Atlas の `restrictions` をマスターデータ更新で取り込む。正確だが、〔エクストラ〕は `aaQuestId` がなく引けないため結局名前に頼る部分が残る。
- エクストラの対応クラスは画面で「ゲーム内で確認」と添える。

## Risks / Trade-offs

- [絆ページが素材データ込みのカタログ全体を読む] → 素材計算機と同じ API・同じキャッシュ経路で、追加の取得はない。転送量が問題になったら D1 の代替(専用キー)へ切り出す。
- [未計測クエストの換算値が実際とずれる] → 推定と明示し、そのクエストで1周したら実測値を入れ直す運用にする。
- [冠位研鑽戦の名前表記が変わるとクラス判定が外れる] → 判定できないクエストはクラス縛りなしとして全員に出さず、候補から外す(誤って編成不能なクエストを勧めない)。
- [デプロイから次回 updater 実行(最大2時間)まで `bondGrowth` がない] → spec の「絆データ未取得」表示で扱い、クラッシュしない。
- [ティーポットをクエストごとに所持数全体で見積もる] → 前提を画面に出す(spec)。

## Migration Plan

1. カタログの `bondGrowth` 蒸留と取り直し条件を先にマージする。次の updater 実行で本番 KV に `bondGrowth` が入る。
2. 同じ PR で絆ページを出してもよい(未取得表示で耐える)。
3. ロールバックはコードを戻すだけでよい。`bondGrowth` は任意項目なので、残っていても素材計算機は影響を受けない。
