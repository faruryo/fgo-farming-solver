## 1. Solver API

- [ ] 1.1 5パターン（runs / ap / even-turn / even-ap / exhaust）の皿ベクトルを返す純関数を `lib/event-craft-advisor.ts` に追加し、Stage1 turn/ap を runs/ap に再利用する
- [ ] 1.2 正の多重集合を表示済みカード全体（exhaust除く）と比較する畳みを純関数化し、even-turn が ap と一致して runs と異なるケース、even-ap が even-turn と一致するケースを `lib/event-craft-advisor.test.ts` で検証する
- [ ] 1.4 5本が同一の料理yieldマップ（期待値があればバスケット）を使い、even だけ主産物1個に戻らないことをテストする
- [ ] 1.3 各パターンの `n'` を turn と ap の `continuousOptimalCost` で評価する（クエスト内訳は返さない）

## 2. 満遍なく

- [ ] 2.1 単独周回負担・単独AP負担の max を下げる別MILP（クエスト変数なし、同点は消費食材最小）を実装する
- [ ] 2.2 金の単独負担が高いと銅個数より金料理が選ばれるケース、周回案では0のついで素材が even-turn では1以上になるケース、even-turn と even-ap で皿が分かれるケースをテストする

## 3. 使い切り

- [ ] 3.1 食材残り合計最小のあと残余周回コスト最小の辞書式を実装する
- [ ] 3.2 周回案と正の皿が同じでも exhaust は畳まないこと、余りが周回案より少ないケース、評価に周回とAPが両方載ることをテストする

## 4. UI と永続

- [ ] 4.1 料理タブから AP/周回スイッチと使い切りトグルを外す（配布タブの分母スイッチは維持）
- [ ] 4.2 パターンカード（選択、作成数>0、単位どおりの残余、`同じ:` aliases、余り食材）と日英 `t()` を追加する
- [ ] 4.3 `planPattern` 永続、旧 exhaust のマップ、非表示IDの吸収先フォールバックを純関数でテストする
- [ ] 4.4 マシュを選択パターン基準にし、コンポーネントテストで推奨0非表示・常時2枚（周回と使い切り）・条件付きカード・畳みラベル・選択フォールバックを検証する

## 5. 検証

- [ ] 5.1 対象テストと `pnpm run type-check` を通す
- [ ] 5.2 `openspec validate event-craft-plan-patterns --strict` を通す
- [ ] 5.3 `event-craft-expected-yields` が未アーカイブなら先に適用／アーカイブし、本changeを後にする（逆順禁止）
