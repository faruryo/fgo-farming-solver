## ADDED Requirements

### Requirement: ストック不足フィルタの常時表示と自動ON

システムは `/material/result` の表示フィルタ(全て / 不足 / ストック不足)のうち「ストック不足」タブを、`stockEnabled` の値に関わらず常時表示 SHALL。`stockEnabled=OFF` の状態で「ストック不足」タブが選択されたとき、システムは `stockEnabled` を ON に切り替える SHALL。バッファ値(`stockBuffer`)は既存のカテゴリ×レア別デフォルト解決(`resolveStockBuffer`)をそのまま用い、この操作単独では追加の数値入力を要求しない SHALL。この自動ON操作は、育成必要数の保存値(`material/result`)および所持数(`possession`)を変更しない SHALL。

#### Scenario: stockEnabled=OFF でもタブが見える
- **WHEN** `stockEnabled=OFF` の状態で `/material/result` を表示する
- **THEN** 「全て」「不足」に加えて「ストック不足」タブも表示される

#### Scenario: タブ選択で自動的にストック目標がONになる
- **GIVEN** `stockEnabled=OFF` の状態で `/material/result` を表示している
- **WHEN** 「ストック不足」タブを選択する
- **THEN** `stockEnabled` が ON になり、表示フィルタはストック不足(育成必要数+バッファ未達)の素材に絞り込まれる
- **AND** 各素材にストック込み目標の副表示(既存の「育成計算機結果のストック込み不足の副表示」要件)が現れる

#### Scenario: 自動ON時は既定バッファ値を使う
- **GIVEN** ユーザーがストック目標のバッファ値を一度もカスタマイズしていない
- **WHEN** 「ストック不足」タブの選択により `stockEnabled` が自動でONになる
- **THEN** 各カテゴリ×レアのバッファ値は既存のデフォルト解決結果がそのまま使われ、ユーザーへの追加入力は要求されない

#### Scenario: 自動ONは保存値を書き換えない
- **WHEN** 「ストック不足」タブの選択により `stockEnabled` が自動でONになる
- **THEN** `material/result`(育成必要数)と `possession`(所持数)の保存値は変化しない

#### Scenario: 既に ON のときはタブ選択だけで絞り込む
- **GIVEN** `stockEnabled=ON` の状態で `/material/result` を表示している
- **WHEN** 「ストック不足」タブを選択する
- **THEN** `stockEnabled` の値は変わらず、表示フィルタのみがストック不足の素材に絞り込まれる
