## ADDED Requirements

### Requirement: 非対応環境でのプッシュ通知ゲーティング (Unsupported Environment Push Gating)
システムは、プッシュ通知トグルの操作を受け付ける前に Web Push の利用可否（Service Worker / PushManager / Notification API の存在）をクライアント側で検出しなければならない（MUST）。非対応環境ではトグルを無効化し、例外による失敗を発生させてはならない（MUST NOT）。

#### Scenario: 非対応ブラウザでのトグル無効化
- **WHEN** Web Push API が利用できないブラウザで TODO 通知設定を表示する
- **THEN** プッシュ通知トグルは disabled 表示になり、操作しても登録処理は実行されない

#### Scenario: 対応環境での従来動作の維持
- **WHEN** Web Push API が利用できるブラウザ（デスクトップ Chrome、ホーム画面追加済み iOS PWA 等）で設定を表示する
- **THEN** トグルは従来どおり操作でき、許諾 → 購読 → サーバー登録のフローが実行される

### Requirement: iOS 向けホーム画面追加ガイダンス (iOS Add-to-Home-Screen Guidance)
システムは、Web Push 非対応かつ iOS 系デバイス（iPhone / iPad）と判定した場合、共有メニューから「ホーム画面に追加」し追加したアイコンから開くことでプッシュ通知を利用できる旨の案内を通知設定内に表示しなければならない（MUST）。iOS 系以外の非対応環境には、ブラウザが対応していない旨の汎用メッセージを表示しなければならない（MUST）。

#### Scenario: iPhone の Safari タブでの案内表示
- **WHEN** iPhone の Safari（ホーム画面未追加）で TODO 通知設定を表示する
- **THEN** 無効化されたトグルとともに「ホーム画面に追加」の手順案内が表示される

#### Scenario: iOS 以外の非対応ブラウザでの汎用メッセージ
- **WHEN** iOS 系以外で Web Push 非対応のブラウザで TODO 通知設定を表示する
- **THEN** 「このブラウザはプッシュ通知に対応していません」相当の汎用メッセージが表示される

#### Scenario: ホーム画面追加済み iOS PWA では案内を出さない
- **WHEN** ホーム画面に追加した PWA として iOS で開き、TODO 通知設定を表示する
- **THEN** 案内文は表示されず、トグルが通常どおり操作できる

### Requirement: プッシュ登録失敗の原因別フィードバック (Reason-Specific Push Failure Feedback)
システムは、プッシュ通知の登録が失敗した場合、失敗理由（通知許可の拒否 / 購読の失敗 / サーバーへの登録失敗）を区別したエラーメッセージを表示しなければならない（MUST）。通知許可拒否のメッセージには、iOS では再プロンプトが行われないため PWA の再インストールが必要になる場合がある旨を含めなければならない（MUST）。

#### Scenario: 通知許可を拒否した場合
- **WHEN** トグル ON 後の許諾ダイアログでユーザーが通知を拒否する
- **THEN** 「通知が許可されていない」旨と、iOS では再インストールが必要になる場合がある旨のメッセージが表示され、トグルは OFF のまま維持される

#### Scenario: サーバー登録に失敗した場合
- **WHEN** 購読情報のサーバー登録（POST /api/notifications/subscribe）がエラーになる
- **THEN** 通信・サーバー起因である旨のメッセージが表示され、トグルは OFF のまま維持される

#### Scenario: エラーメッセージの i18n
- **WHEN** 言語設定を英語にして上記いずれかの失敗が発生する
- **THEN** 対応する英語のメッセージが表示される
