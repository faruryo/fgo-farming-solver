## Why

#103 でページ見出し（戻るリンク・英字ラベル・タイトル）を `PageHeader` に切り出したが、置き換えたのは bond・quests・todo・イベント一覧の4ページだけで、ほかのページには同じ見出しのコピーが残っている（#106）。見出しの見た目を変えるたびにコピーを1つずつ直す必要があり、直し漏れでページごとに見出しがずれる。残りが置き換えられないのは、`PageHeader` が戻るリンクを常に出し、戻り先を `/` に固定しているためで、戻るリンクの無い見出しや `/events` へ戻る見出しを表せない。

## What Changes

- `PageHeader` で、戻るリンクを省けるようにし（戻るリンクの文言を渡さなければ出さない）、戻り先を指定できるようにする（指定しなければ今までどおり `/`）
- `PageHeader` で、タイトルの右側に並べる要素（サーヴァント詳細の STARS・CLASS、計算結果の公開設定と計算履歴へのリンク）と、見出しの行に足すクラスを渡せるようにする
- issue に挙がった見出しのコピーを `PageHeader` に置き換える。各ページの表示は変えない
- `/events` へ戻る見出し（イベントのページと、データ未取得の表示）は、戻り先を `/events` に指定して置き換える

## Capabilities

### New Capabilities

- （なし）

### Modified Capabilities

- `ui-framework`: ページ見出しの共通コンポーネント `PageHeader` と、ページ見出しをそれに統一する要件を足す。

## Impact

- `components/common/page-header.tsx`（props の追加。既存の呼び出し4ページはそのまま動く）
- `components/servants/index.tsx`・`components/servants/servant.tsx`・`components/common/doc.tsx`・`components/cloud/index.tsx`・`components/farming/result.tsx`・`components/farming/index.tsx`・`components/items/index.tsx`・`components/items/item.tsx`・`components/events/EventDataMissing.tsx`・`components/events/EventHubClient.tsx`
- issue に挙がった `components/events/EventPlannerClient.tsx` の見出しは、#119 で `EventHubClient.tsx` へ移っているので、そちらを置き換える

## 範囲外

- issue に挙がっていない見出しのコピー（`app/page.tsx` のダッシュボード、`app/farming/history/page.tsx`、`components/material/index.tsx`、`components/material/result.tsx`）。置き換えるなら別の issue にする
