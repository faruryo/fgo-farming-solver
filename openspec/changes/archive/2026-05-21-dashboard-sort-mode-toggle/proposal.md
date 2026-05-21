## Why

ダッシュボードの「周回予定クエスト (RecommendedQuest)」「達成間近の素材 (NearGoalSection)」は、ともにストームポッド消費系クエスト (冠位研鑽戦・オーディール・コール) が結果を占有しやすい構造を持つ。RecommendedQuest は area による固定優先度のため、AP半キャンペーン中も対象クエストが上位に出ず、ユーザーは半AP機会を逃す。NearGoalSection は周回数昇順だが、ストームポッド消費系クエストのみが上位に並ぶと「今日 free quest で進められる素材」が埋もれる。

逆にストームポッド消費系を表示から外すと、消費上限 (9 個) 到達によるリソース無駄が発生する。ユーザーが状況に応じて「ストームポッド消費を促す表示」と「AP半キャンペーン等を活かす表示」を切り替えられる UI が必要。

## What Changes

- 「周回予定クエスト」「達成間近の素材」のセクションヘッダ右端に、ソート基準を切り替える `ToggleGroup` (`周回数 | AP`) を導入する。
- **周回数モード (`laps`)**: 現状互換。RecommendedQuest は `冠位研鑽戦 → オーディール・コール → その他` の固定優先度、NearGoalSection は `lapsNeeded` 昇順 + 各 item に対し最小周回数のクエストを選ぶ、をそれぞれ維持する。
- **APモード (`ap`)**: 並び替えを実効 AP 基準に変える。RecommendedQuest は area 優先を外し、AP割引クエスト (`displayResult.ap < drops の元 ap`) を最上位、その他をその下、同優先度内は `lap` 降順。NearGoalSection は各 item に対しクエストを「実効 AP per drop = `quest.ap / drop_rate` 最小」で選び直し、`lapsNeeded` 昇順で並べる。
- セクションごとに `useLocalStorage` でモードを永続化する (`dashboard.recommendedQuest.sortMode` / `dashboard.nearGoal.sortMode`)。
- 初回 (LocalStorage に値が無いとき) は `useActiveCampaigns` の結果を見て、AP キャンペーンが 1 件以上有効なら `ap`、無ければ `laps` を既定値にする。
- 両セクションのツールチップ文言をモードに応じて切り替える。
- 前回の change で導入した「冠位研鑽戦 / オーディール・コール / AP半対象 を tier 1 にフラット統合する」変更は本 change の `apply` フェーズで `laps` モードのロジックに差し戻す (= 周回数モードでは現状互換に戻す)。

## Capabilities

### New Capabilities
- なし

### Modified Capabilities
- `dashboard`: 「推奨周回クエスト (RecommendedQuest)」「達成間近の素材 (NearGoalSection)」の並び替え要件にソートモードの選択肢と既定値の規約を追加する。

## Impact

- 影響コード: `components/dashboard/RecommendedQuest.tsx`, `components/dashboard/NearGoalSection.tsx`, `components/ui/toggle-group.tsx` (shadcn 追加), 必要に応じ共通 hook (`hooks/use-dashboard-sort-mode.ts` など)。
- 影響データ: LocalStorage キー 2 種 (新規)。サーバ側スキーマ・API・solver 結果は変更しない。
- 影響ユーザー: トップページ閲覧者全員。既存ユーザーの初回アクセス時は自動判定で表示順が変わる可能性があるが、トグルで戻せる。
- リスク: AP モードで NearGoalSection のクエスト選定が変わるため、過去の表示と異なるクエストが推奨されるケースが出る。ツールチップで挙動を明示する。
