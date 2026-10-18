## Context

`components/common/page-header.tsx` の `PageHeader` は、`.c-page-header` の中に縦並びの列を1つ置き、戻るリンク（`/` 固定）・英字ラベル・タイトル・`children` をその列に積む。`.c-page-header` は `display: flex; justify-content: space-between; align-items: flex-end` なので、列の外に置いた要素はタイトルの右側に並ぶ。

置き換える見出しは14か所あり、次の形に分かれる。

| 形 | ファイル |
|---|---|
| 戻るリンクなし、英字ラベルとタイトルだけ | `servants/index.tsx`・`items/index.tsx`・`items/item.tsx`・`common/doc.tsx`・`cloud/index.tsx`・`farming/index.tsx` |
| 戻るリンクなし、タイトルの右側に要素 | `servants/servant.tsx`（`.c-stats` の STARS・CLASS）、`farming/result.tsx`（公開設定と計算履歴。見出しの行に `flex flex-wrap items-center justify-between gap-3` を足している）、`material/result.tsx`（`.c-result-actions` の不足数と操作） |
| 戻るリンクなし、タイトルの下と右側に要素 | `material/index.tsx`（タイトルの下にクラススコア目標設定へのリンク、右側に `.c-stats` の所持・育成完了・総数） |
| 戻るリンクなし、タイトルの下に要素、見出しが登場のアニメーションを持つ | `app/page.tsx`（ダッシュボード。見出しの行が `motion.div` で、タイトルの下に素材計算などへのボタンの行） |
| `/events` へ戻るリンクあり | `events/EventDataMissing.tsx`、`events/EventHubClient.tsx`（タイトルの下に開催状況・期間・箱数・通貨を並べる） |
| `.c-page-header` を使っていない | `app/farming/history/page.tsx`（`flex justify-between items-center` の行に英字ラベルと、履歴のアイコン付きのタイトル。下線が無い） |

issue に挙がった `events/EventPlannerClient.tsx` の見出しは、#119（イベントページにボックス計画と料理作成を集約）で `EventHubClient.tsx` の `Header` へ移った。issue に挙がっていない4か所（ダッシュボード・計算履歴・素材計算の2ファイル）は、issue の題名「残りのコピーをなくす」に合わせて含める（オーナーの判断）。

`pnpm run audit:duplicates`（jscpd、`minLines: 8`・`minTokens: 70`）を main（17b8ca7）で実行すると、29件の重複のうち見出しのコピーは0件だった。見出しは1か所あたり4〜6行なので、閾値より短く検出されない。この監査は見出しのコピーが無くなったことの根拠にならない。

## Goals / Non-Goals

**Goals:**
- 上の14か所の見出しを `PageHeader` に置き換え、計算履歴を除く各ページの見出しの表示を変えない
- 既存の4ページ（bond・quests・todo・イベント一覧）の呼び出しを変えずに済む props の足し方にする

**Non-Goals:**
- 計算履歴を除く見出しの見た目の変更
- jscpd の閾値の変更

## Decisions

### props は任意項目だけ足す

戻るリンクの文言を任意にし、渡さなければ戻るリンクを出さない。戻り先の props を足し、既定値を `/` にする。タイトルの右側に置く要素の props と、`.c-page-header` に足すクラスの props を足す。どれも任意項目なので、既存の4ページの呼び出しはそのまま動く。

右側の要素は、`children`（タイトルの下に積む）とは別の props にする。`.c-page-header` の flex の子として、タイトルの列の兄弟に置くことで、今の `servant.tsx`・`farming/result.tsx`・`material/index.tsx`・`material/result.tsx` と同じ並びになる。

採らなかった案: 右側の要素を持つページだけ置き換えずに残す。issue の完了の条件（挙がったファイルが `PageHeader` を使う）を満たさない。

### ダッシュボードの登場のアニメーションは外側で包む

`PageHeader` にアニメーションの props は足さない。ダッシュボードでは `motion.div`（クラスなし、今と同じ `initial`・`animate`）で `PageHeader` を包む。包む要素は padding も border も持たないので、`.c-page-header` の `margin-bottom` は今と同じく見出しの下に効く。

### 戻るリンクが無いときの DOM の差

戻るリンクの無い見出しでは、今は `.c-page-header > div > (.c-page-en, h1)` で、`PageHeader` に置き換えると `.c-page-header > div.flex.flex-col.gap-2 > div.flex.flex-col > (.c-page-en, h1)` になる。子が1つの `gap` は効かず、`flex-col` の子は横幅いっぱいに伸びるので、ブロック要素を縦に積むのと見た目は同じになる。`.c-page-en` の `margin-bottom: 4px` は、どちらの並べ方でも次の `h1` との間に残る。見た目が同じことは、置き換えの前後のスクリーンショットで確かめる（tasks の確認）。

タイトルの下の要素（`children`）は、`gap-2`（8px）でタイトルの下に積まれる。ダッシュボードとイベントのページは今も同じ並べ方なので変わらない。素材計算のクラススコアへのリンクの行は、今は `mt-1.5`（6px）でタイトルの下にあり、`mt-1.5` を外して `children` に渡すと間が 8px になる。2px の差は、ほかの見出しのタイトルの下の行と揃えるために受け入れる。

### 計算履歴の見出しは標準の見た目に揃える

計算履歴の見出しは `.c-page-header` を使っておらず、下線と金色のアクセントが無い。`PageHeader` に置き換えると、ほかのページと同じ下線・余白が付く。見出しを統一するという issue の目的に合うので、このページだけは見た目が変わることを受け入れる。英字ラベルの `letterSpacing: '0.2em'` は `.c-page-en` と同じ値なので落とす。タイトルの履歴のアイコンは、`flex items-center gap-3` の要素でアイコンと文言を包んでタイトルとして渡し、今と同じく文言の左に並べる。

### 見出しのコピーが無くなったことの確かめ方

jscpd では検出されない（Context の実測）ので、置き換えた14ファイルに `c-page-header`・`c-page-en`・`c-page-title` の文字列が残っていないこと（外側の `.c-page-header` を残すと見出しの下線と余白が二重になる）と、各ファイルが `PageHeader` を import していることを grep で確かめる。

## Risks / Trade-offs

- [`farming/result.tsx` の見出しの行のクラスの効き方] → `app/globals.css` は Tailwind v4 で、`.c-page-header` は layer の外にあるため utilities に勝つ。今も `items-center` は効かず `align-items: flex-end` で揃い、効いているのは `flex-wrap` と `gap-3` だけである。同じクラスを足せば同じ見た目になるので、揃え方を直さない
- [計算履歴の見出しの見た目が変わる] → 置き換えの前後のスクリーンショットで、変わるのが下線・余白だけで、英字ラベル・アイコン・タイトルの並びが同じことを確かめる
