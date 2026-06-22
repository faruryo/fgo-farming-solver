## Why

自動同期を有効にしていても、PC とスマホでデータが噛み合わない不具合がある。原因は複合的で、(1) クラウドデータの取得 (`/api/cloud` GET → 自動ロード判定) がコンポーネントの初回マウント時と自分の保存直後しか発火せず、タブ復帰・bfcache 復元のタイミングで「サーバの新しいデータを取りに行く」処理が存在しないこと。モバイルでは「アプリを開く」が既存タブの再開（再マウントなし）であることが多く、別デバイスの更新が永遠に評価されない。さらに (2) 自動ロードで localStorage に適用したデータが表示中のコンポーネント state に伝播しない（`applyData` の detail なし `ls-sync` は `useLocalStorage` に無視される）ため、適用後の編集で古い state が書き戻されて適用済みデータを巻き戻し、auto-save が退行データをクラウドへ push しうる。(3) 一部のキー（`material/result` / `farming/results`）は直書きで変更追跡から漏れており、「クリーン」と誤認されて自動ロードにサイレント上書きされうる。

## What Changes

- **同期エンジンの常駐化**: `useCloudSync` の実マウント箇所が nav ドロワー内(開いている間のみ)と `/cloud` ページに限られており、通常利用中は変更追跡・auto-save・フェッチが一切動いていなかった(実機検証で確認した最大の構造的原因)。headless の `CloudSyncEngine` を `app/providers.tsx` に常駐させる。
- `useCloudSync` に、タブが可視化/復帰したタイミングでクラウドデータを再取得するトリガーを追加する:
  - `document` の `visibilitychange`（`visibilityState === 'visible'` のとき）
  - `window` の `pageshow`（`persisted === true` の bfcache 復元のみ。通常ロードはマウント時フェッチと二重になるため対象外）
- 再取得後は既存の `checkConflict` フロー（自動ロード or コンフリクト表示）をそのまま通すため、クリーンな状態であれば最新データが自動反映され、未同期のローカル変更があればコンフリクトとして検出される。
- `applyData` を「適用した各キーについて `ls-sync`(detail 付き) を dispatch」する実装に変更し、表示中のコンポーネント state へ伝播させる（古い state の書き戻しによる巻き戻しを防止）。
- 直書きされていた `material/result`（2箇所）と `farming/results`（1箇所）の書き込みに `ls-sync`(detail 付き) dispatch を追加し、変更追跡（dirty 検出・auto-save）に乗せる。
- 連続イベント・複数フックインスタンスの同時発火による過剰な GET を避けるため、再フェッチにはモジュールレベルで共有する短いクールダウン（~5秒、バースト合流目的）を設ける。

## Capabilities

### New Capabilities
<!-- なし -->

### Modified Capabilities
- `sync`: 「自動ロード (Safe Auto-Load)」を、初回マウント時だけでなくタブ可視化・bfcache 復元といった再開タイミングでも実行することを要求する。加えて、適用データの表示状態への伝播と、直接書き込みを含む全同期対象キーの変更追跡を要求する。

## Impact

- コード:
  - `components/cloud/sync-engine.tsx`（新設: headless 常駐エンジン）+ `app/providers.tsx`（マウント追加）
  - `lib/cloud-sync/decision.ts`（新設: 判定ロジックの純関数抽出）+ `decision.test.ts`（判定マトリクスのリグレッションテスト。Vitest node 環境・依存追加なし）
  - `hooks/use-cloud-sync.ts`（再取得リスナー・共有クールダウン・`applyData` のキー別 dispatch。判定は抽出関数へ委譲）
  - `components/material/material-calc-button.tsx` / `components/material/index.tsx`（`material/result` 書き込みの追跡化）
  - `components/farming/index.tsx`（`farming/results` 書き込みの追跡化）
  - 挙動は `components/common/nav.tsx` / `components/common/cloud-indicator.tsx` / `components/cloud/index.tsx` の全 `useCloudSync` 利用箇所に波及する。
- API: 既存の `/api/cloud` GET を再利用するのみ。新規エンドポイントなし。
- 依存関係: 追加なし（ブラウザ標準イベントのみ）。
