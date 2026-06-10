# Tasks: stable-short-ids

## 1. 純粋モジュール（TDD）

- [x] 1.1 `lib/master-data/stable-ids.ts` を新規作成: `IdRegistry` 型、`questKey`、`emptyRegistry`、`registryFromPrevious`、`assignQuestIds`、`assignItemId`
- [x] 1.2 `lib/master-data/stable-ids.test.ts` を作成:
  - 空レジストリで現行位置採番と完全一致（パリティ）
  - エリア挿入で既存プレフィックス不変・新エリアは空きプレフィックス
  - エリア内クエスト挿入で既存ID不変・新規は max+1
  - 削除→再追加でIDが再利用されない（墓標、2世代ラウンドトリップ）
  - クエスト名リネーム（同 aaQuestId）でID維持/エリア改名で新プレフィックス
  - Daily は常に `'0?'`・セクション不整合プレフィックスは再利用しない
  - index > 35 で4文字ID・`slice(0,2)` プレフィックス維持
  - `registryFromPrevious` が `id_registry` 無し旧ペイロードから公開IDを全ピン留め
  - アイテム: atlasId 再利用・positional 衝突時の intercept 内 max+1・空レジストリパリティ

## 2. 変換パイプライン接続

- [x] 2.1 `lib/master-data/types.ts` に `id_registry?: IdRegistry` を追加
- [x] 2.2 `lib/master-data/update.ts`: opts に `previous` を追加し、アイテム採番・クエスト採番ブロック（L503-521）を stable-ids へ置換、戻り値に `id_registry` を同梱
- [x] 2.3 `lib/master-data/validation.ts`: ID一意性・Dailyプレフィックス形状・drop_rates 参照整合の検証を追加
- [x] 2.4 `lib/master-data/update.test.ts` に E2E ケース追加（前回ペイロード + クエスト/エリア挿入CSV → ピン留め確認・registry 同梱・drop_rates remap 整合）、validation テスト拡張

## 3. ワーカー / スクリプト

- [x] 3.1 `updater-worker/index.ts`: `readWaveCountSeed` を `readPreviousMasterData` に置換し `previous` を渡す。reused/new 件数とレジストリサイズのログ追加
- [x] 3.2 wave-count seed 導出を純粋ヘルパー `waveCountSeedFrom(previous)` として `lib/master-data/` に移動
- [x] 3.3 `scripts/update-data.ts`: 既存 `mocks/all.json` を `previous` として渡す（`scripts/bench-updater.ts` も同様に）
- [x] 3.4 `lib/get-local-items.ts`: atlasId ベースのフォールバック解決を追加

## 4. 検証

- [x] 4.1 `pnpm test` / `pnpm run type-check` / `pnpm run lint` 通過
- [x] 4.2 `scripts/update-data.ts` でモック再生成し、既存 `mocks/all.json` とのID差分がゼロであることを確認
- [x] 4.3 `openspec validate stable-short-ids` 通過
- [ ] 4.4 デプロイ後、初回 cron ログで `reused ≒ 297, new = フィルタ外残数` を確認（observability）
- [ ] 4.5 翌日以降の cron でIDが不変であることを本番 `/api/drops` のスナップショット比較で確認
