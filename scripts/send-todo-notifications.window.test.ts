/**
 * `isDueForNotification` の窓判定テスト（design.md Decisions #1: 判定窓を
 * 「閾値時刻から期限まで」に拡張）。
 *
 * send-todo-notifications.ts は `main()` が module load 時に無条件実行される
 * スクリプトだが、ファイル末尾で `process.argv[1]` を見て「直接実行された
 * ときのみ main() を起動する」ガードを追加済みのため、この import 自体は
 * main() を起動しない（VAPID env var 不足による例外は発生しない）。
 */
import { describe, expect, it } from 'vitest'

import { isDueForNotification } from './send-todo-notifications'

describe('isDueForNotification', () => {
  const thresholdMs = 3 * 60 * 60 * 1000 // daily の閾値（3h）を代表値として使う
  const deadlineMs = Date.parse('2026-07-11T12:00:00.000Z')
  const dueAt = deadlineMs - thresholdMs // 2026-07-11T09:00:00.000Z

  it('窓開始から1時間以上経過・期限前 → true', () => {
    const nowMs = dueAt + 2 * 60 * 60 * 1000 // dueAt + 2h、まだ deadline 前
    expect(isDueForNotification(deadlineMs, thresholdMs, nowMs)).toBe(true)
  })

  it('期限ちょうど → false', () => {
    expect(isDueForNotification(deadlineMs, thresholdMs, deadlineMs)).toBe(false)
  })

  it('期限超過 → false', () => {
    const nowMs = deadlineMs + 60 * 1000
    expect(isDueForNotification(deadlineMs, thresholdMs, nowMs)).toBe(false)
  })

  it('窓開始前(dueAt未満) → false', () => {
    const nowMs = dueAt - 60 * 1000
    expect(isDueForNotification(deadlineMs, thresholdMs, nowMs)).toBe(false)
  })

  it('窓開始ちょうど → true', () => {
    expect(isDueForNotification(deadlineMs, thresholdMs, dueAt)).toBe(true)
  })
})
