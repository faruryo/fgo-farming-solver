## Why

トップページにある「もうすぐ達成！」セクションにおいて、クエスト名のみが表示されているため、どのエリアのクエストか判断しにくい。エリア名を併記することで、ユーザーが即座に場所を特定できるようにする。

## What Changes

- `NearGoalSection` コンポーネントの表示を修正し、クエスト名の前にエリア名を表示するように変更する。
- 表示形式は `エリア名 · クエスト名` とする。

## Capabilities

### New Capabilities
- なし

### Modified Capabilities
- `dashboard`: 「ゴール間近セクション (NearGoalSection)」の表示要件にエリア名を含めるよう更新。

## Impact

- `components/dashboard/NearGoalSection.tsx`
- トップページの UI 表示
