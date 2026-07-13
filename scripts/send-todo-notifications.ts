/**
 * デイリー/ウィークリー/イベント交換/カスタム TODO の期限間近 Web Push 通知を送る
 * GitHub Actions 毎時バッチ（.github/workflows/send-todo-notifications.yml）。
 *
 * 背景: Cloudflare Workers 無料プランは CPU 10ms 超の invocation を確率的に kill
 * するため、通知配信専用の Worker エンドポイントは設けない。本スクリプトが
 * wrangler CLI で D1/KV を直接読み書きし、VAPID 暗号化・送信も CPU 無制限の
 * ランナー側で完結させる（refresh-event-data.ts / run-updater.ts と同じ方針。
 * 詳細は openspec/changes/todo-management/design.md Decisions #3）。
 *
 * 判定ロジック:
 *   - 期間境界・タスクID生成は lib/todo/period.ts / lib/todo/auto-generate.ts の
 *     純粋関数をそのまま import する（クライアントと独立実装しない）。
 *   - 自動生成タスク（daily/weekly/event）は todoState に「存在しない」場合も
 *     未完了として扱う（未オープンユーザーへのリマインドが主目的）。
 *   - カスタムタスクは autoX トグルの対象外。配信可否は D1 の購読レコード存在のみで
 *     判定する（pushEnabled は端末ローカル専用キーに分離済みで KV からは参照しない。
 *     openspec/changes/push-settings-isolation）。
 *
 * 重複防止（アトミック）:
 *   - 送信前に `INSERT INTO notification_log ... ON CONFLICT DO NOTHING RETURNING`
 *     を実行し、RETURNING で実際に行が返った（＝新規挿入できた）ときだけ送信する。
 *   - `wrangler d1 execute --json` の meta に `changes` フィールドが乗らないこと
 *     をローカル D1 (miniflare, wrangler 4.87.0) で確認済みのため、`meta.changes`
 *     ではなく RETURNING の有無で判定する（本ファイル冒頭コメント末尾に検証結果）。
 *
 * KV `dashboard_meta`（DashboardMeta、`.events[]` を含む）について:
 *   - `lib/get-dashboard-meta.ts` と `scripts/run-updater.ts` の双方が同一キー
 *     `dashboard_meta` を MASTER_DATA namespace 上で読み書きしている
 *     （update-master-data.yml が 30分毎に更新）。Atlas API を本スクリプトから
 *     直接叩く必要はなく、この既存キーをそのまま読めば `DashboardEvent[]` が
 *     手に入る。
 *
 * 検証手順（このファイルを書いた時点でのローカル確認結果）:
 *   `wrangler d1 execute <db> --local --command "INSERT ... ON CONFLICT DO
 *   NOTHING" --json` は常に `{"results":[],"success":true,"meta":{"duration":N}}`
 *   を返し、真の INSERT でも `meta.changes` は存在しなかった。一方
 *   `... RETURNING subscription_id` を付けると、新規挿入時のみ
 *   `results:[{"subscription_id":"..."}]`、重複時は `results:[]` となることを
 *   確認した。SQLite の RETURNING は ON CONFLICT DO NOTHING で衝突した行には
 *   何も返さないため、この差分は競合検出に使える。
 *   また `wrangler kv key get` は存在しないキーに対して例外を投げず、終了コード0
 *   のまま stdout に固定文字列 "Value not found" を出すことも確認した
 *   （wrangler-dist/cli.js 内に同文字列がハードコードされている）。JSON.parse の
 *   失敗経由で偶然「データ無し」に倒れることを期待せず、kvGetRemote 内で明示的に
 *   判定する。
 *
 * 安全対策:
 *   本スクリプトは --remote で本番 D1/KV を直接操作する。ローカル検証は
 *   task 6.3 が担当し、--local D1 と wrangler kv / web-push のモックで行う
 *   （このファイル自体は --remote 前提で実装し、モック差し替えは行わない）。
 */
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { sendNotification, setVapidDetails, WebPushError } from 'web-push'

import { generateAutoTasks } from '../lib/todo/auto-generate'
import { buildEventShopTaskId } from '../lib/todo/period'
import type { DashboardEvent, DashboardMeta } from '../lib/master-data/types'
import type { PushSubscriptionRow, TodoSettings, TodoTask } from '../types/todo'

