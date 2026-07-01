## 1. DB マイグレーション

- [x] 1.1 `migrations/0003_farming_results_batch.sql` を作成: `ALTER TABLE farming_results ADD COLUMN batch_id TEXT;` + `CREATE INDEX IF NOT EXISTS idx_results_batch ON farming_results(batch_id);`
- [x] 1.2 `db/schema.sql` を新カラム/インデックス込みに更新(参照用スキーマの同期)
- [x] 1.3 ローカルD1へマイグレーション適用し `PRAGMA table_info(farming_results)` で `batch_id` を確認

## 2. ソルバー入力の目標B導出(取り込み導線の改修)

- [x] 2.1 `components/material/result.tsx` の `goSolver` を、buffer 焼き込みをやめ**素の目標A** `max(0, 必要数 − 所持)` を渡すよう変更(`stockIncluded=1` の URL 付与も廃止)
- [x] 2.2 `components/farming/index.tsx` の取り込み(prefill)を素のA前提に追従。`stockEnabled` を「Bも一緒に解く」フラグとして submit に反映
- [x] 2.3 `components/farming/index.tsx` の submit で、`stockEnabled=ON` のとき各素材 `目標A + buffer(item)`(`lib/quest-efficiency.ts` の `buffer` と `useStockTarget` を共有)で目標Bを導出し、`items=`(A)と `itemsStock=`(B)を `/api/solve` に送る。`B==A` のときは A のみ送る

## 3. /api/solve の2目標保存

- [x] 3.1 `app/api/solve/route.ts` で `itemsStock`(目標B)パラメータを受領
- [x] 3.2 目標B が存在し `B != A` のとき: `batch_id=uuid` を発番、`solveBoth(A)`→A行(`stockIncluded=false`)、`solveBoth(B)`→B行(`stockIncluded=true`)を `batch_id` 付きで2行 INSERT
- [x] 3.3 目標B が無い/`B==A` のとき: 従来どおり `batch_id=NULL` の1行のみ保存
- [x] 3.4 レスポンスに `id`(=目標A行)と `batchId` を含める。着地は目標A行
- [x] 3.5 nominal AP(`applyCampaigns: false`)・`quest_selection` 保存は両行とも従来仕様を維持

## 4. 履歴一覧のペア集約表示

- [x] 4.1 `app/api/farming/history/route.ts` のレスポンスに `batch_id`(と `stockIncluded`)を含める
- [x] 4.2 `app/farming/history/page.tsx` で取得済み行を `batch_id` でメモリ上グルーピングし、ペアを1カードに集約
- [x] 4.3 集約カードに「必要分」(A)と「+ストック(差分 +Δ周/AP)」(B・「ストック込み」badge)を並べて表示
- [x] 4.4 `batch_id=NULL` の行は従来どおり単独カードで表示(後方互換)

## 5. 結果ページの A/B 表示

- [x] 5.1 `app/api/farming/results/[id]/route.ts`(GET)で `batch_id` があれば兄弟行(`deleted_at IS NULL`)を取得して返す
- [x] 5.2 `app/farming/results/[id]/page.tsx` で `batch_id` 有り時に `[必要分 | +ストック]` タブ(または並置)で A/B を切替表示。`batch_id=NULL` は従来の単独表示
- [x] 5.3 計算日時・skipped_items 等の既存表示が A/B どちらでも壊れないことを確認

## 6. ペアの A/B 連動削除

- [x] 6.1 `app/api/farming/results/[id]/route.ts`(DELETE)で対象行が `batch_id` を持つ場合、`WHERE batch_id=? AND user_id=?` で両行を同時に論理削除
- [x] 6.2 単独行(`batch_id=NULL`)は従来どおり行単位削除
- [x] 6.3 所有者チェック・401/404 の既存挙動を維持

## 7. 進捗アンカーの維持確認

- [x] 7.1 進捗スナップショット/KPI/ダッシュボードが目標A(`stockIncluded=false`・nominal)を参照し続けること、目標Bが分母に入らないことを確認

## 8. モック・検証

- [x] 8.1 `mocks/history.json` / `mocks/result.json` に `batch_id` を持つペア確認用データを数件追加
- [x] 8.2 `pnpm type-check` / `pnpm lint` / 関連テスト(`lib/solver.test.ts` 等)green
- [x] 8.3 ブラウザ実機検証: goSolver の itemsStock 生成(stock-only 素材を含む)・/farming 転送・API batch/single/B==A・履歴ペア集約カード・結果ページ回帰 を `http://localhost:3000` で確認済み
