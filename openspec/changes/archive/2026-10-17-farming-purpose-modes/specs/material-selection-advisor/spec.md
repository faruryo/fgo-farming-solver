## MODIFIED Requirements

### Requirement: 推奨評価の余剰ストック追従

システムは配布アドバイザーの不足数をグローバルな周回目的に追従して算出しなければならない (SHALL)。`training` では `max(0, required - owned)`、`reserve` では `max(0, max(required, buffer) - owned)` を使う。`all` は有限の不足数を持たないため、配布アドバイザーでは `training` の不足を使用し、その旨を表示しなければならない (SHALL)。

#### Scenario: 育成不足を評価する

- **WHEN** `training` で配布アドバイザーを表示する
- **THEN** 登録済み育成必要数に対する不足だけで候補価値を計算する

#### Scenario: 在庫基準までの不足を評価する

- **WHEN** `reserve` で配布アドバイザーを表示する
- **THEN** `max(required, buffer)` に対する不足で候補価値を計算する

#### Scenario: 素材全体では育成不足へ戻す

- **WHEN** `all` で配布アドバイザーを表示する
- **THEN** `training` の不足で候補価値を計算し、「配布評価は今の育成を使用」と表示する

#### Scenario: 現在モードを表示する

- **WHEN** 配布アドバイザーの推奨値を表示する
- **THEN** 数値の近くに評価で使った周回目的を表示する

#### Scenario: stockEnabled=ON はストック込みで評価

- **WHEN** 旧ストックONから移行した `reserve` で推奨を算出する
- **THEN** `max(required, buffer)` に対する不足で評価する

#### Scenario: stockEnabled=OFF は育成不足のみ

- **WHEN** 旧ストックOFFから移行した `training` で推奨を算出する
- **THEN** 育成必要数に対する不足だけで評価する

#### Scenario: ストック反映中の明示

- **WHEN** `reserve` で配布アドバイザーを表示する
- **THEN** 「新規サーヴァントに備える」で評価中と表示する

#### Scenario: 必要数の表示はストックバッファ込みの実効値

- **WHEN** `reserve` で素材カードの必要数を表示する
- **THEN** `max(required, buffer)` と不足数が算術的に一致し、育成必要数と在庫基準を区別して示す

## REMOVED Requirements

### Requirement: ストック目標設定時の実効不足の統一評価

**Reason**: `stockEnabled` と `required + buffer` を目的モードへ置き換えるため。

**Migration**: `reserve` の `max(required, buffer)` を共通不足定義として使う。
