## 1. クエストカタログの経路追加

- [x] 1.1 `app/material/result/page.tsx`で`getDrops()`/`getLocalQuests()`をSSR取得し、`Result`へ`quests`propsとして渡す。
- [x] 1.2 `components/material/result.tsx`(`MaterialResultProps`)に`quests`を追加する。

## 2. 周回対象クエスト選択UIの統合

- [x] 2.1 `components/farming/index.tsx`に埋め込まれている「旧`quests`→`excludedQuests`への一方向移行」「`excludedQuests`→`checkedQuests`反転アダプタ」「`quests`への同期用デュアルライト(`ls-sync`発火)」(同ファイル95-155行目)を共有フック(例: `useExcludedQuests`)へ切り出す。これは`openspec/specs/sync/spec.md`の「除外クエストリストの永続化と同期」要件(旧`quests`キーへのデュアルライトをSHALLで要求)を満たすために必須。
- [x] 2.2 `useQuestTree`/`useChecked`/`useCheckboxTree`と2.1の共有フックを`/material/result`側で呼び出し、`CheckboxTree`を表示するセクションを追加する(既定は折りたたみ、全選択済み)。
- [x] 2.3 `/farming`側も2.1の共有フックを使うようリファクタリングし、ロジックの二重実装を避ける。
- [x] 2.4 旧`quests`キーのみ存在し`excludedQuests`が未設定の状態で`/material/result`を先に開いた場合に、移行が正しく行われ`/farming`側の状態と一致することを確認する回帰テストを追加する。
- [x] 2.5 クエスト選択セクションの見出し等、新設するUI文字列はハードコードせず`t('kebab-key', '日本語フォールバック')`で実装し、`locales/ja.json`・`locales/en.json`の両方にキーを追加する(AGENTS.md記載のi18n規約、BLOCKER)。`/farming`と同一の文言(セクション見出し等)は既存キーの再利用を検討し、namespaceが異なり直接参照できない場合は新規kebab-caseキーを追加する。

## 3. 直接送信ロジックの実装

- [x] 3.1 `/farming`の`handleSubmit`(バリデーション → `/api/solve`呼び出し → `localStorage['farming/results']`書き込み+`ls-sync`発火 → `saveProgressSnapshot()` → `router.push`)を`/material/result`の送信ボタン用に移植する。入力形式が異なる(`itemCounts` vs `amounts`/`possession`)ためフロー全体は共有フック化しないが、バリデーション条件の判定関数と副作用(`farming/results`書き込み+`ls-sync`+`saveProgressSnapshot`+遷移)の呼び出し部分は共通関数として切り出し、`/farming`・`/material/result`の両方から呼ぶ(重複実装にしない)。
- [x] 3.2 バリデーション: 目標Aまたは目標Bのいずれかに1件以上(目標Aのみで判定しない。stock-only素材だけの場合、目標Aは0件でも目標Bは非0件になりうるため)、周回対象クエスト最低1件、の2ガードを追加する。表示メッセージは2.5と同様に`t()`経由とし、`/farming`の既存バリデーションメッセージ(`集めたいアイテムの数を最低1つ入力してください。`等)と文言をなるべく揃える。
- [x] 3.3 `goSolver`を、`router.push('/farming?...')`から直接`/api/solve`を呼ぶ形に書き換える。
- [x] 3.4 ローディング状態(送信中スピナー)を追加する。

## 4. /farmingの到達不能コード削除

- [x] 4.1 `components/farming/index.tsx`の`stockItemsParam` state、`itemsStockRaw`読み取り(204-205行目)、送信時の条件分岐(217-222行目)を削除する。
- [ ] 4.2 `openspec/specs/solver/spec.md`・`openspec/specs/material/spec.md`をこのchangeの内容で更新(apply時に自動反映)。

## 5. テスト

- [x] 5.1 `/material/result`から目標A・B(stockEnabled=ON/OFF両方、目標A>0の通常ケース)を正しく送信できることを確認するテスト。
- [x] 5.2 クエスト除外時に`/api/solve`への送信内容が正しく反映されることを確認するテスト。
- [x] 5.3 バリデーション境界値のテスト: (a) 目標A=0・目標B>0(stock-only素材のみ)のとき送信できる、(b) 目標A=0・目標B=0(またはstockEnabled=OFFで目標A=0)のとき送信がブロックされる、(c) クエスト0件のとき送信がブロックされる、の3ケースを個別に確認する。
- [x] 5.4 `/farming`への直接アクセス(手入力)が従来どおり動作することを確認する回帰テスト。
- [x] 5.5 削除した`stockItemsParam`関連コードが残っていないことをテスト/grepで確認する。

## 6. 検証

- [x] 6.1 `pnpm run type-check` / 該当テストスイートを実行する。
- [x] 6.2 dev server実機で、サーヴァント選択 → `/material/result`(クエスト選択含む) → 送信 → `/farming/results/[id]`の一連の遷移を確認する。
- [x] 6.3 `localStorage['farming/results']`・`ls-sync`イベント・進捗スナップショットが従来どおり記録されることを確認する。
- [x] 6.4 `/farming`への直接アクセスで手入力→送信が従来どおり動作することを確認する。
