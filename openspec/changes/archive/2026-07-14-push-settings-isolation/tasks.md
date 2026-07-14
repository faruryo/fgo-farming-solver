## 1. Sync Logic Adjustment (useCloudSync)

- [x] 1.1 `pushEnabled` を専用キー `fgo_push_enabled` へ一度だけ移行する。旧値はクラウド同期由来の可能性があるため、`pushManager.getSubscription()` で当該端末のブラウザ購読の実在を確認し、`旧値 && 購読あり` の場合のみ `true` として移行する。
- [x] 1.2 `hooks/use-cloud-sync.ts` のセーブ時に `todoSettings` の JSON から `pushEnabled` を削除し、ロード時にもクラウドの `pushEnabled` でローカル値を上書きしない。
- [x] 1.3 `use-cloud-sync.ts` の変更監視リスナーを、同期対象 `KEYS` に含まれるキーのイベントのみ dirty / autosave にする allowlist 方式へ変更し、通知トグル操作（`fgo_push_enabled` の更新）で他のローカルデータがクラウドへ保存されないことを保証する。
- [x] 1.4 `pushEnabled` を `types/todo.ts` の `TodoSettings` 型、`lib/todo/settings.ts` の `DEFAULT_TODO_SETTINGS`、`scripts/send-todo-notifications.ts` の `DEFAULT_SETTINGS` から削除する。

## 2. UI Component & Error Feedback Refactoring (TodoSettingsPanel)

- [x] 2.1 `components/todo/TodoSettingsPanel.tsx` を修正し、`pushEnabled` トグルを専用ローカルキーで管理する。切り替え時は D1 への購読登録/解除 API と専用キーの更新のみを行い、クラウド自動保存を発生させない。
- [x] 2.2 `components/todo/TodoSettingsPanel.tsx` のエラーメッセージ表示部分を改善し、拒否時にはブラウザ設定確認（iOS以外）、通信エラー時には再試行や再ログインを促すアクションプランを含めたエラー表示にする。
- [x] 2.3 ローカライズ言語ファイル（`locales/ja.json`, `locales/en.json`）に必要なエラー翻訳を追加する。
- [ ] 2.4 購読解除 API の失敗時に再試行を促し、ブラウザ側の購読状態と D1 の登録状態が不一致になった場合に復旧できることを検証する。（コード実装は 2.2 で完了。ブラウザ実機での復旧検証は未実施）

## 3. Server-side Dispatcher Cleaning (send-todo-notifications)

- [x] 3.1 `scripts/send-todo-notifications.ts` において、`settings.pushEnabled` が `false` の場合に配信をスキップする判定および関連するカウント処理を削除し、D1に購読レコードがあること自体を配信ゲートとするように判定を修正する。

## 4. Verification

- [x] 4.1 `pnpm run type-check` および `pnpm run lint` が正常に通ることを確認する。
- [x] 4.2 プッシュ通知トグル操作時に `/api/notifications/subscribe` API が正常に呼び出され、専用キーの更新でクラウド保存が発生しないこと、およびクラウド同期時に `pushEnabled` が除外されていることを検証する。（ブラウザ実機で検証済み: 移行負ケース・セーブ時ストリップ・dirty分離・UI連動。API呼び出し部はログイン必須のため未検証）
- [ ] 4.3 意図的にAPI送信を失敗させる、または通知許可を拒否した際に、改善された案内メッセージが正しくトースト表示されることを確認する。（ログイン必須のため保留）
