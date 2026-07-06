## Why

iOS Safari は「ホーム画面に追加」した PWA 内でのみ Web Push API（`Notification` / `PushManager`）を公開するが、現状の通知設定トグルは機能検出なしで `Notification.requestPermission()` を呼ぶため、iPhone の Safari タブ上では即座に例外となり「プッシュ通知の登録に失敗しました」という原因不明のエラーだけが表示される。この iOS 向け案内は todo-management の design.md で既知リスクの Mitigation として明記されながら「未実装（今回のスコープ外）」とされていたもので、実際にユーザーが本番で踏んだため後続 change として対応する。

## What Changes

- プッシュ通知トグルの表示前に Web Push 対応の機能検出（`'serviceWorker' in navigator` / `'PushManager' in window` / `'Notification' in window`）を行い、非対応環境ではトグルを disabled にする
- 非対応の iOS ブラウザ（`display-mode: standalone` でない iOS デバイス）には「共有メニューから『ホーム画面に追加』し、追加したアイコンから開くとプッシュ通知を利用できます」という案内文を表示する
- 登録失敗時のエラートーストを原因別に分ける: 非対応環境 / 通知許可の拒否（iOS では再プロンプト不可のため PWA 再インストールが必要な旨を含む）/ サーバー登録失敗
- 上記文言の i18n 対応（ja / en）

## Capabilities

### New Capabilities

（なし）

### Modified Capabilities

- `todo-notifications`: 「プッシュ通知の許諾と登録」要件に、非対応環境の検出とトグル無効化、iOS 向けホーム画面追加ガイダンス、失敗理由別のエラーフィードバックのシナリオを追加する。
  - 注: `todo-notifications` の本スペックは未 sync（todo-management change の delta としてのみ存在）。本 change の delta はその内容を前提に ADDED Requirements として追記する。

## Impact

- `components/todo/TodoSettingsPanel.tsx`: 機能検出・案内表示・エラー分岐の追加（変更の中心）
- `lib/todo/push.ts`: 対応判定ヘルパーの追加（必要なら）
- `locales/ja.json` / `locales/en.json`: 案内・エラー文言の追加
- サーバー側 API・service worker・manifest は変更なし（調査で正常動作を確認済み）
