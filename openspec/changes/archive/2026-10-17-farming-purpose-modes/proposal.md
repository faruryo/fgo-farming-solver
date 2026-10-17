## Why

現在の「不足のみ／全部」と「ストック込みON／OFF」は、計算上の条件をそのまま見せているため、ユーザーが周回目的を選びにくい。また、ストック設定は複数ページの数値へ影響するのに、各ページを開かなければ変更内容と計算式を確認できない。

周回目的をユーザーストーリーに基づく3モードへ整理し、どの画面からでも変更・確認できるようにする。あわせて、育成不足では必要総数より現在庫の薄さを優先する。

## What Changes

- **BREAKING** `shortageOnly` と `stockEnabled` の組み合わせを、グローバルな周回目的 `training | reserve | all` へ置き換える。
- 「今の育成を進める」は育成必要数未満の素材だけを対象とし、`1 + buffer / (owned + buffer)` の低在庫倍率を適用する。
- 「新規サーヴァントに備える」は `owned < max(required, buffer)` の素材を同じ低在庫倍率で評価する。現在の `required + buffer` は廃止する。
- 「素材全体の効率を見る」はクエスト効率の全素材を重み1で評価する。有限の必要数を定義できないため、周回ソルバー・配布アドバイザー・進捗計算には架空の目標を渡さない。
- ハンバーガーメニュー内に現在の周回目的と変更UIを常設し、変更を対応する全画面へ即時反映する。各対象画面にも現在モードを表示し、その場で同じ変更UIを開けるようにする。
- モード選択UIから「計算方法を見る」を開き、モード別の対象素材、低在庫倍率、AP効率／周回効率、報酬加算をダイアログで確認できるようにする。新しい説明ページは追加しない。
- 既存のストックバッファー編集は残し、「目標への上乗せ数」から「レアリティ・カテゴリごとの在庫基準」へ意味を変更する。
- 既存保存値を移行する。`stockEnabled=true` は `reserve`、それ以外は `training` とし、クエスト効率の「全部」が選ばれていた場合だけ `all` を優先する。

## Capabilities

### New Capabilities

- `farming-purpose-mode`: グローバルな周回目的、ナビゲーションからの切替、計算方法ダイアログ、保存値移行を定義する。

### Modified Capabilities

- `quest-efficiency`: 3モードの対象判定と低在庫倍率、一覧・詳細への即時反映へ変更する。
- `solver`: ストック込みの `required + buffer` を廃止し、対応モードでは `max(required, buffer)` を目標に使う。
- `material-selection-advisor`: 配布素材の評価対象をグローバルな周回目的と同じ不足定義へ変更する。
- `progress-visualizer`: 前進判定で使う目標をグローバルな周回目的と整合させる。

## Impact

- 主な変更箇所は `lib/quest-efficiency.ts`、`hooks/use-stock-target.ts`、`hooks/use-quest-efficiency-options.ts`、`components/common/nav.tsx`、クエスト効率の一覧・詳細、素材結果・配布アドバイザー、周回ソルバー取り込み、進捗換算である。
- `stockBuffer` と既存のカテゴリ・レアリティ判定は再利用する。新しい依存関係や本番データ書き込みは追加しない。
- 保存キーを1つ追加してクラウド同期対象にする。旧 `efficiency/stockEnabled` と `quests/efficiency/shortageOnly` は移行の読み取りに限って残す。
