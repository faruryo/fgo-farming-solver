## 1. 読み側の安全弁（独立して効く）

- [x] 1.1 `lib/progress/tier.ts` の `detectNewServants` で `past == null` のとき `[]` を返すよう修正する。
- [x] 1.2 `detectNewServants` のユニットテストを追加: `past=null` で 0 件、`past` に `disabled:true` のサーヴァントが居て `current` で `disabled:false` の場合のみ検出されることを確認。

## 2. ソルバー実行時のフル状態スナップショット保存（保存側）

- [x] 2.1 スナップショット保存用エンドポイント（`state_snapshots` のみへ日次上書き、cloud KV は触らない）を用意する。`lib/progress/snapshot.ts` の `saveSnapshot` を再利用し、`{ storage: { ...KEYS } }` 形（CloudData 互換）を受け取る。ログイン必須・`user_id` で分離。→ `app/api/progress/snapshot/route.ts`（material 欠落時は 204 で no-op）。
- [x] 2.2 `components/farming/index.tsx` の `handleSubmit` で、計算成功（`{id}` 受領）時に `KEYS`（`material`, `material/result`, `posession`, `items`, `quests`）の localStorage 全体を 2.1 のエンドポイントへ送信する。fire-and-forget（失敗しても結果遷移をブロックしない、エラーはログ）。→ `lib/progress/snapshot-client.ts` の `saveProgressSnapshot()`。
- [x] 2.3 `app/api/solve/route.ts` のサーバ側 `saveSnapshot({ items, quests })` 呼び出しを撤去する（`farming_results` の INSERT は維持）。

## 3. 検証

- [x] 3.1 ログイン済みの実ブラウザで計算実行 → ローカル D1 `state_snapshots` に `material` 入りフル状態が保存されることを確認済み（行 `102899322868388443995:2026-06-02`, data長 191,885B, `storage.material` 458エントリ, items/quests 同梱）。日次キー `userId:YYYY-MM-DD` も正しい。
- [x] 3.2 結果ページの進捗パネルがクリーンに描画され、幻のAP（全員新規 457体 +13,095,042）が出ないことを視認（dev mock の first_time シナリオ、TIER: NONE）。`detectNewServants` の null 安全弁はユニットテストで網羅済み。
- [x] 3.3 `pnpm run type-check` と `pnpm run lint` を通す。（+ `vitest run lib/progress/` 全 PASS）

## 4. 仕様反映

- [ ] 4.1 実装完了後、`openspec archive progress-snapshot-include-material` で `openspec/specs/sync` と `openspec/specs/progress-visualizer` に変更を反映する。
