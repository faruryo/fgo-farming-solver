## Context

todo-management change で実装した Web Push 通知は、iOS では「ホーム画面に追加」した PWA 内でのみ利用できる（iOS 16.4+ の Apple 仕様。Safari タブでは `Notification` / `PushManager` が undefined）。現状の `TodoSettingsPanel` は機能検出なしで `Notification.requestPermission()` を呼ぶため、iPhone Safari では ReferenceError で即失敗し、原因を示さない汎用トーストだけが出る。todo-management の design.md はこのリスクの Mitigation（iOS 向けホーム画面追加の案内）を明記していたが未実装のまま本番に出た。サーバー側（VAPID 鍵配布・購読 API）・service worker・manifest は正常動作を確認済みで、変更はクライアント UI に閉じる。

## Goals / Non-Goals

**Goals:**
- 非対応環境でトグルを操作不能にし、例外ベースの失敗をなくす
- 非対応 iOS ブラウザにホーム画面追加の手順を案内し、ユーザーが自力で解決できるようにする
- 失敗時のフィードバックを原因別（非対応 / 許可拒否 / サーバー登録失敗）にする

**Non-Goals:**
- ネイティブプッシュ（APNs/FCM）対応
- オフラインキャッシュ等の PWA 機能拡張、インストールプロンプト（beforeinstallprompt）対応
- サーバー側・service worker・manifest の変更

## Decisions

1. **機能検出はマウント後に実行し、SSR とハイドレーションを汚さない**
   `'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window` を `useEffect` 内で評価し state に持つ（初期値は「判定中 = トグル disabled」）。SSR 時に `window` 参照で落ちない・ハイドレーション不一致を出さないため。判定ヘルパー `isPushSupported()` は `lib/todo/push.ts` に置き、テスト可能にする。
   - 代替案: `typeof window` ガード付きでレンダー中に直接評価 → ハイドレーション不一致のリスクがあるため不採用（ui-conventions の hydration 規約）。

2. **iOS 判定は「push 非対応 かつ Apple タッチデバイス」で行い、display-mode は補助に使う**
   案内文の出し分けは `isPushSupported() === false` を主条件とし、`/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)`（iPadOS のデスクトップ UA 偽装対策）で iOS 系と判定した場合のみ「ホーム画面に追加」の具体的手順を表示する。iOS 系でない非対応環境には汎用の「このブラウザはプッシュ通知に対応していません」を表示する。
   - 代替案: `display-mode: standalone` の matchMedia だけで判定 → Android 等の「タブで開いているが push は使える」環境を誤って非対応扱いするため主条件にしない。

3. **エラーの原因別化は Error サブクラス（reason 判別子付き）で行う**
   `subscribeToPush` が `PushSubscribeError`（`reason: 'unsupported' | 'permission-denied' | 'subscribe-failed' | 'server-error'`）を投げ、呼び出し側が reason ごとの i18n メッセージをトーストに出す。`permission-denied` の文言には「iOS では一度拒否すると再確認が出ないため、ホーム画面のアプリを入れ直す必要がある」旨を含める。
   - 代替案: 文字列 message での分岐 → i18n と衝突し脆いため不採用。

4. **案内 UI は TodoSettingsPanel 内のインラインテキストにする**
   既存の「プッシュ通知にはログインが必要です」行と同じパターン（トグル下の小さな説明文）を踏襲する。モーダルや専用ページは作らない。

## Risks / Trade-offs

- [Risk] iOS 判定は UA ベースのため将来の UA 変更で崩れうる → Mitigation: 判定が外れても主条件（機能検出）でトグル disabled は維持され、案内文言が汎用版になるだけで安全側に倒れる。
- [Risk] `navigator.serviceWorker.ready` が解決しないケース（SW 登録失敗）ではトグルが busy のまま固まる → Mitigation: 本 change では機能検出で大半を防げるためタイムアウトは追加しない（発生報告があれば後続で対応）。
- [Risk] 判定中（マウント直後）はトグルが一瞬 disabled になる → 許容（数フレームであり、非対応環境で誤操作させるより良い）。

## Open Questions

（なし）
