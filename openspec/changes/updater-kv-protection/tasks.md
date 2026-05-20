## 1. KV 保護バリデーション

- [x] 1.1 `lib/master-data/validation.ts` を新設し、`validateMasterData` / `validateDashboardMeta` を実装
- [x] 1.2 `lib/master-data/validation.test.ts` で空配列・部分破損・正常ケースを網羅
- [x] 1.3 `updater-worker/index.ts` の `updateDrops` / `updateDashboardMeta` で `put` 直前にバリデーション、失敗時は警告ログを出して書き込みスキップ
- [x] 1.4 `updateMasterData` を `updateDrops` / `updateDashboardMeta` の 2 関数に分離し、try/catch を関数単位に縮小

## 2. HTTP エンドポイント廃止

- [x] 2.1 `updater-worker/index.ts` から `fetch` ハンドラを削除し、`scheduled` のみを export
- [x] 2.2 `deployment_guide.md` の手動更新説明を「CF ダッシュボードの Trigger Cron」に書き換え

## 3. spec 更新

- [x] 3.1 `openspec/specs/master-data/spec.md` に「失敗・空応答時の KV 保護」要件を ADDED で追加

## 4. 検証

- [x] 4.1 `pnpm run type-check` 成功
- [x] 4.2 `pnpm exec vitest run lib/master-data` 成功（validation テスト含む）
- [x] 4.3 `openspec validate --specs` で `spec/master-data` が通過することを確認
- [ ] 4.4 デプロイ後、Observability で `Refusing to overwrite` ログが空応答時に観測されることを確認
