/**
 * Integration test for the atomic `notification_log` dedup insert documented in the
 * header comment of send-todo-notifications.ts. This intentionally does NOT import
 * that script: its `main()` runs unconditionally at module load (`main().catch(...)`
 * at the bottom of the file, same pattern as every other script in this directory),
 * so importing it would execute the real dispatcher (and throw on missing VAPID env
 * vars) as a side effect of loading the test file. Instead this test shells out to
 * `wrangler d1 execute --local` with the exact same SQL shape as `tryClaimNotification`
 * / `sqlStr` in send-todo-notifications.ts, against the migrated local D1 (see
 * migrations/0004_todo_notifications.sql), to verify the RETURNING-based dedup
 * behavior the dispatcher relies on.
 */
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'

const DB_NAME = 'fgo-farming-solver-db'

interface D1StatementResult<T> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

const sqlStr = (value: string): string => `'${value.replace(/'/g, "''")}'`

const d1ExecuteLocal = <T = Record<string, unknown>>(sql: string): D1StatementResult<T>[] => {
  const out = execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', DB_NAME, '--local', '--command', sql, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return JSON.parse(out) as D1StatementResult<T>[]
}

const tryClaimNotification = (subscriptionId: string, notificationKey: string): boolean => {
  const [stmt] = d1ExecuteLocal<{ subscription_id: string }>(
    `INSERT INTO notification_log (subscription_id, notification_key) VALUES (${sqlStr(subscriptionId)}, ${sqlStr(notificationKey)}) ON CONFLICT(subscription_id, notification_key) DO NOTHING RETURNING subscription_id`
  )
  return stmt.results.length > 0
}

describe('notification_log dedup insert (local D1 integration)', () => {
  const insertedSubscriptionIds: string[] = []

  afterEach(() => {
    while (insertedSubscriptionIds.length > 0) {
      const id = insertedSubscriptionIds.pop()!
      d1ExecuteLocal(`DELETE FROM notification_log WHERE subscription_id = ${sqlStr(id)}`)
    }
  })

  it('claims the notification on the first insert and rejects an identical second insert', () => {
    const subscriptionId = `test-sub-${randomUUID()}`
    const notificationKey = `test-key-${randomUUID()}`
    insertedSubscriptionIds.push(subscriptionId)

    expect(tryClaimNotification(subscriptionId, notificationKey)).toBe(true)
    expect(tryClaimNotification(subscriptionId, notificationKey)).toBe(false)
  })

  it('treats different notification_key values for the same subscription as independent claims', () => {
    const subscriptionId = `test-sub-${randomUUID()}`
    insertedSubscriptionIds.push(subscriptionId)

    expect(tryClaimNotification(subscriptionId, `key-a-${randomUUID()}`)).toBe(true)
    expect(tryClaimNotification(subscriptionId, `key-b-${randomUUID()}`)).toBe(true)
  })
})
