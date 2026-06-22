## 1. 共有コア(lib/item-rarity.ts, lib/quest-efficiency.ts)

- [x] 1.1 `lib/item-rarity.ts` に `categoryGroup(item): 'normal'|'skillStone'|'monumentPiece'` を追加(`isSkillStone`/`isMonumentOrPiece` 流用)
- [x] 1.2 `StockBuffer` 型(カテゴリ群×レアのネスト、monumentPiece は金銀のみ)とデフォルト値を定義(通常素材=既存 50/100/200、スキル石/モニュピは大量消費向け既定)
- [x] 1.3 `buffer(item, stockBuffer) = stockBuffer[group][rarity]`(レア不明=0)/ `effectiveRequired` / `effectiveDeficiency = max(0, effectiveRequired − owned)` を純関数として切り出す
- [x] 1.4 `QuestEfficiencyOptions` に `stockEnabled`/`stockBuffer` を追加し、`computeItemWeight` を昇格対応(OFF=次点0.3 / ON=目標1.0、`effGoal = goal + (stockEnabled?buffer:0)`)
- [x] 1.5 `goal=0` 素材が ON 時 `effGoal = buffer` になることを担保。既存の all/不足のみ(OFF)挙動は通常素材について不変に保つ

## 2. 型・ストレージ

- [x] 2.1 `interfaces/api.ts` の `Params` に `stockIncluded?: boolean` を追加(optional・後方互換)
- [x] 2.2 `efficiency/stockEnabled`(boolean, 既定false)と `efficiency/stockBuffer`(群×レア・ネスト)のストレージキーを用意(`useLocalStorage` + クラウド同期対象に追加)
- [x] 2.3 旧 `efficiency/surplusThreshold`(flat 金銀銅)→ `stockBuffer.normal` への移行読み替え

## 3. テスト(lib/quest-efficiency.test.ts)

- [x] 3.1 `stockEnabled` ON/OFF × 境界(`owned==effGoal`、`effGoal-1`、buffer=0、goal=0、レア不明)の重みテスト
- [x] 3.2 `effectiveDeficiency` の共有関数テスト(クエスト効率/取り込み/アドバイザーで同値になること)
- [x] 3.3 既存 all/不足のみ(OFF)の回帰テストが維持されること

## 4. グローバルトグル & クエスト効率(components/quests)

- [x] 4.1 `PossessionModal.tsx`: 「ストック目標設定」専用セクションを追加(`stockEnabled` トグル + カテゴリ群×レアの `stockBuffer` 編集グリッド、monumentPiece の銅は非表示)。説明文を `stockEnabled` で出し分け(次点上限 / 目標上乗せ個数)
- [x] 4.2 `QuestEfficiencyList.tsx`: `stockEnabled`/`stockBuffer` を読み出し `computeQuestEfficiency` に渡す。ON 中は「ストック込み」表示を出す。対象モードは2値のまま
- [x] 4.3 i18n キーを `locales/` に追加(トグルラベル・カテゴリ群ラベル・説明・ストック込み表示)

## 5. 周回ソルバー取り込み(components/material/result.tsx)

- [x] 5.1 `goSolver` の不足算出を共有 `effectiveDeficiency`(`stockEnabled` 追従)に置換
- [x] 5.2 `stockEnabled=ON` で遷移した計算に `stockIncluded=true` を付与(`/farming` への受け渡し〜保存まで)
- [x] 5.3 `stockEnabled=ON` 時、結果画面の各素材に「+ストック分」を控えめに副表示(保存値 `material/result` は不変)

## 6. 配布アドバイザー(components/material/material-selection-advisor.tsx)

- [x] 6.1 `buildNeedByApiItemId` の need を共有 `effectiveDeficiency`(`stockEnabled` 追従)に置換
- [x] 6.2 `stockEnabled=ON` の間、ストック込みで評価している旨を UI に明示

## 7. 計算履歴 badge

- [x] 7.1 履歴一覧・結果ページで `params.stockIncluded` を読み、true の行/ページに「ストック込み」badge を表示(未設定は false 扱い)(結果ページに実装。一覧テーブルは `result_data` を返さない API のため対象外 — 詳細はレポート参照)

## 8. 検証

- [x] 8.1 `pnpm test` と type-check が通る(type-check clean / 1001 tests passed / lint clean)
- [x] 8.2 所持数モーダルの「ストック目標設定」セクション(OFF/ON でカード強調・説明文切替)とクエスト効率一覧の「ストック込み」表示を実機確認(:3000)。取り込み・アドバイザーの整合は共有 `effectiveDeficiency` 経由をコード監査で確認
- [ ] 8.3 育成計算機の副表示・計算履歴 badge・既存履歴(stockIncluded 無し)の後方互換を実機確認(コード監査済み。ブラウザ視認は未実施)
- [x] 8.4 既定OFF(`efficiency/stockEnabled` 未設定/false)で従来挙動・保存値が不変であることを確認(検証後 OFF にリセット済み)
