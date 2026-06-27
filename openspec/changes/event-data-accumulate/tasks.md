# Tasks: event-data-accumulate

## 1. スクリプト: 蓄積マージ化
- [x] 1.1 `scripts/refresh-event-data.ts` に第2引数 `existingPath`（任意）を追加し、あれば既存 `EventData` を読み込む（無効/空は「既存なし」扱い）。
- [x] 1.2 既存 `events` を `Map<id, EventPlannerEvent>` 化し、今回フェッチ結果を upsert（同一 id は新優先）、過去 id は温存。`startedAt` 昇順で安定ソートして出力。
- [x] 1.3 書き込みルール改定: マージ結果が既存と同一なら書かない（差分時のみ出力）。`basic_event.json` 空時の `throw`（空書き拒否）は維持。初回（既存なし・新規なし）は従来どおりファイル未書き込みで no-op。
- [x] 1.4 純粋ロジック（既存events + 新events → マージ済みevents）を関数として切り出し、単体テスト（温存・upsert上書き・ソート・差分なし判定・空入力境界）。

## 2. スクリプト: 過去バックフィル
- [x] 2.1 環境変数 `BACKFILL_SINCE`（ISO 日付 or Unix 秒）を読み、あれば対象フィルタの下限を `e.endedAt > BACKFILL_SINCE` に切り替える（未指定時は従来の 30日グレース）。パース・単体テスト。
- [x] 2.2 バックフィル時のフェッチ負荷に配慮したログ（対象件数・進捗）を出す。

## 3. ワークフロー: マージベース供給とバックフィル導線
- [x] 3.1 `.github/workflows/refresh-event-data.yml`: KV put 前に `wrangler kv key get event_data_json --remote > existing.json`（無ければ空）を実行し、`tsx scripts/refresh-event-data.ts event_data.json existing.json` に渡す。put は従来どおり差分ファイルがあるときのみ。
- [x] 3.2 `workflow_dispatch` 入力 `backfill_since` を追加し、`BACKFILL_SINCE` env として渡す（通常 cron は未指定＝従来窓）。
- [x] 3.3 既存 KV 取得失敗時は put をスキップ（既存温存）するガードをワークフローに入れる。

## 4. 検証
- [x] 4.1 `pnpm run type-check` / `pnpm run lint` / 関連テスト緑。
- [x] 4.2 ローカルで擬似 existing.json＋mock フェッチによりマージ出力を確認（温存・upsert・差分なしスキップ）。
- [ ] 4.3 （任意・要許可）ステージング相当でバックフィル一回実行 → `/events` プレビューで過去イベントが出る・終了済みシミュレートできることを browser-use で実機確認。
- [x] 4.4 `openspec validate event-data-accumulate --strict` → valid。
