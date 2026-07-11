## Why

現状のプッシュ通知設定（`pushEnabled`）は、アカウント全体でクラウド同期される設定（`todoSettings`）の一部として管理されているため、以下の課題があります。
1. **データ巻き戻しリスク**: クラウドの自動同期（Sync）がOFFの環境でトグルを切り替えた際、即座にセーブを強制すると、他端末で更新された最新データ（素材数等）がローカルの古いデータで上書きされてしまう。
2. **マルチデバイス時の設定干渉**: Web Pushの購読自体は端末ごとに行われる一方、ON/OFFフラグがアカウント共通で同期されるため、「スマホは通知ON、PCは通知OFF」といった端末ごとの個別の通知制御ができず、設定が干渉し合ってしまう。

本変更では、`pushEnabled` をクラウド同期の対象から除外して端末ローカル管理とすることで、これらの問題を根本的に解決します。

## What Changes

- **設定の同期除外**: プッシュ通知のON/OFF状態（`pushEnabled`）をアカウント共通の設定（`todoSettings`）から除外し、専用キー `fgo_push_enabled` として各端末の `localStorage` のみに保持するローカル設定に変更します。
- **配信判定のクリーンアップ**: サーバー側の通知配信スクリプト（`send-todo-notifications.ts`）において、ユーザー設定の `pushEnabled` による判定を廃止します。代わりに「D1に端末の購読情報が登録されていること」のみを送信条件とします。
- **トグル制御の独立**: 設定画面でのプッシュ通知トグル操作時は、クラウド同期（KVセーブ）の有無に関わらず、ブラウザの通知許可・D1への購読登録/解除API（POST/DELETE）の呼び出しのみを完結させ、他のデータを巻き込む保存処理は行いません。

## Capabilities

### New Capabilities

*(なし)*

### Modified Capabilities

- `todo-notifications`: プッシュ通知トグル（`pushEnabled`）をクラウド同期設定（`todoSettings`）から除外し、完全に端末（ブラウザ）ローカルで管理するように要件を修正します。

## Impact

- **UI / クライアントコンポーネント**: [TodoSettingsPanel.tsx](file:///Users/faru/fgo-farming-solver/components/todo/TodoSettingsPanel.tsx) において、`pushEnabled` の状態管理をアカウント共通の `todoSettings` から分離し、専用キー `fgo_push_enabled` で管理します。
- **同期処理**: [use-cloud-sync.ts](file:///Users/faru/fgo-farming-solver/hooks/use-cloud-sync.ts) の同期対象キーから `pushEnabled` を除外します（`todoSettings` のシリアライズ/デシリアライズ時にマスクまたは分離）。あわせて変更監視リスナーを同期対象 `KEYS` の allowlist 方式に変更します。
- **型定義 / デフォルト値**: `types/todo.ts` の `TodoSettings` 型、`lib/todo/settings.ts` および `scripts/send-todo-notifications.ts` のデフォルト設定から `pushEnabled` を削除します。
- **バックエンド / 配信バッチ**: [send-todo-notifications.ts](file:///Users/faru/fgo-farming-solver/scripts/send-todo-notifications.ts) で `settings.pushEnabled` の参照とスキップ判定を廃止します。
- **既存ユーザーへの挙動変化**: D1 に購読レコードが残っているが KV の `pushEnabled=false` によりスキップされていた端末は、ゲート撤廃後に通知を受け取り始めます（眠っていた購読の再活性化）。端末単位制御の意図どおりの挙動として許容し、不要な端末はトグル OFF（購読削除）または 404/410 自動クリーンアップで停止します。
