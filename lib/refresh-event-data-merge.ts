/**
 * scripts/refresh-event-data.ts の純粋ロジック（副作用なし・テスト対象）。
 *
 * 取り込みを「全置換」から「蓄積マージ」に変えるための関数群:
 *   - 既存 KV(`event_data_json`) を読み込み、今回フェッチ分で id upsert、
 *     取り込み窓の外になった過去イベントは温存する。
 *   - バックフィルの下限（`BACKFILL_SINCE`）パース。
 *
 * fetch・ファイル I/O は呼び出し側（スクリプト）に置き、ここは純粋関数のみ。
 */
import type { EventData, EventPlannerEvent } from './master-data/types'

/**
 * 既存 `EventData` ファイルの内容（任意）をパースして events を返す。
 *
 * 空・空白のみ・undefined は「ベース無し」として常に空配列を返す（初回・キー不在）。
 *
 * 非空なのにパースできない／`events` 配列を持たない場合の扱いは `strict` で分岐:
 *   - `strict: false`（既定）: 空配列にフォールバック（「ベース無し」とみなす）。
 *   - `strict: true`: throw する。ワークフローがベース供給を期待して非空ファイルを
 *     渡したのに壊れている、というのは「初回」と区別できず、空配列に倒すと
 *     フェッチ分だけで KV を上書きして蓄積履歴を失う。これを防ぐため実行を失敗させる。
 */
export function parseExistingEvents(
  raw: string | undefined | null,
  options: { strict?: boolean } = {},
): EventPlannerEvent[] {
  if (!raw) return []
  const trimmed = raw.trim()
  if (trimmed === '') return []
  let data: Partial<EventData>
  try {
    data = JSON.parse(trimmed) as Partial<EventData>
  } catch (e) {
    if (options.strict) {
      throw new Error(
        `existing event data is non-empty but not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
        { cause: e },
      )
    }
    return []
  }
  if (!data || !Array.isArray(data.events)) {
    if (options.strict) {
      throw new Error('existing event data parsed but has no `events` array')
    }
    return []
  }
  return data.events
}

/** events を `startedAt` 昇順（同値は id 昇順）で安定ソートした新配列を返す。 */
function sortEvents(events: EventPlannerEvent[]): EventPlannerEvent[] {
  return [...events].sort((a, b) => a.startedAt - b.startedAt || a.id - b.id)
}

/**
 * 既存 events と今回フェッチ events をマージする。
 * - `id` をキーに upsert（同一 id は新データ優先 = Atlas 修正・周回サンプル増加を反映）。
 * - 今回フェッチに含まれない過去 id は削除せず温存。
 * - 出力は `startedAt` 昇順で安定ソート。
 */
export function mergeEvents(
  existing: EventPlannerEvent[],
  fresh: EventPlannerEvent[],
): EventPlannerEvent[] {
  const map = new Map<number, EventPlannerEvent>()
  for (const e of existing) map.set(e.id, e)
  for (const e of fresh) map.set(e.id, e)
  return sortEvents([...map.values()])
}

/**
 * マージ結果が既存と同一か（差分なし判定）。
 * 既存は旧スクリプトの全置換で任意順に保存されている可能性があるため、
 * 同じソート規則に正規化してから比較する。同一なら書き込みをスキップしてよい。
 */
export function eventsUnchanged(
  existing: EventPlannerEvent[],
  merged: EventPlannerEvent[],
): boolean {
  return JSON.stringify(sortEvents(existing)) === JSON.stringify(merged)
}

/**
 * `BACKFILL_SINCE`（ISO 日付 or Unix 秒）をパースして Unix 秒を返す。
 * 未指定・空・無効値は undefined（＝従来の 30日グレース窓を使う合図）。
 */
export function parseBackfillSince(raw: string | undefined | null): number | undefined {
  if (raw === undefined || raw === null) return undefined
  const trimmed = String(raw).trim()
  if (trimmed === '') return undefined
  // 全桁数字なら Unix 秒として扱う
  if (/^\d+$/.test(trimmed)) {
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : undefined
  }
  // それ以外は ISO 日付としてパース
  const ms = Date.parse(trimmed)
  if (Number.isNaN(ms)) return undefined
  return Math.floor(ms / 1000)
}
