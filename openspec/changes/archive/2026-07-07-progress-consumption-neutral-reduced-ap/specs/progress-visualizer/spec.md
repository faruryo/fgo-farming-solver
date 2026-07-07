# Delta: progress-visualizer (progress-consumption-neutral-reduced-ap)

## MODIFIED Requirements

### Requirement: 進捗 tier の判定
システムは、進捗の達成度を `large` / `medium` / `small` / `none` の 4 段階（tier）で判定しなければならない (SHALL)。主指標は「目標達成に必要な残りAPの減少量（`reducedAp`、消費中立）」を経過時間の自然回復AP（5分=1AP）で正規化した値とする。`reducedAp` は消費中立の算出（「目標への前進」要件を参照）により常に 0 以上となる。`reducedAp` が算出できない（過去所持欠損・ソルバー未実行など）、または 0（素材獲得なし）の期間は、素材スループット（獲得＋育成投入の個数）を経過日数でならした値で tier を補完し、活動のあった日が不当に `none` にならないようにしなければならない (SHALL)。

#### Scenario: reducedAp による判定
- **WHEN** `reducedAp > 0` のとき
- **THEN** `reducedAp >= naturalRecoveryAp * 1.5` → `large`、`naturalRecoveryAp <= reducedAp < naturalRecoveryAp * 1.5` → `medium`、`0 < reducedAp < naturalRecoveryAp` → `small` と判定する。

#### Scenario: スループットによる補完
- **WHEN** `reducedAp` が算出できない、または 0 以下のとき
- **THEN** 素材スループット（獲得＋育成投入の個数）を経過日数でならして tier を判定し、活動があれば `none` にしない。

#### Scenario: 育成消費が tier を下げないこと
- **WHEN** 同一期間内に素材の獲得と育成による消費の両方が発生したとき
- **THEN** 消費は `reducedAp` を減少させず、獲得のみが tier 判定に寄与する（例: 獲得だけなら `medium` となる期間は、同じ獲得に育成消費が加わっても `medium` を維持する）。

#### Scenario: 進捗ゼロの判定
- **WHEN** reducedAp・素材スループット・育成総量・新規入手のいずれも無いとき
- **THEN** tier は `none`、フォールバックは `zero_progress` と判定する。

### Requirement: 目標への前進（アイテム入手による残りの減少）
システムは、比較スナップショット以降にアイテムを入手したことで「目標達成に必要な残りAP・周回数・費用」がどれだけ減ったかを、目標を現在に固定した再ソルブで算出し、「目標への前進」として**プラス表記**で表示しなければならない (SHALL)。算出は**消費中立**でなければならない (SHALL): アイテムごとに現在所持を過去所持で下限クランプ（`adjustedNow = max(現在所持, 過去所持)`）してから再ソルブすることで、育成等による所持の純減は本指標を減少させず、所持の純増（周回獲得）のみが前進として計上される。これにより `reducedAp`・減少周回は常に 0 以上となる。

AP（`reducedAp`）を主役の大きな数値とし、周回数・費用はその単位換算として小さく内訳表示する。AP・費用は消費AP最小プラン、周回数は周回数最小プランで算出するため両者の増減はずれることがあり、周回数が 0 以下（減っていない）の場合は表示してはならない (SHALL NOT)。目標を両辺とも現在値に固定するため、目標を増やしても本指標は増加してはならない (SHALL NOT)。本指標 `reducedAp` は tier 判定の主指標でもある。

#### Scenario: 減少量の算出
- **WHEN** 現在の目標（`material/result`）と、現在の所持（`posession`）および比較スナップショットの過去所持が取得できるとき
- **THEN** アイテムごとに `adjustedNow = max(現在所持, 過去所持)` を作り、`need = max(0, 現在目標 − 所持)` を過去所持版と adjustedNow 版それぞれで組み立ててソルバーで解く。
- **THEN** `reducedAp = solve(現在目標 − 過去所持).total_ap − solve(現在目標 − adjustedNow).total_ap`（消費AP最小）、減少周回 `= 同 total_lap`（周回数最小）、減少費用 `= round(reducedAp / 144 / 168 * 10000)` を算出する。

#### Scenario: 育成消費が前進を目減りさせないこと
- **WHEN** 比較スナップショット以降に素材を獲得しつつ、育成で一部素材の所持が純減した（過去所持 > 現在所持 の素材がある）とき
- **THEN** 純減した素材は過去所持と同値として扱われ、獲得（純増）した素材の分だけが「目標への前進」に計上される。育成消費を理由に前進が負になってはならない。

#### Scenario: プラス表記での表示と内訳
- **WHEN** `reducedAp > 0` のとき
- **THEN** 「目標への前進 +N AP相当」を主役として表示し、その下に周回数（>0 のときのみ「周回 N周」）と費用（「費用 ¥N」）を小さく内訳表示する。

#### Scenario: 目標増加が減少量に影響しないこと
- **WHEN** 比較スナップショット以降に育成目標が増えた（`material/result` の総数が増加した）とき
- **THEN** 目標は両辺とも現在値で固定されているため、目標増加そのものは reducedAp・減少周回を増減させない。

#### Scenario: 過去所持が欠損している場合のフォールバック
- **WHEN** 比較スナップショットに `posession` が記録されていないとき
- **THEN** 目標への前進（AP/周回/費用）は算出せず非表示とし、tier はスループット等で判定する。

### Requirement: 素材スループットの算出
システムは、比較スナップショット以降の所持数の増減から素材スループットを算出しなければならない (SHALL)。所持が増えた分の合計を「獲得素材（`itemsFarmed`）」、減った分の合計を「育成投入（`itemsConsumed`）」とし、いずれも QP（atlasId `1`）は所持規模が他素材を桁違いに上回るため除外する。スループットは tier の補完判定（reducedAp が算出できない、または 0 のとき）に用い、育成消費はここで活動量として加点される（reducedAp 側では中立）。

#### Scenario: QP の除外
- **WHEN** 所持差分に QP（atlasId `1`）の増減が含まれるとき
- **THEN** QP の増減はスループットに含めない。
