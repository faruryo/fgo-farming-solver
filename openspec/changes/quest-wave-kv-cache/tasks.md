## 1. 型定義の更新

- [x] 1.1 `lib/master-data/types.ts` の Quest 型から `waves?: Wave[]` を削除し `aaQuestId?: number` を追加する
- [x] 1.2 `lib/master-data/types.ts` の Wave・Enemy 型はそのまま保持する (useQuestWave フックで使用)
- [x] 1.3 `interfaces/api.ts` の Quest 型から `waves?: ...` を削除し `aaQuestId?: number` を追加する

## 2. テストを先に書く (TDD: RED フェーズ)

- [x] 2.1 `lib/master-data/regression.test.ts` の wave fetch 件数テスト (40件上限) を削除する
- [x] 2.2 `lib/master-data/regression.test.ts` に新テスト追加: `fetchAndTransformData` 実行中に `/quest/` への fetch が 0 件であること
- [x] 2.3 `lib/master-data/regression.test.ts` に新テスト追加: AA quest と一致したクエストの出力に `aaQuestId` が含まれること
- [x] 2.4 `lib/master-data/update.test.ts` の wave 関連アサーションを削除または更新する (wave アサーションなし・変更不要)
- [x] 2.5 `pnpm test` を実行して新規追加テストが RED (失敗) になることを確認する

## 3. `fetchAndTransformData` の実装変更 (GREEN フェーズ)

- [x] 3.1 `lib/master-data/update.ts` の wave fetch ブロック (questsWithAA のフェッチ・isNode 判定・CONCURRENCY ループ) をまるごと削除する
- [x] 3.2 `_aaQuestId` を `delete` していた箇所を、`q.aaQuestId = q._aaQuestId` として Quest データに保持するよう変更する
- [x] 3.3 不要になった `ATTRIBUTE_MAP` 定数を削除する
- [x] 3.4 `pnpm test` を実行して全テストが GREEN になることを確認する

## 4. `useQuestWave` フックの新規追加

- [x] 4.1 `hooks/use-quest-wave.ts` を新規作成する
  - シグネチャ: `useQuestWave(aaQuestId?: number): { waves: Wave[] | undefined, isLoading: boolean }`
  - `aaQuestId` が undefined の場合はフェッチしない
  - Atlas Academy エンドポイント: `${origin}/nice/${region}/quest/${aaQuestId}/1`
  - `stages` から Wave[] を構築し返す (ATTRIBUTE_MAP は hooks 内で定義)
  - エラー時は `waves: undefined` を返す

## 5. クエスト詳細ページの更新

- [x] 5.1 `app/quests/[id]/page.tsx` に `useQuestWave` フックを追加し `quest.aaQuestId` を渡す
- [x] 5.2 `quest.waves` の参照をすべて `useQuestWave` の戻り値 `waves` に置き換える
- [x] 5.3 `isLoading` が true の間は wave セクションにスピナーを表示する
- [x] 5.4 `waves` が undefined または空の場合は既存の "Enemy data not available" UI を表示する

## 6. 最終検証

- [x] 6.1 `pnpm test` — 全テスト GREEN
- [x] 6.2 `pnpm run type-check` — 型エラーなし
- [x] 6.3 `pnpm run build` — ビルド成功
