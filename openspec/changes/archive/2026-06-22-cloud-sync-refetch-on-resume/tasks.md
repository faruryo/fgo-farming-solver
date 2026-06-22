## 1. 判定ロジックの純関数抽出とリグレッションテスト

- [x] 1.1 `lib/cloud-sync/decision.ts` を新設し、`useCloudSync` から判定ロジックを純関数として抽出する（`window` / `localStorage` 非依存。design D5）: `decideSyncAction(local, cloud)`、`shouldRefetchOnResume(lastFetchAt, now, cooldownMs)`、`isResumeTrigger(eventType, { visibilityState, persisted })`、メタデータ遷移（`markDirty` / `metadataAfterApply` / `metadataAfterSave`）。
- [x] 1.2 `lib/cloud-sync/decision.test.ts` に `decideSyncAction` のリグレッションテストを書く: クリーン/ダーティ × クラウド新/旧/同時刻(±1000ms 猶予境界) × 同一/別デバイスの判定マトリクス全組み合わせ（既存スペックの「自動ロード」「コンフリクト検出」シナリオ + 今回の「未同期変更の保護」を網羅）。
- [x] 1.3 同テストに `shouldRefetchOnResume` のケースを追加: クールダウン内はスキップ / 経過後は必ず再取得 / 初回（`lastFetchAt` なし）は実行。
- [x] 1.4 同テストに `isResumeTrigger` のケースを追加: `visibilitychange` は visible のみ true / `pageshow` は `persisted === true` のみ true（通常ロードは false）。
- [x] 1.5 同テストにメタデータ遷移のケースを追加: 適用後はクリーン（`updatedAt === lastSyncedAt`、`deviceId` はローカル維持）/ ローカル編集後はダーティ / 保存後はクリーン。
- [x] 1.6 `useCloudSync` を抽出関数を呼ぶ薄いグルーに書き換え、判定の二重実装を残さない。`pnpm test` で既存テスト含め全件通す。

## 2. applyData の表示伝播（前提条件）

- [x] 2.1 `hooks/use-cloud-sync.ts` の `applyData` で、書き込んだ各キーについて `new CustomEvent('ls-sync', { detail: { key } })` を dispatch する（detail なし dispatch は `useLocalStorage` に無視されるため置き換え。`isApplyingCloudDataRef` フラグ中に同期実行されることを維持し、クリーン状態を保つ）。
- [x] 2.2 `useLocalStorage` 側で再読込 → persist effect が `json === oldJson` で no-op になること（書き戻しループが起きないこと）をローカルで確認する。`material` の `onGet: mergeState` による1回の書き戻しは許容（design D4）。

## 3. 直書きキーの変更追跡

- [x] 3.1 `components/material/material-calc-button.tsx:26` の `material/result` 書き込み直後に `ls-sync`(detail 付き) を dispatch する。
- [x] 3.2 `components/material/index.tsx:347` の `material/result` 書き込みにも同様の dispatch を追加する。
- [x] 3.3 `components/farming/index.tsx:216` の `farming/results` 書き込みにも同様の dispatch を追加する（`excludedQuests` の一回限り移行 `:110` は意図的に対象外）。

## 4. 再取得トリガーの実装

- [x] 4.1 `hooks/use-cloud-sync.ts` にモジュールスコープの直近フェッチ時刻（全インスタンス共有）を追加し、`shouldRefetchOnResume`（クールダウン ~5 秒）ガード付きラッパ `refetchIfStale` を `useCallback` で実装する（`handleSave` 後の `fetchCloudData` には適用しない）。
- [x] 4.2 `useEffect` で `document` に `visibilitychange` リスナーを登録し、`isResumeTrigger` が true のとき `refetchIfStale` を呼ぶ。
- [x] 4.3 同 `useEffect` で `window` に `pageshow` リスナーを登録し、`isResumeTrigger` が true（`persisted === true`）のときのみ `refetchIfStale` を呼ぶ。
- [x] 4.4 cleanup で両リスナーを確実に解除する。依存配列は `fetchCloudData`（identity 変化で張り直し）。

## 4.5. 同期エンジンの常駐化（実機検証で発見した主因の修正）

- [x] 4.5.1 `components/cloud/sync-engine.tsx` に headless の `CloudSyncEngine`（`useCloudSync()` を呼び `null` を返す）を新設する（design D6）。
- [x] 4.5.2 `app/providers.tsx` の `SessionProvider` 内に `CloudSyncEngine` をマウントする。
- [x] 4.5.3 ドロワーを開かない状態で、初回フェッチ・変更追跡（dirty マーク）・再開リスナーが動作することをブラウザで確認する。

## 5. 検証

- [x] 5.1 `pnpm test`・`pnpm run type-check`・`pnpm run lint` を通す。
- [x] 5.2 ブラウザ実機確認（[[feedback_verify_before_push]]）: オートシンク有効・クリーン状態で、タブ非表示→可視化により最新クラウドデータが localStorage と**表示中のフォーム state の両方**に反映されることを確認する（dev では未ログイン時 `fgo_mock_cloud_data` のモック経路でも検証可）。
- [x] 5.3 自動ロード適用後にフォームを1箇所編集し、保存内容が「適用済みデータ + 編集」になること（古い state の巻き戻しが起きないこと）を確認する。
- [x] 5.4 ローカルに未同期変更がある状態でタブ復帰したとき、自動反映されずコンフリクト表示になり auto-save が中断されることを確認する。
- [x] 5.5 素材計算直後（`material/result` 直書き経路）にタブ復帰しても、結果がサイレント上書きされない（dirty として扱われる）ことを確認する。
- [x] 5.6 1回の復帰で `/api/cloud` GET がおおむね1回に合流されること、クールダウン経過後の復帰では必ず再取得されることを Network タブで確認する。

## 6. 仕上げ

- [x] 6.1 `openspec validate cloud-sync-refetch-on-resume --strict` を通す。
- [x] 6.2 変更をコミットする（push 前に 5.2〜5.5 の実物確認を完了していること）。
