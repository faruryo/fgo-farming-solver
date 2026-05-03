## Why

Cloudflare Workers の無料プランはサブリクエスト上限が 50回/invocation であり、現在の updater-worker は毎回 46/50 を消費している。wave データ (enemy 構成) の取得が updater 実行時に 40件もの HTTP リクエストを発生させているのが主因。しかし wave データはソルバー計算に使用されておらず、クエスト詳細ページの UI 表示にのみ使用されている。ユーザーがクエスト詳細を開いたタイミングで Atlas Academy から直接取得すれば、updater のサブリクエストを大幅に削減できる。

## What Changes

- **updater から wave fetch を削除**: `fetchAndTransformData` の wave データ取得処理をまるごと削除する
- **Quest に `aaQuestId` を保持**: 現在は wave 取得後に削除していた Atlas Academy quest ID を、KV に保存する Quest データに含める
- **Quest から `waves` を削除**: KV に保存されるデータから wave データを除去する
- **クライアントサイドのオンデマンド取得**: クエスト詳細ページで `aaQuestId` を使い Atlas Academy API から直接 wave データをフェッチする `useQuestWave` フックを追加する

## Capabilities

### New Capabilities

- `quest-wave-on-demand`: ユーザーがクエスト詳細を開いたときに Atlas Academy から wave データをオンデマンドで取得する機能

### Modified Capabilities

- `master-data`: Quest データ構造の変更 (`waves` 削除・`aaQuestId` 追加)、wave fetch 処理の削除

## Impact

- **`lib/master-data/update.ts`**: wave fetch ブロックの削除、`_aaQuestId` を削除せず `aaQuestId` として保持
- **`lib/master-data/types.ts`**: Quest 型の変更 (`waves` 削除、`aaQuestId?: number` 追加)
- **`interfaces/api.ts`** (または同等の型定義): Quest 型の同期
- **`app/quests/[id]/page.tsx`**: `quest.waves` の参照を `useQuestWave` フックに置き換え
- **`hooks/use-quest-wave.ts`**: 新規追加
- **`lib/master-data/regression.test.ts`**: wave fetch 件数テストの削除
- **`lib/master-data/update.test.ts`**: wave 関連アサーションの削除
