## Why

ユーザーは「どのクエストを周回すべきか」を、自分の状況に合わせて判断したい。今は効率指標がアプリ内に無く、外部スプレッドシートの「効率ポイント」を見るしかない。さらに人によって QP がもう不要・特定素材は所持十分など事情が違うため、万人共通の効率ではなく **その人にとっての効率** を出したい(例: 今フリーのストームポッド付き「冠位研鑽戦」をやるべきか)。

## What Changes

- クエストごとの **効率ポイント**(相対効率の合計 = `Σ over items of (drop_rate/effectiveAP) / (best drop_rate/effectiveAP for that item)`)を算出するコアエンジンを追加。既存 `lib/master-data/update.ts` の Relative Efficiency Score と同式で、キャンペーン AP(`lib/solver.ts` の `computeEffectiveAp`)を反映。
- 効率ポイントを **所持数(localStorage `posession`)と目標(`items`)で個人最適化**。各素材の重みを2段階(不足=1 / 余剰≤レア別しきい値=0.3 / 余剰超=0)で決め、「不足のみ/全部」「石含む/除く」のビュートグルを提供。設定パネルは作らず、所持数登録 + レア別余剰しきい値で価値を表現する。なお QP・絆はドロップデータに存在しないため効率ポイントには本質的に含まれない(「QP 不要」は自動成立)。
- 新規 **クエスト一覧/検索ページ**(`/quests`)に効率ポイント列・検索・トグル・ポッド消費/無料バッジを表示。表の近くに所持数入力モーダルへの導線を置き、未入力素材があれば入力を促す。
- **クエスト詳細**(`/quests/[id]`)に効率ポイントと素材別 contribution 内訳を追加。
- ダッシュボードの **「達成間近の素材」を所持数も加味した不足度** に拡張し、目標未設定でも所持数が少なめの素材を拾えるようにする。
- 効率の **分母を AP効率 / 周回効率(ターン数)で切替**、ピース除くフィルタ、フィルターのポップオーバー集約、冠位研鑽戦の低段位フィルタを追加。
- 報酬(QP/基本絆P/EXP)を元 CSV から抽出し、**効率ポイントへの加算(既定OFFトグル)** と、詳細での **常時表示の報酬カード** を追加。
- 所持数・必要数を **育成計算機と同じ Atlas ID 空間に統一**(drops に `atlasId` を保持、旧データは実行時補完)。
- 絆(ボンド)・夢火を所持在庫として個人最適化に効かせる本格対応は follow-up。

## Capabilities

### New Capabilities
- `quest-efficiency`: クエストの効率ポイント算出(相対効率の合計、キャンペーン AP 反映)と、所持数・目標による個人最適化、それを表示するクエスト一覧/検索ページ・詳細・ダッシュボード連携。

### Modified Capabilities
<!-- 既存 spec は無し(openspec/specs/ は空)。要件変更なし。 -->

## Impact

- 新規: `lib/quest-efficiency.ts`(+ テスト)、`app/quests/page.tsx`、`components/quests/`(一覧テーブル・所持数モーダル)。
- 変更: `app/quests/[id]/page.tsx`(効率ポイント表示)、`components/dashboard/NearGoalSection.tsx`(所持数加味)。
- 再利用: `lib/solver.ts`(`computeEffectiveAp`)、`lib/quest-consumes-pod.ts`、`hooks/use-pod-free-quests.ts`、`hooks/use-drops.ts`、`useLocalStorage`(`posession` は `hooks/use-cloud-sync.ts` の KEYS に既存登録のためクラウド同期は自動)、`components/material/result-table.tsx` の所持数入力 UI。
- データ依存なし(既存ドロップデータ・所持数データのみ)。絆/夢火対応は将来 `lib/master-data/update.ts` にクエスト報酬抽出の追加が必要。
