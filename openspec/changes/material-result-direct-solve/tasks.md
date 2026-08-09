## 1. クエストカタログの経路追加

- [ ] 1.1 `app/material/result/page.tsx`で`getDrops()`/`getLocalQuests()`をSSR取得し、`Result`へ`quests`propsとして渡す。
- [ ] 1.2 `components/material/result.tsx`(`MaterialResultProps`)に`quests`を追加する。

## 2. 周回対象クエスト選択UIの統合

- [ ] 2.1 `useQuestTree`/`useChecked`/`useCheckboxTree`を`/material/result`側で呼び出し、`CheckboxTree`を表示するセクションを追加する(既定は折りたたみ、全選択済み)。
- [ ] 2.2 選択状態が`localStorage['excludedQuests']`を`/farming`と共有することを確認する(専用stateを持たない)。

## 3. 直接送信ロジックの実装

- [ ] 3.1 `/farming`の`handleSubmit`(バリデーション → `/api/solve`呼び出し → `localStorage['farming/results']`書き込み+`ls-sync`発火 → `saveProgressSnapshot()` → `router.push`)を参考に、`/material/result`の送信ボタン用ロジックを実装する。
- [ ] 3.2 バリデーション: アイテム最低1件(既存の`plainDeficiency`不足判定を流用)、周回対象クエスト最低1件、の2ガードを追加する。
- [ ] 3.3 `goSolver`を、`router.push('/farming?...')`から直接`/api/solve`を呼ぶ形に書き換える。
- [ ] 3.4 ローディング状態(送信中スピナー)を追加する。

## 4. /farmingの到達不能コード削除

- [ ] 4.1 `components/farming/index.tsx`の`stockItemsParam` state、`itemsStockRaw`読み取り(204-205行目)、送信時の条件分岐(217-222行目)を削除する。
- [ ] 4.2 `openspec/specs/solver/spec.md`・`openspec/specs/material/spec.md`をこのchangeの内容で更新(apply時に自動反映)。

## 5. テスト

- [ ] 5.1 `/material/result`から目標A・B(stockEnabled=ON/OFF両方)を正しく送信できることを確認するテスト。
- [ ] 5.2 クエスト除外時に`/api/solve`への送信内容が正しく反映されることを確認するテスト。
- [ ] 5.3 アイテム0件・クエスト0件それぞれのバリデーションが機能することを確認するテスト。
- [ ] 5.4 `/farming`への直接アクセス(手入力)が従来どおり動作することを確認する回帰テスト。
- [ ] 5.5 削除した`stockItemsParam`関連コードが残っていないことをテスト/grepで確認する。

## 6. 検証

- [ ] 6.1 `pnpm typecheck` / 該当テストスイートを実行する。
- [ ] 6.2 dev server実機で、サーヴァント選択 → `/material/result`(クエスト選択含む) → 送信 → `/farming/results/[id]`の一連の遷移を確認する。
- [ ] 6.3 `localStorage['farming/results']`・`ls-sync`イベント・進捗スナップショットが従来どおり記録されることを確認する。
- [ ] 6.4 `/farming`への直接アクセスで手入力→送信が従来どおり動作することを確認する。
