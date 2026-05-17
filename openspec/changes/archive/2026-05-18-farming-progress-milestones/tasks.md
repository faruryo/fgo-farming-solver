> 各セクション ＝ 1コミット相当。上から順に実装することで型チェックを通しながら進められる。

## 1. D1 スキーマ追加

- [x] 1.1 D1 に `state_snapshots` テーブル（`id` / `user_id` / `data` / `created_at`）を新規追加。

## 2. `/api/cloud` POST にスナップショット保存

- [x] 2.1 `lib/progress/snapshot.ts` に `saveSnapshot` ヘルパーを実装（同日 `user_id` の重複は `UPDATE`、なければ `INSERT`）。
- [x] 2.2 `/api/cloud` POST 処理から `saveSnapshot` を呼び、KV 保存と並行でスナップショットを記録する。

## 3. `/api/solve` にスナップショット保存

- [x] 3.1 `/api/solve` から `saveSnapshot` を呼び、ソルバー成功時にも同日上書きでスナップショットを記録する。

## 4. snapshot 取得関数

- [x] 4.1 `lib/progress/snapshot.ts` に「前回」「1週間前」「1ヶ月前」に最も近い snapshot を効率的に取得する関数を実装。存在しない期間は `null` を返す。

## 5. 高難易度クエスト アクセス可否推測

- [x] 5.1 高難易度クエスト（オーディール・コール、冠位戦）の代表クエストIDを定数化し、`checkedQuests` から包含判定する `hasHighDifficultyAccess` 関数を実装。

## 6. rarity 別 AP 推定値 サンプリング+solver計算

- [x] 6.1 rarity（1〜5）ごとに代表サーヴァントを複数体ランダム選択するロジックを実装。
- [x] 6.2 サンプルサーヴァントを「素体（`disabled`）→ 育成完了（共通目標達成）」にするための必要 AP を solver で算出するロジックを実装。
- [x] 6.3 サンプル結果を平均または中央値に集約する処理を実装。

## 7. rarity-AP テーブル生成とキャッシュ

- [x] 7.1 アクセス可否で 2 セット（基本 / 高難易度あり）の rarity-AP テーブルを生成する関数を実装。
- [x] 7.2 事前計算結果をモジュールスコープでメモ化し、サーバ起動後に一度だけ計算する仕組みを実装（master-data 更新時の再計算は将来の TODO とする）。

## 8. スナップショット差分ユーティリティ + 共通型定義

- [x] 8.1 過去スナップショットと現在状態から `deltaAp` / 入手済みサーヴァント差分 / 成長差分 / 目標差分を算出するためのユーティリティと共通型（`ProgressSummary` ほか）を `lib/progress/diff.ts` に実装。

## 9. 新規入手サーヴァント検出 + APオフセット + tier判定

- [x] 9.1 新規入手サーヴァント検出（chaldea state の `disabled: true` → `false` 変化）を実装。
- [x] 9.2 rarity 別 AP 推定値テーブルを使って `deltaAp` にオフセットを適用し、純粋進捗を算出するロジックを実装。
- [x] 9.3 自然回復AP（`elapsedMinutes / 5`）を基準とした 4 tier 判定（`large` / `medium` / `small` / `none`）を実装。

## 10. サーヴァント成長度差分 + 目標増加判定

- [x] 10.1 サーヴァント成長度（スキル+アペンドレベル合計）差分を計算する。
- [x] 10.2 目標 `total_ap` が増加した場合の「より高い目標」判定を実装。

## 11. サマリーデータ生成 + フォールバック判定

- [x] 11.1 「進捗ゼロ」「比較対象なし」「初回」のフォールバック判定ロジックを実装。
- [x] 11.2 進捗報告画面に渡すサマリーデータ（tier・各指標・フォールバックフラグ等）を生成するエントリポイントを実装。

## 12. `/api/progress` エンドポイント

- [x] 12.1 `/api/progress` を新規作成し、比較期間別の過去スナップショットと、11.2 で組み立てた進捗サマリーを返す。

## 13. ProgressReportModal シェル + 期間切替タブ

- [x] 13.1 shadcn/ui の Dialog をベースにした `ProgressReportModal` を新規作成（中身は空でも可）。
- [x] 13.2 比較期間（前回 / 1週間前 / 1ヶ月前）を切り替えるタブまたはボタンを実装。

## 14. tier 演出 + 進捗内容ビジュアライズ

- [x] 14.1 tier 別（`large` / `medium` / `small` / `none`）の色とサイズによる達成感演出を実装。
- [x] 14.2 獲得素材・不足数減少・サーヴァント成長度を可視化するUIを実装。

## 15. ServantPraise コンポーネント

- [x] 15.1 マシュ画像（Atlas Academy CDN）の表示コンポーネント `ServantPraise` を実装。

## 16. マシュメッセージ辞書 + selector

- [x] 16.1 進捗 tier × 進捗種別 のマシュメッセージ辞書を実装。各組み合わせごとに最低 3〜5 種のバリエーションを用意し、ランダム選択。口調は [appmedia の引用リスト](https://appmedia.jp/fategrandorder/75727618) を参考に統一。
- [x] 16.2 進捗ゼロ・初回・比較対象なし用の「登録お疲れ様」系メッセージを実装し、selector に組み込む。

## 17. 結果ページに進捗モーダルを配線

- [x] 17.1 ソルバー完了 → 結果ページ表示時に `/api/progress` から進捗データを取得し、`ProgressReportModal` を表示する。
- [x] 17.2 比較期間切り替え時に該当データを再取得（または初回ロード時に全期間取得）。 ※ `/api/progress` が初回ロードで 3 期間まとめて返すため、タブ切替はクライアントステートのみで完結。

## 18. ゼロ進捗 / 欠損スナップショット フォールバック統合

- [x] 18.1 「進捗ゼロかつ初回でもない」ときも「登録お疲れ様」モードで表示するガードを実装。 ※ `summary.fallback === 'zero_progress'` を `ProgressReportContent` と `selectMashuMessage` の両方が分岐ハンドリング。
- [x] 18.2 比較対象スナップショットが存在しない場合の「お疲れ様」フォールバック表示を統合。 ※ `buildPeriodSummary` が常に PeriodSummary を返し、`fallback: 'no_snapshot_for_period' | 'first_time'` のとき `selectMashuMessage` がお疲れさまメッセージを選択。
