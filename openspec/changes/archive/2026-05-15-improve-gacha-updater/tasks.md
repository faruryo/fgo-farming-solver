## 1. バナー URL バグ修正

- [x] 1.1 `lib/master-data/update.ts` の `fetchDashboardMeta()` でバナー URL を `/JP/Banner/summon_${id}.png` から `/JP/SummonBanners/img_summon_${id}.png` に修正
- [x] 1.2 修正後の URL が HTTP 200 を返すことを curl で確認

## 2. ガチャフィルタリング改善

- [x] 2.1 アクティブガチャのフィルタ条件を `g.pickupId > 0` から `g.type === 'stone' || g.type === 'chargeStone'` に変更
- [x] 2.2 フレポ召喚（`type: 'friendPoint'`）が除外されることをローカルで確認

## 3. イベント取得の一括化

- [x] 3.1 `basic_event.json` + 個別 `/nice/JP/event/{id}` フェッチを `export/JP/nice_event.json` の一括取得に変更
- [x] 3.2 イベントフィルタロジック（バナー有り、期間内）をメモリ内フィルタに書き直す
- [x] 3.3 `DashboardEvent` の `drops` フィールドマッピングが正しく動作することを確認

## 4. モック自動生成スクリプト

- [x] 4.1 `scripts/update-mock-dashboard.ts` を新規作成（`fetchDashboardMeta()` を呼び出し `mocks/dashboard.json` に書き出す）
- [x] 4.2 `package.json` に `"update:mock:dashboard": "tsx scripts/update-mock-dashboard.ts"` を追加
- [x] 4.3 `pnpm update:mock:dashboard` を実行して `mocks/dashboard.json` が正しく更新されることを確認

## 5. updater-worker テストコード

- [x] 5.1 `lib/master-data/update.test.ts` に `fetchDashboardMeta()` の出力バリデーションテストを追加（JSON として有効、必須フィールドが存在する、バナー URL が正しいパターンに一致する）
- [x] 5.2 ガチャフィルタリングのユニットテストを追加（`type: 'friendPoint'` が除外される、`openedAt/closedAt` の期間フィルタが正しく機能する）
- [x] 5.3 バナー URL 生成のユニットテストを追加（`/SummonBanners/img_summon_` パターンであることを検証）

## 6. GachaSection — ピックアップサーヴァント詳細リンク

- [x] 6.1 GachaSection のピックアップサーヴァント顔アイコン・名前を `/servants/{id}` へのリンクにする
