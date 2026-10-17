## Context

`components/common/page-header.tsx` の `PageHeader` は、`.c-page-header` の中に縦並びの列を1つ置き、戻るリンク（`/` 固定）・英字ラベル・タイトル・`children` をその列に積む。`.c-page-header` は `display: flex; justify-content: space-between; align-items: flex-end` なので、列の外に置いた要素はタイトルの右側に並ぶ。

置き換える見出しは3つの形に分かれる。

| 形 | ファイル |
|---|---|
| 戻るリンクなし、英字ラベルとタイトルだけ | `servants/index.tsx`・`items/index.tsx`・`items/item.tsx`・`common/doc.tsx`・`cloud/index.tsx`・`farming/index.tsx` |
| 戻るリンクなし、タイトルの右側に要素 | `servants/servant.tsx`（`.c-stats` の STARS・CLASS）、`farming/result.tsx`（公開設定と計算履歴。見出しの行に `flex flex-wrap items-center justify-between gap-3` を足している） |
| `/events` へ戻るリンクあり | `events/EventDataMissing.tsx`、`events/EventHubClient.tsx`（タイトルの下に開催状況・期間・箱数・通貨を並べる） |

issue に挙がった `events/EventPlannerClient.tsx` の見出しは、#119（イベントページにボックス計画と料理作成を集約）で `EventHubClient.tsx` の `Header` へ移った。

`pnpm run audit:duplicates`（jscpd、`minLines: 8`・`minTokens: 70`）を main（17b8ca7）で実行すると、29件の重複のうち見出しのコピーは0件だった。見出しは1か所あたり4〜6行なので、閾値より短く検出されない。この監査は見出しのコピーが無くなったことの根拠にならない。

## Goals / Non-Goals

**Goals:**
- 上の10ファイルの見出しを `PageHeader` に置き換え、各ページの見出しの表示を変えない
- 既存の4ページ（bond・quests・todo・イベント一覧）の呼び出しを変えずに済む props の足し方にする

**Non-Goals:**
- issue に挙がっていない見出しのコピー（ダッシュボード・計算履歴・素材計算の2ファイル）の置き換え
- 見出しの見た目の変更
- jscpd の閾値の変更

## Decisions

### props は任意項目だけ足す

戻るリンクの文言を任意にし、渡さなければ戻るリンクを出さない。戻り先の props を足し、既定値を `/` にする。タイトルの右側に置く要素の props と、`.c-page-header` に足すクラスの props を足す。どれも任意項目なので、既存の4ページの呼び出しはそのまま動く。

右側の要素は、`children`（タイトルの下に積む）とは別の props にする。`.c-page-header` の flex の子として、タイトルの列の兄弟に置くことで、今の `servant.tsx`・`result.tsx` と同じ並びになる。

採らなかった案: 右側の要素を持つ2ページだけ置き換えずに残す。issue の完了の条件（挙がったファイルが `PageHeader` を使う）を満たさない。

### 戻るリンクが無いときの DOM の差

戻るリンクの無い見出しでは、今は `.c-page-header > div > (.c-page-en, h1)` で、`PageHeader` に置き換えると `.c-page-header > div.flex.flex-col.gap-2 > div.flex.flex-col > (.c-page-en, h1)` になる。子が1つの `gap` は効かず、`flex-col` の子は横幅いっぱいに伸びるので、ブロック要素を縦に積むのと見た目は同じになる。`.c-page-en` の `margin-bottom: 4px` は、どちらの並べ方でも次の `h1` との間に残る。見た目が同じことは、置き換えの前後のスクリーンショットで確かめる（tasks の確認）。

### 見出しのコピーが無くなったことの確かめ方

jscpd では検出されない（Context の実測）ので、置き換えた10ファイルに `c-page-en` と `c-page-title` が残っていないことを grep で確かめる。

## Risks / Trade-offs

- [`farming/result.tsx` の見出しの行のクラスが既存の `.c-page-header` と競合する] → 今と同じクラスの並びを `.c-page-header` に足すだけにし、計算結果のページを狭い幅でも確かめる
- [#144（イベントの交換所一覧）が `EventHubClient.tsx` を変える] → 実装はその時点の main から始める。`Header` の中身だけを置き換えるので、#144 の変更（ページ本体への交換所一覧の追加）とは触る箇所が重ならない
