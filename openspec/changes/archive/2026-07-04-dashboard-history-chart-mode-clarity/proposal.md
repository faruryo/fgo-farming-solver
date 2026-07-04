## Why

トップページの「計算履歴の推移」グラフ（`HistoryGraph`）は、履歴に「通常」と「ストック込み」の両方が混在する場合、回帰予測線が壊れるのを防ぐために**最新の種別だけを選び、もう一方のデータ点を無言で全て除外**している（`components/dashboard/HistoryGraph.tsx:22-26`）。ユーザーには「除外された」ことを示す表示もトグルもなく、履歴ページ（`/farming/history`）には存在する「通常 / ストック込み」切り替えトグルもダッシュボードには出ない。結果として、ユーザーは自分が今どちらのモードのグラフを見ているのか、そしてなぜ一部の計算履歴がグラフから消えたのかが分からない。

## What Changes

- ダッシュボードの `HistoryGraph` を、履歴を事前フィルタして片方を握りつぶす実装から、`FarmingHistoryChart` の既存の「通常 / ストック込み」トグル（`showStockToggle` / `stockFilter`）をそのまま使う実装に変更する。履歴ページと同じ見た目・挙動に統一する。
- 両方の種別が履歴に存在する場合、トグルを表示し、初期選択は最新の計算の種別とする（現行の `deriveStockMeta` のデフォルト選択ロジックは維持）。片方の種別のみの場合はトグル自体を表示しない（現行どおり）。
- トグルの活性表示（ハイライト）により、ユーザーは常に「今どちらのモードを見ているか」を一目で判別できるようにする。

## Capabilities

### Modified Capabilities
- `dashboard`: 「計算履歴の時系列表示」まわりの要件に、通常/ストック込みの表示モードを明示し切り替え可能にする要件を追加する。

## Impact

- `components/dashboard/HistoryGraph.tsx`: 事前フィルタ（データ除外）ロジックを撤去し、`FarmingHistoryChart` へフルの履歴と `showStockToggle` / `stockFilter` 制御用の state を渡すよう変更。
- `components/farming/FarmingHistoryChart.tsx`: 変更不要（既存のトグルUIをダッシュボードから再利用するのみ）。
- 影響範囲はフロントエンドのみ。API・DBスキーマの変更なし。