// ── 設定 ─────────────────────────────────────────────────────────────

const DB_NAME = 'fgo-farming-solver-db'
const CLOUD_SAVE_NAMESPACE_ID = 'c621d47e509445a3a7f713702b3cb07e'
const MASTER_DATA_NAMESPACE_ID = '306bbe537e9d4907809f82468df500e4'
const DASHBOARD_META_KEY = 'dashboard_meta'
const VAPID_SUBJECT = 'https://fgo-farming-solver.faru.jp'

const THRESHOLD_MS: Record<TodoTask['category'], number> = {
  daily: 3 * 60 * 60 * 1000,
  weekly: 12 * 60 * 60 * 1000,
  event: 24 * 60 * 60 * 1000,
  custom: 24 * 60 * 60 * 1000,
}

const DEFAULT_SETTINGS: TodoSettings = {
  autoDaily: true,
  autoWeekly: true,
  autoEvent: true,
}

// ── wrangler CLI ラッパー ────────────────────────────────────────────
// execFileSync(argv 配列)で呼ぶことでシェルを介さず、SQL 文字列に含まれ得る
// メタ文字（';' など）がシェル側で誤解釈されるのを防ぐ。

interface D1StatementResult<T> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

const runWrangler = (args: string[]): string =>
  execFileSync('pnpm', ['exec', 'wrangler', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })

const d1Execute = <T = Record<string, unknown>>(sql: string): D1StatementResult<T>[] => {
  const out = runWrangler(['d1', 'execute', DB_NAME, '--remote', '--command', sql, '--json'])
  return JSON.parse(out) as D1StatementResult<T>[]
}

// wrangler は存在しないキーに対して例外を投げず、終了コード0のまま stdout に
// この固定文字列を出す（wrangler-dist/cli.js で確認済み）。JSON.parse の失敗
// 経由で偶然拾うのではなく、ここで明示的にキー不在として扱う。
const KV_NOT_FOUND_MESSAGE = 'Value not found'

/** キー不在・一時的なエラーはいずれも null（「データ無し」として扱う）。 */
const kvGetRemote = (namespaceId: string, key: string): string | null => {
  try {
    const raw = runWrangler(['kv', 'key', 'get', key, '--namespace-id', namespaceId, '--remote'])
    if (raw === KV_NOT_FOUND_MESSAGE) return null
    return raw
  } catch (e) {
    console.warn(`kv key get ${key} failed (treating as missing):`, e)
    return null
  }
}

/**
 * SQL リテラルへのシングルクォートエスケープ（'' への二重化）。
 * notification_key（カスタムタスクは todoState 由来の UUID 文字列）はユーザーが
 * 制御する Cloud Save から来るため、そのまま SQL 文へ埋め込むとインジェクションの
 * 経路になり得る。防御的に必ずこの関数を通す。
 */
const sqlStr = (value: string): string => `'${value.replace(/'/g, "''")}'`

// ── D1: push_subscriptions ───────────────────────────────────────────

const fetchSubscriptions = (): PushSubscriptionRow[] => {
  const [stmt] = d1Execute<PushSubscriptionRow>(
    'SELECT id, user_id, endpoint, p256dh, auth, created_at FROM push_subscriptions'
  )
  return stmt.results
}

/**
 * notification_log への競合検知アトミック insert。
 * RETURNING で行が返った（results.length > 0）ときだけ、この実行が新規挿入に
 * 「勝った」と判定できる（同一 notification_key への二重送信防止）。
 */
const tryClaimNotification = (subscriptionId: string, notificationKey: string): boolean => {
  const [stmt] = d1Execute<{ subscription_id: string }>(
    `INSERT INTO notification_log (subscription_id, notification_key) VALUES (${sqlStr(subscriptionId)}, ${sqlStr(notificationKey)}) ON CONFLICT(subscription_id, notification_key) DO NOTHING RETURNING subscription_id`
  )
  return stmt.results.length > 0
}

/** 410/404 で失効した購読を削除する。FK 制約が無いため notification_log も明示削除する（design.md Decisions #1/#3）。 */
const deleteExpiredSubscription = (subscriptionId: string): void => {
  d1Execute(
    `DELETE FROM push_subscriptions WHERE id = ${sqlStr(subscriptionId)}; DELETE FROM notification_log WHERE subscription_id = ${sqlStr(subscriptionId)}`
  )
}

