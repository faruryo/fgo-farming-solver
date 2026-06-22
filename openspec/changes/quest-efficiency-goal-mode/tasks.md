## 1. コアロジック(lib/quest-efficiency.ts)

- [ ] 1.1 余剰ストック上乗せの純関数を切り出す(`effGoal = goal + stock[rarity]`、レアリティ不明は stock=0)。クエスト効率とソルバー取り込みの双方から呼べる形にする
- [ ] 1.2 `QuestEfficiencyOptions` の `shortageOnly: boolean` を対象モード(`'all' | 'shortage' | 'shortage-plus-stock'`)へ拡張(後方互換は呼び出し側で吸収 or デフォルト)
- [ ] 1.3 `computeItemWeight` に `shortage-plus-stock` 分岐を追加(`owned < effGoal → 1`、それ以外 → 0、次点0.3バンドはスキップ)
- [ ] 1.4 既存の `all` / `shortage`(2段階)挙動が不変であることを保つ

## 2. テスト(lib/quest-efficiency.test.ts)

- [ ] 2.1 `shortage-plus-stock` の境界テスト(`owned == effGoal`、`owned = effGoal-1`、stock=0、レア不明)
- [ ] 2.2 既存モード(all/shortage)の回帰テストが維持されることを確認
- [ ] 2.3 旧 `shortageOnly` → 新モードの読み替えロジックのテスト(該当ヘルパを切り出す場合)

## 3. クエスト効率 UI(components/quests)

- [ ] 3.1 `QuestEfficiencyList.tsx`: `quests/efficiency/shortageOnly`(boolean)を `quests/efficiency/targetMode`(3値)へ移行し、新キー未設定時に旧 boolean を読み替えて初期化
- [ ] 3.2 フィルターポップオーバーの対象モードを3択(全部/不足のみ/不足+余剰ストック)に。`computeQuestEfficiency` 呼び出しへモードを反映
- [ ] 3.3 `PossessionModal.tsx`: 余剰しきい値の説明文を対象モードに応じて出し分け(次点上限 / 目標へ上乗せするストック個数)
- [ ] 3.4 i18n キーを `locales/` に追加(モードラベル・説明文)

## 4. 周回ソルバー取り込み(components/material/result.tsx)

- [ ] 4.1 `goSolver` のデフィシット算出に「余剰ストックも目標に含める」オプションを追加し、ON 時 `max(0, (required + stock[rarity]) − owned)` で算出
- [ ] 4.2 ストック上乗せに 1.1 の共有純関数 / `getRarityByCategory` / `efficiency/surplusThreshold` を再利用(クエスト効率と一致)
- [ ] 4.3 ボタン近傍にトグル UI を追加(育成達成が近い上級者向けの控えめな導線)+ i18n キー

## 5. 検証

- [ ] 5.1 `pnpm test` と type-check が通る
- [ ] 5.2 `pnpm dev` で `/quests` の3モード切替(特に不足+余剰ストックでランキングが変わる)を実機確認
- [ ] 5.3 `/material/result` → 周回ソルバー取り込みでストック上乗せが反映され、クエスト効率の目標モードと整合することを実機確認
- [ ] 5.4 既存ユーザー(旧 shortageOnly 保存済み)の選択が維持されることを確認
