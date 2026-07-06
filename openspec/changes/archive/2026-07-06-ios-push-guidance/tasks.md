## 1. 判定ヘルパーとエラー型

- [x] 1.1 `lib/todo/push.ts` に `isPushSupported()`（serviceWorker / PushManager / Notification の存在検出）と `isIosFamily()`（UA + iPadOS の MacIntel/maxTouchPoints 対策）を追加する
- [x] 1.2 `lib/todo/push.ts` に `PushSubscribeError`（`reason: 'unsupported' | 'permission-denied' | 'subscribe-failed' | 'server-error'`）を追加する
- [x] 1.3 上記ヘルパーの単体テストを追加する（`lib/todo/push.test.ts`、navigator/window のモックで各分岐を検証）

## 2. TodoSettingsPanel の対応

- [x] 2.1 マウント後 `useEffect` で `isPushSupported()` を評価する state を追加し、判定中および非対応時はプッシュトグルを disabled にする
- [x] 2.2 非対応かつ iOS 系のとき「共有メニュー →『ホーム画面に追加』→ 追加したアイコンから開くと利用可」の案内文を、非対応かつ非 iOS のとき汎用の非対応メッセージを、トグル下に表示する（既存の「ログインが必要です」行と同じスタイル）
- [x] 2.3 `subscribeToPush` を `PushSubscribeError` を投げるように変更し、`togglePush` の catch で reason 別の i18n トーストを表示する（permission-denied には iOS の再インストール注意を含める）

## 3. i18n

- [x] 3.1 `locales/ja.json` / `locales/en.json` に案内文・原因別エラーメッセージのキーを追加する

## 4. 検証

- [x] 4.1 `pnpm type-check` とテストが通ることを確認する
- [x] 4.2 ブラウザ実機検証: 対応環境（デスクトップ Chrome）でトグルが従来どおり動くこと、DevTools で Notification/PushManager を潰した状態（または iPhone Safari 実機）で disabled + 案内文が出ることを確認する
- [x] 4.3 言語を en に切り替えて案内文・エラーメッセージの英語表示を確認する（注: アプリは `lng: 'ja'` 固定で UI 切替が存在しないため、ja/en リソースの新規キー整合と英訳内容の検証で代替）