// ── KV: dashboard_meta / cloud:<userId> ──────────────────────────────

const fetchEvents = (): DashboardEvent[] => {
  const raw = kvGetRemote(MASTER_DATA_NAMESPACE_ID, DASHBOARD_META_KEY)
  if (raw === null) return []
  try {
    const meta = JSON.parse(raw) as DashboardMeta
    return meta.events ?? []
  } catch (e) {
    console.warn('dashboard_meta KV value is not valid JSON; treating as no events:', e)
    return []
  }
}

interface CloudSaveEnvelope {
  storage?: Record<string, string>
}

interface UserTodoData {
  settings: TodoSettings
  tasks: TodoTask[]
}

/**
 * cloud:<userId> を読み、todoSettings/todoState を取り出す。
 * 欠落・破損はいずれも安全側（未同期扱い＝デフォルト設定 / 空タスク）に倒す。
 */
const fetchUserTodoData = (userId: string): UserTodoData => {
  const raw = kvGetRemote(CLOUD_SAVE_NAMESPACE_ID, `cloud:${userId}`)
  if (raw === null) return { settings: DEFAULT_SETTINGS, tasks: [] }

  let storage: Record<string, string> = {}
  try {
    storage = (JSON.parse(raw) as CloudSaveEnvelope).storage ?? {}
  } catch (e) {
    console.warn(`cloud:${userId} is not valid JSON; treating as no data:`, e)
    return { settings: DEFAULT_SETTINGS, tasks: [] }
  }

  let settings: TodoSettings = DEFAULT_SETTINGS
  if (typeof storage.todoSettings === 'string') {
    try {
      settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(storage.todoSettings) as Partial<TodoSettings>) }
    } catch (e) {
      console.warn(`cloud:${userId} todoSettings malformed; using defaults:`, e)
    }
  }

  let tasks: TodoTask[] = []
  if (typeof storage.todoState === 'string') {
    try {
      const parsed = JSON.parse(storage.todoState) as unknown
      if (Array.isArray(parsed)) tasks = parsed as TodoTask[]
    } catch (e) {
      console.warn(`cloud:${userId} todoState malformed; treating as empty:`, e)
    }
  }

  return { settings, tasks }
}

// ── 通知対象判定 ──────────────────────────────────────────────────────

/**
 * 閾値到達（dueAt = deadline - threshold）から期限までを対象とする窓判定。
 *
 * 理由:
 *   - GitHub Actions の schedule 実行は遅延・欠落が常態（実測で実行間隔
 *     1.5〜3.5時間）であり、「毎時必ず1回実行される」前提のワンショット窓
 *     （dueAt から1時間だけ）は、その1時間にバッチが1回も走らないと通知が
 *     永久に飛ばないという欠陥があった（design.md 参照。weekly 通知は実績
 *     ゼロだった）。
 *   - 窓を [dueAt, deadline) まで拡張することで、バッチがいつ実行されても
 *     期限前である限り必ず対象になる。
 *   - 同一タスクへの重複送信は、この窓の広さではなく送信直前の
 *     notification_log へのアトミックな INSERT ... ON CONFLICT DO NOTHING
 *     RETURNING（tryClaimNotification）が防ぐ。窓を広げても送信は
 *     notification_key ごとに最大1回のまま。
 *   - 上限を deadline に取ることで、期限超過後（もう間に合わない）の通知は
 *     送らない。
 */
export const isDueForNotification = (deadlineMs: number, thresholdMs: number, nowMs: number): boolean => {
  const dueAt = deadlineMs - thresholdMs
  return nowMs >= dueAt && nowMs < deadlineMs
}

interface NotificationCandidate {
  notificationKey: string
  title: string
}

