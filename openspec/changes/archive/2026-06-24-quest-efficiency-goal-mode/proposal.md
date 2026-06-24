## Why

クエスト効率の「不足のみ」モードは、育成必要数(`goal`)を主優先(重み1)、レア別余剰しきい値以下の余剰を**次点(重み0.3)**として扱う。これは「育成に必要な分」と「余分にストックしておきたい分」を一段下げた弱い信号として混ぜているだけで、「余剰ストックを明確な目標として周回したい」プレイヤーを表現できない。

**ユーザーストーリー**: 新サーヴァント実装時に育成素材を切らさず即スキルマックスにしたい上級者は、レア別素材を常に一定個数ストックしておきたい。「そのストックを切らさない/積み増すには今どのクエストを周回すべきか」の道標が欲しい。この層は育成目標の達成が概ね近く、関心は余剰ストックの維持にある。

重要なのは、これは1機能のオプションではなく **「不足/必要数」の定義(実効目標)そのものを変える**点である。実効目標は5つの画面(クエスト効率・育成計算機・周回ソルバー・計算履歴・配布アドバイザー)に流れ込んでおり、各画面で個別にトグルを足すと「今どちらの目標で見ているか」が不整合になる。そこで**実効目標を1つの共有定義に集約し、グローバル単一トグルで切り替える**設計とする。本機能は育成達成が近い上級者向けのニッチ機能であり、既定OFF・一般ユーザーの既定挙動と導線は変えない。

## What Changes

- **共有の実効目標定義(コア)**: `実効必要数(item) = 育成必要数 + (stockEnabled ? stockBuffer[group][rarity] : 0)`、`実効不足 = max(0, 実効必要数 − 所持)` を純関数として1箇所に集約し、全画面がこれを参照する。
- **カテゴリ群×レアの `stockBuffer`**: ストック個数を「通常素材 / スキル石 / モニュピ(霊基再臨)」のカテゴリ群 × 金銀銅(モニュピは金銀のみ)で保持する(最大8区分)。`getRarityByCategory` は秘石/モニュメントも金銀銅に丸めるため、レア単独では「竜の逆鱗も秘石も金=同値」になってしまう。スキル石・モニュメントは育成で大量消費するため、カテゴリ群ごとに妥当なデフォルトを持つ。アイテムのカテゴリ群は `isSkillStone`/`isMonumentOrPiece`(largeCategory)で判定し、いずれでもなければ通常素材とする。
- **グローバル単一トグル `stockEnabled`**: 「余剰ストックを目標に含める」スイッチ(boolean, 既定OFF, クラウド同期)を**所持数モーダル内の「ストック目標設定」専用セクション**に置き、`stockBuffer` のカテゴリ群×レア設定も同セクションに集約する。これが farming 方向の全画面に一括で効く(ペルソナ設定)。画面ごとの個別トグルは設けない。
- **`stockBuffer` のデュアル強度**: `stockEnabled=OFF` では従来どおり**次点(重み0.3)** で拾う上限、`stockEnabled=ON` では同じ値を**目標(重み1.0)に昇格**。OFF時の次点バンドもカテゴリ群×レアの `stockBuffer` を用いる(通常素材のデフォルトは既存の金50/銀100/銅200を踏襲し既存挙動を保つ)。クエスト効率の対象モードは現状の2値(全部/不足のみ)のまま(3値化しない)。
- **周回ソルバー取り込み(`material/result.tsx` の `goSolver`)**: 取り込む不足分を共有の `実効不足` で算出。`stockEnabled` に追従し、別トグルは持たない。
- **配布アドバイザー(`material-selection-advisor`)**: need(不足)を共有の `実効不足` で算出。`stockEnabled` に追従する。
- **育成計算機(`material/result`)**: 表示は育成必要数/不足が主(アイデンティティ維持、保存値 `material/result` は育成のまま不変)。`stockEnabled=ON` のときだけ「+ストック分」を控えめに副表示。
- **計算履歴**: 解いた目標(`params.items`)をそのまま記録・表示(as-solved)。`params` に `stockIncluded` フラグを保存し、ストック込みで解いた履歴には badge を表示する。両目標の並列保存はしない。

## Capabilities

### New Capabilities
<!-- なし(既存 capability の拡張で実現) -->

### Modified Capabilities
- `quest-efficiency`: 余剰しきい値を `stockEnabled` で「次点(0.3)↔目標(1.0)」に昇格させる挙動と、共有の実効目標定義・グローバルトグル(所持数モーダル)を追加する。
- `solver`: 育成不足分の周回目標取り込みを、共有の実効不足(`stockEnabled` 追従)で算出することを要求する。
- `material`: 育成計算機の結果表示に、`stockEnabled=ON` 時のストック込み不足の控えめな副表示を追加する。
- `material-selection-advisor`: 推奨評価の need(不足)を共有の実効不足(`stockEnabled` 追従)で算出することを要求する。
- `farming-history`: 解いた目標がストック込みか(`stockIncluded`)を記録し、履歴に badge 表示することを要求する。

## Impact

- コード(コア):
  - `lib/quest-efficiency.ts`(共有 `effectiveRequired`/`effectiveDeficiency` 純関数、`computeItemWeight` を `stockEnabled` 昇格対応、`QuestEfficiencyOptions` に `stockEnabled`)
- コード(各画面):
  - `components/quests/QuestEfficiencyList.tsx`(`stockEnabled` を読み出し反映。対象モードは2値のまま)
  - `components/quests/PossessionModal.tsx`(「ストック目標設定」専用セクション: `stockEnabled` トグル + カテゴリ群×レアの `stockBuffer` 編集、説明を `stockEnabled` で出し分け)
  - `lib/item-rarity.ts`(`categoryGroup(item)` 分類器を追加 or 既存 `isSkillStone`/`isMonumentOrPiece` を流用)
  - `components/material/result.tsx`(`goSolver` の不足算出を実効不足に。ON時「+ストック」副表示)
  - `components/material/material-selection-advisor.tsx`(`buildNeedByApiItemId` を実効不足に)
  - `components/farming/*`(目標の内訳補助表示は任意)、計算履歴の badge 表示
- ストレージ: 新規 `efficiency/stockEnabled`(boolean, クラウド同期)。新規 `efficiency/stockBuffer`(カテゴリ群×レアのネスト, クラウド同期)。既存 `efficiency/surplusThreshold`(flat 金銀銅)からは通常素材群へ移行(未設定の群はデフォルト)。`Params` に `stockIncluded?: boolean` を追加(後方互換: 既存履歴は未設定=false 扱い)。
- API/依存関係: 追加なし。i18n キーを `locales/` に追加。
