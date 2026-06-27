## Context

イベントデータ取り込みは「重い fetch は GitHub Actions、Worker は KV 読むだけ」方針で、`scripts/refresh-event-data.ts` が Atlas から取得・コンパクト化して `event_data.json` を書き出し、ワークフロー `refresh-event-data.yml` が `wrangler kv key put event_data_json` で**全置換**アップロードする。

現状の要点（実コード）:
- 対象フィルタ: `e.type === 'eventQuest' && e.endedAt > nowSec - 30日`（`ENDED_GRACE_DAYS = 30`）。
- 書き込み: `results`（今回フェッチ分）だけで `EventData = { events, updatedAt }` を生成し**ファイル全置換**。スクリプトは既存 KV を読まない。
- no-op 温存: `results.length === 0` のときファイルを書かず正常終了 → ワークフローが `if -f event_data.json` で put をスキップ → 既存 KV 温存。
- 上流障害保護: `basicEvents.length === 0` なら `throw`（空書き拒否）。

問題: 全置換のため、毎回 30日窓に入る分しか残らず、過去ロトは KV から消える。終了済みシミュレートを実データで使えない。

## Goals / Non-Goals

**Goals:**
- 過去のロト型イベントを KV `event_data_json` に**恒久蓄積**し、終了済みシミュレートをいつでも実データで行える。
- 既に消えた／未取り込みの過去ロトを**一括バックフィル**で初期投入できる。
- 既存の安全弁（上流障害時の空書き拒否、変化なし時の非破壊）を維持する。
- 読み取り側（`lib/get-events.ts`・`/events`・計画ページ）を**無改修**で動かす（スキーマ不変）。

**Non-Goals:**
- 過去イベントのドロップ率精度改善。
- `/events` 終了済みグループの UI 改善（年次グルーピング等、別 change）。
- 恒常ドロップ `all_drops_json`・`getWars` の `eventId == 0` フィルタへの変更。

## Decisions

### D1: マージのベースはワークフローが `wrangler kv key get` で供給
スクリプトは Worker に依存せず純粋に保つため、**既存 KV の取得はワークフロー側**で行う。put 前に
`wrangler kv key get event_data_json --remote > existing.json`（無ければ空扱い）を実行し、スクリプトに既存ファイルパスを渡す。スクリプトは「既存（任意）＋今回フェッチ」をマージして出力する。
- スクリプト引数: `tsx scripts/refresh-event-data.ts <outPath> [existingPath]`。`existingPath` 省略時は既存なし（従来動作のスーパーセット）。

### D2: マージ意味論（id キー upsert・古いものは温存）
- 既存 `events` を `Map<event.id, EventPlannerEvent>` に読み込む。
- 今回フェッチした各イベントで **upsert**（同一 id は新データ優先 ＝ Atlas 修正・周回サンプル増加を反映）。
- 今回フェッチに含まれない過去 id は**削除しない**（温存）。
- 出力 `events` は `startedAt` 昇順で安定ソート。`updatedAt` は実行時刻。
- 表示順は `/events` 側が `nowSec` で active/ended/upcoming に再分類するため、保存順は内部安定性のためだけ。

### D3: バックフィルは取り込み窓の下限を広げる一回実行
- `workflow_dispatch` 入力 `backfill_since`（ISO 日付 or Unix 秒）を追加。スクリプトは環境変数 `BACKFILL_SINCE` を読み、あれば対象フィルタの下限を
  `e.endedAt > BACKFILL_SINCE`（30日グレースの代わり）に切り替える。
- 通常の日次 cron は従来どおり 30日窓で**フェッチ**（軽量）。過去分はマージで温存されるので日次窓を広げる必要はない。
- バックフィルは一回流せば、以後はマージで維持される。

### D4: 書き込み／no-op ルール（マージ後）
- `basicEvents.length === 0`（上流障害）→ 従来どおり `throw`（空書き拒否）。
- 今回フェッチ新規 0 件でも、**既存ファイルがあればそのまま（マージ結果＝既存）出力**して put してよい（内容不変なので実害なし）。ただし不要 put を避けるため「新規 upsert 0 件 かつ 既存あり」のときはファイルを書かずスキップ（＝既存 KV 温存）でもよい。**実装は「マージ結果が既存と同一なら書かない」**を基準にする（差分があるときだけ put）。
- 既存も新規も無い（初回・完全空）→ 従来どおりファイル未書き込みで no-op。

### D5: スキーマ・読み取り側
- `EventData = { events: EventPlannerEvent[], updatedAt: number }` は不変。
- `lib/get-events.ts`（`getEvents`/`getActiveEvents`/`getEventById`）は無改修。`getEventById` は会期非依存なので過去イベントもそのまま開ける。

## Risks / Trade-offs

- **blob サイズ増加**: ロトは年1〜3件。1イベント数十 KB として数年で数百 KB 規模。KV 値上限 25MB・読み取りコストに対し十分小さい。将来肥大が問題化したら「直近 N 年だけ保持」等のトリミングを別途検討（本 change ではしない）。
- **古い `nice_event` のスキーマドリフト**: 過去イベントは現行と構造が異なる可能性。既存の `validateAtlasEvent`/`validateLottery` のスキップ機構でフェイルセーフ（壊れたものは飛ばして他に影響させない）。バックフィルで一部の古いイベントが取り込めなくても許容。
- **バックフィルのフェッチ負荷**: 過去全件の `nice_event`＋`warIds` 周回ノード取得は重い。GH Actions（CPU 無制限）の手動一回実行に限定し、日次 cron には載せない。
- **マージベース取得失敗**: `wrangler kv key get` が空/失敗のとき。空＝初回扱いで従来動作にフォールバック（既存なしマージ＝今回分のみ）。失敗（ネットワーク等）は既存温存のため put をスキップする運用にする。