export const buildCandidates = (params: {
  nowMs: number
  settings: TodoSettings
  tasks: TodoTask[]
  events: DashboardEvent[]
}): NotificationCandidate[] => {
  const { nowMs, settings, tasks, events } = params
  const candidates: NotificationCandidate[] = []

  const existingById = new Map(tasks.map((t) => [t.id, t]))
  // todoState に存在しない自動生成タスクも未完了とみなす（design.md「未生成＝未完了」）。
  const isIncomplete = (id: string): boolean => {
    const existing = existingById.get(id)
    return existing === undefined || !existing.completed
  }

  const eventNameByTaskId = new Map(events.map((e) => [buildEventShopTaskId(e.id), e.name]))

  // 5.1: 自動生成カテゴリ(daily/weekly/event)は generateAutoTasks で独立に期待
  // タスクを再計算する（クライアントとロジックを共有し、サーバー側で再実装しない）。
  const autoTasks = generateAutoTasks({ now: nowMs, settings, events })
  for (const task of autoTasks) {
    if (!isIncomplete(task.id)) continue
    const deadlineMs = new Date(task.deadline).getTime()
    if (!isDueForNotification(deadlineMs, THRESHOLD_MS[task.category], nowMs)) continue

    const title =
      task.category === 'daily'
        ? 'デイリーミッションの期限が近づいています！'
        : task.category === 'weekly'
          ? 'ウィークリーミッションの期限が近づいています！'
          : `${eventNameByTaskId.get(task.id) ?? task.title} の交換期限が近づいています！`
    candidates.push({ notificationKey: task.id, title })
  }

  // カスタムタスクは autoX トグルの対象外。D1 に購読レコードがあること自体が配信条件。
  for (const task of tasks) {
    if (task.category !== 'custom' || task.completed) continue
    const deadlineMs = new Date(task.deadline).getTime()
    if (!isDueForNotification(deadlineMs, THRESHOLD_MS.custom, nowMs)) continue
    candidates.push({ notificationKey: task.id, title: `${task.title} の期限が近づいています！` })
  }

  return candidates
}

// ── メイン ────────────────────────────────────────────────────────────

async function main() {
  const nowMs = Date.now()
  console.log(`[send-todo-notifications] start nowMs=${nowMs} (${new Date(nowMs).toISOString()})`)

  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
  if (!vapidPublicKey || !vapidPrivateKey) {
    throw new Error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY must be set (GitHub Secrets in CI, .env.local locally)')
  }
  setVapidDetails(VAPID_SUBJECT, vapidPublicKey, vapidPrivateKey)

  const subscriptions = fetchSubscriptions()
  console.log(`Fetched ${subscriptions.length} push subscription(s)`)
  if (subscriptions.length === 0) {
    console.log('No subscriptions; nothing to do.')
    return
  }

  // event_data のイベント一覧はユーザー間で共有なので1回だけ取得する。
  const events = fetchEvents()
  console.log(`Fetched ${events.length} dashboard event(s) for event-shop deadline checks`)

  let sentCount = 0
  let expiredCleanedCount = 0
  let failedCount = 0

  for (const sub of subscriptions) {
    const { settings, tasks } = fetchUserTodoData(sub.user_id)

    // D1 に購読レコードが存在すること自体が配信条件（pushEnabled は端末ローカル専用
    // キーに分離済みのため KV からは参照しない。openspec/changes/push-settings-isolation）。
    const candidates = buildCandidates({ nowMs, settings, tasks, events })
    for (const candidate of candidates) {
      const won = tryClaimNotification(sub.id, candidate.notificationKey)
      if (!won) {
        console.log(`Skip (already sent) key=${candidate.notificationKey} sub=${sub.id}`)
        continue
      }

      try {
        await sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: candidate.title, body: '', url: '/' })
        )
        sentCount++
        console.log(`Sent key=${candidate.notificationKey} sub=${sub.id}`)
      } catch (e) {
        const statusCode = e instanceof WebPushError ? e.statusCode : undefined
        if (statusCode === 404 || statusCode === 410) {
          console.log(`Subscription ${sub.id} expired (status ${statusCode}); deleting subscription + log rows`)
          deleteExpiredSubscription(sub.id)
          expiredCleanedCount++
          break // この購読は死んでいるので残りの candidate も送らない
        }
        failedCount++
        console.error(`Failed to send key=${candidate.notificationKey} sub=${sub.id}:`, e)
      }
    }
  }

  console.log(
    `[send-todo-notifications] done. subscriptions=${subscriptions.length} sent=${sentCount} ` +
      `expiredCleaned=${expiredCleanedCount} failed=${failedCount}`
  )
}

// main() は module load 時に無条件実行されるため、テストからこのファイルの
// export（isDueForNotification / buildCandidates）を安全に import できるよう、
// スクリプトとして直接実行された（tsx scripts/send-todo-notifications.ts）場合
// にのみ起動する。
const isMainModule = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (isMainModule) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
