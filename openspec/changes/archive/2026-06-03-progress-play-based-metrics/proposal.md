## Why

マシュ進捗パネルの見出し「AP −X」(`deltaApAdjusted`)は、ソルバーに渡す `items` が net(目標−所持)であるため「周回して所持が増えた(進捗)」と「目標を増やした(残りが増える)」を区別できず、さらに個数プロキシ(`deltaApRaw`)と実AP(`newServantOffsetAp`)を単位無視で合算している。結果ページの2モード(消費AP最小/周回数最小)で同じ値が出るなど挙動が破綻しており、「ユーザーが実際にプレイして進んだ量」を表せていない。

## What Changes

- **BREAKING**: 旧進捗指標 `deltaApRaw` / `deltaApAdjusted` を見出しの実APとして表示するのを廃止。
- マシュ進捗を「実プレイに基づく進捗」へ再設計し、次の2指標で表示する:
  1. **育成総量** — `computeServantGrowthDeltas` の合計(育成で縮んだ目標レンジ)+ 主なサーヴァント。
  2. **アイテム入手による残りの減少** — 目標を現在で固定して再ソルブし、`solve(現在目標−過去所持) − solve(現在目標−現在所持)` の `total_ap`/`total_lap` を減少AP/減少周回として算出(費用は減少APから換算)。目標を両辺「現在」に固定するため目標増加の影響は構造的にゼロ。
- マシュ進捗パネルを**ダッシュボードの「あなたの育成進捗」セクション(達成率円グラフの上)へ移設**。期間タブは廃止し、**存在する最古のスナップショット(古い順に 1ヶ月前→1週間前→前回)を1つだけ基準**に単一比較を表示する。
- **結果ページ(/farming/results/[id])から壊れた共有マシュパネルを撤去**し、代わりに既存の履歴グラフ(`HistoryGraph` = 計算履歴の消費AP推移)を設置。モード別スタッツ(周回数/消費AP/費用)はそのまま。
- マシュのセリフ選択(`mashu-messages`)の `deltaApAdjusted` 依存箇所を新指標へ更新。

## Capabilities

### New Capabilities
（なし）

### Modified Capabilities
- `progress-visualizer`: 進捗指標の定義を「目標素材個数の差分プロキシ(deltaApRaw/deltaApAdjusted)」から「育成総量 + アイテム入手による残りAP/周回数の減少(目標固定の再ソルブ)」へ変更。マシュ進捗パネルの表示先を結果ページからダッシュボードへ移設。結果ページは履歴グラフ表示に変更。「目標増加のポジティブ表示」要件は新指標(目標固定により目標増加が値に影響しない)に置き換え。

## Impact

- **UI**: `components/dashboard/ProgressSection.tsx`(マシュ進捗を上部に統合)、`app/page.tsx`(配置)、`components/farming/result.tsx`(マシュパネル撤去・履歴グラフ設置)。
- **進捗ロジック**: `lib/progress/summary.ts`(新指標の算出)、`lib/progress/types.ts`(`PeriodSummary` のフィールド更新)、`lib/progress/mashu-messages.ts`(セリフ選択基準の更新)、`lib/progress/diff.ts`(過去 `posession` 抽出)。
- **ソルバー**: `lib/solver.ts` をクライアント/サーバで再利用(現在目標×過去所持/現在所持の2回ソルブ)。スキーマ変更なし。
- **データ**: `state_snapshots` は読み取りのみ。localStorage / クラウド同期(`material/result`・`posession`・`material`)は破壊しない。
- **既存テスト**: `lib/progress/summary.test.ts` ほか進捗系テストを新指標に合わせて更新。
- **非対象**: DB スキーマ変更、結果ページのモード別「前回計算比」追加(今回は履歴グラフで代替)。
