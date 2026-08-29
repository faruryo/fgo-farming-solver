## Why

`/material/result`(アイテム必要数ページ)には「全て / 不足 / ストック不足」の3タブ表示フィルタが実装済みだが、3つ目の「ストック不足」タブは `stockEnabled`(⚙ストック目標ダイアログで個別にONにする余剰在庫バッファ機能。デフォルトOFF)がONのときしか描画されない。未設定ユーザーには「全て / 不足」の2択しか見えず、育成必要数は満たしていても周回効率のための余剰ストックが足りないアイテムを絞り込む手段がない。ユーザーからも「全て/不足は選べるが、ストックが足りないアイテムをフィルターできない」と報告があった。

## What Changes

- 「ストック不足」タブを `stockEnabled` の値に関わらず常時表示する。
- `stockEnabled=OFF` の状態でこのタブをクリックしたら、`stockEnabled` を自動でON にする(既存の `useStockTarget` の `setStockEnabled` を呼ぶ)。ストック目標の各カテゴリ×レアのバッファ値は未設定分について既存の `resolveStockBuffer` デフォルトがそのまま使われる(新規の数値入力は要求しない)。
- ⚙ ストック目標ダイアログを開かなくても、ワンクリックでストック不足の絞り込みと(既存仕様どおりの)ストック込み副表示が有効になる。
- ⚙ ストック目標ダイアログ経由での手動 ON/OFF・バッファ編集の既存動作は変更しない。

## Capabilities

### New Capabilities
(なし)

### Modified Capabilities
- `material`: `/material/result` のストック不足フィルタ(3タブ目)の表示条件を「`stockEnabled=ON` のときのみ表示」から「常時表示、選択時に `stockEnabled` を自動ONにする」へ変更する。

## Impact

- `components/material/result.tsx`: フィルタタブの描画条件(`{stockEnabled && (...)}`)と `onClick` ハンドラ(`setFilterMode('stock')` に加えて必要なら `setStockEnabled(true)` を呼ぶ)。
- `hooks/use-stock-target.ts`: 変更なし(既存の `setStockEnabled` をそのまま呼び出す)。
- `openspec/specs/material/spec.md`: 「育成計算機結果のストック込み不足の副表示」要件のトリガー条件に関する記述、および新規の「ストック不足フィルタの常時表示と自動ON」要件を追加。
