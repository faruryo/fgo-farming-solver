## Context

`FarmingHistoryChart`（`components/farming/FarmingHistoryChart.tsx`）はすでに「通常 / ストック込み」を切り替えるトグルUI（`showStockToggle` prop）と、両種別の混在有無・デフォルト選択を導出するヘルパー（`deriveStockMeta`, `isStock`）を持っている。履歴ページ（`app/farming/history/page.tsx`）はこれをそのまま使い、トグル付きで両種別を行き来できる。

一方ダッシュボードの `HistoryGraph.tsx` は同じコンポーネントを使いながら、`showStockToggle` を渡さず（デフォルト `false`）、代わりに呼び出し側で `history` を事前に片方の種別だけへフィルタしてから渡している。これは「簡易表示なのでトグルは出さない」という意図的な設計判断だったが、結果としてユーザーから見ると理由不明の欠損データになっている。

## Goals / Non-Goals

**Goals:**
- ダッシュボードの履歴グラフが「今どちらの種別を表示しているか」を常に視認できるようにする。
- 両種別が存在する場合、ページ遷移せずにダッシュボード上で切り替えられるようにする。
- 履歴ページと挙動・見た目を統一し、実装の重複や分岐を増やさない。

**Non-Goals:**
- 2種別を1つのグラフ上に同時プロットする（回帰予測が破綻するため引き続き非対応。既存の「排他選択」方針は維持）。
- `FarmingHistoryChart` 自体のUI・ロジック変更（既存のトグルをそのまま再利用する）。
- 用語統一（内部の `buffer` 命名と UI の「ストック込み」表記の乖離）は本変更のスコープ外。将来の別提案で扱う。

## Decisions

- **`HistoryGraph` から事前フィルタを撤去し、`showStockToggle` + `stockFilter` state を導入する。**
  - Before: `HistoryGraph` が `deriveStockMeta` の結果で `history` を絞り込んでから `FarmingHistoryChart` に渡す（トグル非表示）。
  - After: `HistoryGraph` はフル `history` をそのまま渡し、`useState<StockFilter>` で選択中の種別を保持。初期値は `deriveStockMeta(history).defaultFilter`（＝最新履歴の種別、既存ロジックを流用）。`bothExist` のときのみ `showStockToggle` を `true` にする。`FarmingHistoryChart` へは `history.filter(h => isStock(h) === (stockFilter === 'stock'))` した配列を渡す（絞り込み自体はダッシュボード側に残すが、"なぜ絞られているか" がトグルで自明になる）。
  - Alternative（不採用）: `FarmingHistoryChart` 内部でフィルタを完結させる（`history` をフルで渡し `stockFilter` も内部 state 化）。→ 履歴ページ側は絞り込み結果を一覧表示と同期させる必要があり `controlled` にする設計（コメント参照）のため、コンポーネント全体を non-controlled に変えるのは影響範囲が広く不採用。ダッシュボード側だけ薄いラッパー state を持たせるほうが最小差分。
- **トグルの表示条件・デフォルト選択ロジックは変更しない。** 既存の `deriveStockMeta` をそのまま再利用し、「両方揃わなければトグルを出さない」「デフォルトは最新履歴の種別」という既存UXの前提を崩さない。

## Risks / Trade-offs

- [Risk] ダッシュボードにトグルが増えることで「簡易表示」という位置づけがやや重くなる → Mitigation: トグルは両種別が存在するときのみ出現し、単一種別の大多数のユーザーには従来と見た目が変わらない。
- [Risk] 5px単位の限られた横幅（モバイル）でトグル+期間フィルタ+タブが並び窮屈になる可能性 → Mitigation: 履歴ページで同じレイアウト（`FarmingHistoryChart` の `flex-wrap`）がすでにモバイル対応済みのため、同一コンポーネント再利用で追加対応不要。ブラウザ実機確認で最終確認する。

## Migration Plan

- DBスキーマ・APIの変更なし。フロントエンドのみの変更のため、通常のデプロイで即時反映。ロールバックは通常の revert のみで良い。
