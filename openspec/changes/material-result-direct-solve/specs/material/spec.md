## ADDED Requirements

### Requirement: 育成計算機結果画面での周回対象クエスト選択

システムは`/material/result`に、周回対象クエストを選択するUI(既存の`CheckboxTree`)を統合 SHALL。選択状態は既存のグローバルな`localStorage['excludedQuests']`を`/farming`と共有 SHALL(専用の状態は持たない)。デフォルトは全クエストが選択済みとする。

#### Scenario: 既定は全クエストが選択済み
- **WHEN** `/material/result`を初めて開く、または`excludedQuests`が未設定のとき
- **THEN** 周回対象クエストはすべて選択済みとして表示される。

#### Scenario: 選択状態は/farmingと同期する
- **WHEN** `/material/result`でクエストの選択を変更したとき
- **THEN** `localStorage['excludedQuests']`が更新され、`/farming`を(直接アクセスで)開いたときも同じ選択状態が反映される。

#### Scenario: クエスト未選択時は送信できない
- **WHEN** `/material/result`で周回対象クエストが1件も選択されていない状態で送信しようとしたとき
- **THEN** 送信はブロックされ、クエストを最低1件選択するよう促すメッセージが表示される。
