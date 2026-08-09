## ADDED Requirements

### Requirement: 育成計算機結果画面での周回対象クエスト選択

システムは`/material/result`に、周回対象クエストを選択するUI(既存の`CheckboxTree`)を統合 SHALL。選択状態は既存のグローバルな`localStorage['excludedQuests']`を`/farming`と共有 SHALL。旧`quests`キーからの一方向移行、および`quests`キーへのデュアルライト(`sync`specの「除外クエストリストの永続化と同期」要件)は`/farming`と同じ共有ロジックを使い SHALL、`/material/result`側で個別に再実装しない。

#### Scenario: 既定は全クエストが選択済み
- **WHEN** `/material/result`を初めて開き、`excludedQuests`・旧`quests`のいずれも未設定のとき
- **THEN** 周回対象クエストはすべて選択済みとして表示される。

#### Scenario: 旧questsキーからの移行は/farmingと同じロジックで行われる
- **WHEN** `excludedQuests`が未設定で旧`quests`キーのみ存在する状態で`/material/result`を先に開いたとき
- **THEN** `/farming`を開いた場合と同じ移行結果(旧`quests`のチェック済みリストを反映した`excludedQuests`)になる。

#### Scenario: 選択状態は/farmingと同期する
- **WHEN** `/material/result`でクエストの選択を変更したとき
- **THEN** `localStorage['excludedQuests']`が更新され、`/farming`を(直接アクセスで)開いたときも同じ選択状態が反映される。

#### Scenario: クエスト未選択時は送信できない
- **WHEN** `/material/result`で周回対象クエストが1件も選択されていない状態で送信しようとしたとき
- **THEN** 送信はブロックされ、クエストを最低1件選択するよう促すメッセージが表示される。
