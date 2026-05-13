# 仕様書: クエスト Wave キャッシュ (Quest Wave Cache)

## Purpose
クエスト詳細ページにおいて、各クエストの敵構成（Waveデータ）を Atlas Academy API から取得し、クライアントサイドで表示・管理する機能。

## Requirements

### Requirement: wave データのオンデマンド取得
システムは、クエスト詳細の表示時に必要な敵構成データを外部 API から取得しなければならない (SHALL)。

#### Scenario: クエスト詳細の表示
- **WHEN** クエスト詳細ページが表示され、`aaQuestId` が有効であるとき
- **THEN** Atlas Academy API から該当クエストの wave データをフェッチする。
- **THEN** 取得中はローディングインジケーターを表示する。

### Requirement: `useQuestWave` カスタムフック
システムは、コンポーネント間で wave データ取得ロジックを共有するため、再利用可能なフックを提供しなければならない (SHALL)。

#### Scenario: フックの利用
- **WHEN** `useQuestWave(aaQuestId)` が呼び出されたとき
- **THEN** `{ waves, isLoading }` を返し、`aaQuestId` の有無に応じて取得処理を制御する。

## Constraints
- **フォールバック**: `aaQuestId` が存在しない、または取得に失敗した場合は、適切なエラーメッセージを表示すること。
- **パフォーマンス**: 外部 API への過剰なアクセスを抑止するため、取得したデータは適切にキャッシュすること。
