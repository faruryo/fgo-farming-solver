## REMOVED Requirements

### Requirement: アドバイザーのタブ切り替え (Advisor Tab Navigation)
**Reason**: 料理作成アドバイザーはイベントページ（`/events/[id]`）の料理作成セクションへ移設するため、素材選択アドバイザー内のタブ切り替えは不要になる。
**Migration**: 素材選択アドバイザーは「毎月の交換券・配布」のみを表示する。料理作成へは「料理作成アドバイザーへの導線」要件のリンクから遷移する。保存済みのタブ値 `summer-2026` は無視して交換券・配布の表示にする。

## ADDED Requirements

### Requirement: 料理作成アドバイザーへの導線 (Event Craft Link)
システムは、素材選択アドバイザーに、料理作成アドバイザーを持つイベントのイベントページ（現状 `/events/80614`）へのリンクを表示しなければならない (SHALL)。素材選択アドバイザー内に料理作成アドバイザー本体を描画してはならない (SHALL NOT)。

#### Scenario: 導線の表示
- **WHEN** ユーザーが素材計算結果画面の素材選択アドバイザーを開いたとき
- **THEN** 交換券・配布のアドバイザーが表示され、料理作成アドバイザーのあるイベントページへのリンクが表示される。

#### Scenario: 旧タブ値の保存がある場合
- **WHEN** localStorage のアドバイザータブに旧値 `summer-2026` が保存されているとき
- **THEN** 画面はクラッシュせず、交換券・配布のアドバイザーが表示される。

## MODIFIED Requirements

### Requirement: イベントクラフト設定の永続化 (Event Craft Configuration Persistence)

システムは、各食材の所持数、および配分パターン（`planPattern`）の設定をブラウザの localStorage に永続化しなければならない (SHALL)。保存先のキーはイベントページへの移設前と同じとし、移設前に入力した値をそのまま復元しなければならない (SHALL)。

#### Scenario: クラフト設定の保存と復元

- **WHEN** ユーザーが食材所持数や選択パターンを変更したとき
- **THEN** 設定が即座に localStorage に保存される。
- **WHEN** ページがリロードされたとき
- **THEN** 前回入力した食材数や選択パターンが復元されて表示される。
- **WHEN** 移設前に素材選択アドバイザーで入力した食材数・パターンが保存されているとき
- **THEN** イベントページの料理作成セクションで同じ値が復元される。
- **WHEN** localStorage に廃止された `planPattern: 'exhaust'` または旧形式の `exhaustIngredients: true` が存在したとき
- **THEN** 安全に `runs`（周回を減らす）パターンへフォールバックして読み込まれる。
