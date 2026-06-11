# Design: 計算履歴の論理削除と対象クエスト可視化

## DB スキーマ（D1 マイグレーション `0002`）

```sql
ALTER TABLE farming_results ADD COLUMN deleted_at DATETIME;      -- NULL = 有効
ALTER TABLE farming_results ADD COLUMN quest_selection TEXT;     -- JSON, NULL = 旧データ
```

- 既存行はどちらも NULL → 影響なし。インデックスは既存の `idx_results_user_id` で十分（履歴は user_id 絞り込み後 50 件 LIMIT のため partial index は不要）。
- 適用: `wrangler d1 migrations apply fgo-farming-solver-db --remote`（ローカルは `--local`）。

## `quest_selection` の JSON 形式

```ts
interface QuestSelection {
  total: number                    // 計算時に存在した全クエスト数
  selected: number                 // 対象として選択されていた数
  mode: 'excluded' | 'selected'    // quests に入っている側（少ない側を保存）
  quests: { area: string; name: string }[]  // 上限 100 件
  truncated?: boolean              // 上限超過で切り詰めた場合 true
}
```

- **名前で非正規化**: 短縮IDは世代間で不安定だった実績があるため保存しない。`result_data` がクエスト名を非正規化しているのと同じ自己完結パターン。
- **少ない側を保存**: 「ほぼ全選択(除外7件)」も「少数精鋭(選択10件)」もコンパクトに収まる。両側が巨大なケースのみ truncated。
- 生成場所: `app/api/solve/route.ts` — `drops.quests`（全量）と `allowedQuests`（選択ID）が手元に揃っており、`drops.quests` から ID→{area,name} を引いて構築。選択IDのうち現データに存在しないIDは無視（selected はマッチ数で数える）。

## API

### `DELETE /api/farming/results/[id]`（新設、既存 GET と同居）

1. `auth()` でセッション取得。未ログイン → 401。
2. `UPDATE farming_results SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL`
3. `meta.changes === 0` → 404（存在しない / 他人の結果 / 削除済み）。成功 → `{ ok: true }`。
4. dev（`NODE_ENV === 'development'`）: D1 が無いため `{ ok: true }` を返す no-op（既存 history GET の mock フォールバックと同じ流儀）。

物理削除しないため、誤削除はDB操作で復元可能（`deleted_at = NULL`）。結果ページの `getResult` は `deleted_at` を見ない → 共有リンクは生き続ける。

### `GET /api/farming/history`（変更）

```sql
SELECT id, objective, target_items, total_ap, total_lap, quest_selection, created_at
FROM farming_results
WHERE user_id = ? AND deleted_at IS NULL
ORDER BY created_at DESC LIMIT 50
```

履歴を消費する全グラフ（履歴ページ・結果ページの `FarmingHistoryChart`・ダッシュボード HistoryGraph）はこの API 経由のため、削除行は自動的にトレンドから除外される。

## UI（`app/farming/history/page.tsx`）

- **削除**: 各行末尾にゴミ箱アイコンの ghost ボタン → shadcn `AlertDialog` で確認（「この履歴を削除しますか？グラフからも除外されます。共有済みの結果ページは引き続き閲覧できます。」）→ DELETE 成功で `setHistory` から該当行を除去。失敗時は toast 等で通知。
- **対象クエスト列**: `quest_selection` があれば `selected/total`（例 `238/304`）の Badge を表示。`selected < total` のときクリックで `Popover`（または Tooltip）を開き、mode に応じ「除外: 〔エリア〕クエスト名 ×N」一覧を表示。truncated なら「他 N 件」を付記。NULL（旧データ）は `—`。
- `HistoryItem` 型（`components/farming/FarmingHistoryChart.tsx` で export）に `quest_selection?: string` を追加。チャート側は未使用なので表示ロジックはページ側でのみ parse。
- i18n: `locales/{ja,en}/farming.json` 等に「削除」「対象クエスト」「除外クエスト」「この履歴を削除しますか？」等のキーを追加。

## セキュリティ / 整合性

- 削除は `user_id` 一致必須（所有者のみ）。CSRF: 既存の同一オリジン fetch + セッション cookie 方式に準拠。
- `quest_selection` はサーバー側で `drops` から生成するため、クライアント改竄の影響は表示のみに限定。
