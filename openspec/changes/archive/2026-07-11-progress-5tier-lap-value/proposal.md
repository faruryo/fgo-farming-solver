# Proposal: progress-5tier-lap-value

## Why

進捗tierの主指標(LP再ソルブによる残りAP減少)は、目標が大きいユーザーほど各素材の増分が「他素材のついで」として割引評価され(限界価格 7,192AP vs 素材単価換算 19,222AP)、りんご投入・イベント2開催の活発な月でも small と判定される。また、ストックバッファ(`effectiveRequired` = 育成必要数+バッファ)を全farming画面が共有しているのに進捗tierだけが育成目標のみを参照しており、バッファ埋めの周回(実測+373周相当)が評価から漏れる。労い(モチベーション)装置としての目的に対して物差しが合っていない。

## What Changes

- **tier主指標を「周回換算の前進」に変更**: バッファ込み実効不足(`effectiveRequired`)の解消ぶんを、素材ごとに「選択クエスト内の最高ドロップ率」(無ければ全クエスト率)で周回数に換算して合算。LP再ソルブは tier 判定から外れる。消費のクランプ中立(過去所持下限)は維持。
- **BREAKING: tier を4段階→5段階に拡張**: `ProgressTier` に最上位 `legendary`(仮称)を追加。しきい値は1日あたり推定周回数で 0 / >0 / ≥5 / ≥15 / ≥60(small/medium/large/legendary)。ボックス・レイド全力月だけが最上位に届く設計。
- **労力軸の新設**: 全獲得素材(余剰込み・育成投入は含まない)の周回換算を「推定活動量 約N周相当」として表示し、マシュのメッセージ選択を2軸(方向性tier×労力)で修飾する。
- **前進の表示を周回主役に変更**: 「目標への前進 +N周ぶん」(AP相当・費用は併記)。ツールチップの計算根拠説明も周回換算に更新。
- **tier=0時の補完**: 労力(獲得の周回換算)で同じラダーを適用。ただし `legendary` は不足直結(方向性)限定。
- マシュメッセージ群・視覚演出(色/サイズ)に `legendary` 段階を追加。

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `progress-visualizer`: tier判定要件(5段階・周回換算・バッファ込み目標・しきい値)、目標への前進要件(算出式をLP再ソルブから独立周回換算へ、表示を周回主役へ)、素材スループット要件(労力軸=獲得のみの周回換算へ再定義)、マシュフィードバック要件(legendary+2軸修飾)、視覚演出要件(5段階対応)。

## Impact

- `lib/progress/`: 周回換算モジュール新設(単価解決・方向性/労力の算出)、`classifyTier` 5段階化、`types.ts` の `ProgressTier` 拡張、`finalize-baseline.ts` の判定組み替え。`compute-reduction.ts`(LP再ソルブ)は tier/表示経路から外れる(削除候補)。
- `lib/quest-efficiency.ts` の `effectiveRequired`/`resolveStockBuffer` を進捗側から参照(D3整合)。
- `hooks/use-progress-report.ts`: drops+localStorage(`efficiency/stockBuffer`・`efficiency/stockEnabled`・legacy `efficiency/surplusThreshold`)から新指標を算出。
- `components/farming/progress-report-content.tsx` / `ServantPraise.tsx` / `mashu-messages.ts`: 表示・セリフ・演出の5段階/2軸対応。
- `locales/ja.json` / `en.json`: 表示文言・ツールチップ更新。
- サーバAPI(`/api/progress`)・スナップショット形式・D1: 変更なし。
- 既存の消費中立クランプ(progress-consumption-neutral-reduced-ap)の考え方は周回換算側に引き継ぐ。
