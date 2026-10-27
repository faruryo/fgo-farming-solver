# master-profile Specification

## Purpose
TBD - created by archiving change ap-budget-quartz-cost. Update Purpose after archive.

## Requirements

### Requirement: マスターレベルの保持とクラウド同期
システムは、ユーザーのマスターレベルを保持し、`use-cloud-sync` の同期対象としてデバイス間で共有しなければならない (SHALL)。マスターレベルは最大AP 等のレベル依存値の算出に用いる横断プロフィール値である。

#### Scenario: マスターレベルのクラウド同期
- **WHEN** ユーザーがマスターレベルを入力・変更したとき
- **THEN** 値は localStorage に保存され、`use-cloud-sync` の `KEYS` に含まれるためログイン中は他デバイスへ同期される。

#### Scenario: 未入力時の既定（最大レベル）
- **WHEN** マスターレベルが未設定（未入力・未同期）のとき
- **THEN** システムはレベル別最大AP テーブルの最大レベル（現行の上限）を既定として用いる。

#### Scenario: 最大AP の導出
- **WHEN** マスターレベルが与えられたとき
- **THEN** システムはレベル別最大AP テーブルからそのレベルの最大AP を返す。

### Requirement: 編成コストの上限の導出

システムはマスターレベルから、そのレベルで編成できるコストの上限を返さなければならない (SHALL)。上限はレベル別の編成コスト上限テーブルから取り、マスターレベルが未設定のときは、最大AP と同じく最大レベルを既定として用いなければならない (SHALL)。

#### Scenario: 最小レベル
- **WHEN** マスターレベルが1
- **THEN** 編成コストの上限は56

#### Scenario: 最大レベル
- **WHEN** マスターレベルが200
- **THEN** 編成コストの上限は118

#### Scenario: 変化点の間のレベル
- **WHEN** マスターレベルが130
- **THEN** 編成コストの上限は、レベル127で上がった値の111のまま
