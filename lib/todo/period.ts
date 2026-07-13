/**
 * JST（UTC+9, DST無し）の期間境界を扱う純粋関数群。
 * フレームワーク/ブラウザ依存を一切持たない（GHA ディスパッチャ script からも import される）。
 *
 * 境界の定義:
 * - デイリー: 毎日 0:00 JST にリセット。期限（deadline）はその1分前、23:59 JST。
 * - ウィークリー: 毎週月曜 0:00 JST にリセット。期限は日曜 23:59 JST。
 * - 週番号は ISO 8601 週番号（月曜始まり、年をまたぐ週は Thursday が属する年に帰属）を使用。
 *   表示用途は無く TODO ID 生成にのみ使うため、内部で一貫していればよい。
 */

const JST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
const DAILY_RESET_OFFSET_MS = 0 // 0:00 AM JST
const ONE_MINUTE_MS = 60 * 1000

const pad2 = (n: number): string => String(n).padStart(2, '0')

// "shifted" ms: UTC field getters on this value read out JST wall-clock numbers.
const toShiftedMs = (nowMs: number): number => nowMs + JST_OFFSET_MS

const dailyDayIndex = (nowMs: number): number =>
  Math.floor((toShiftedMs(nowMs) - DAILY_RESET_OFFSET_MS) / DAY_MS)

export const getJstDayKey = (nowMs: number): string => {
  const idx = dailyDayIndex(nowMs)
  const d = new Date(idx * DAY_MS)
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}`
}

export const getDailyTaskDeadlineMs = (nowMs: number): number => {
  const idx = dailyDayIndex(nowMs)
  const nextResetShifted = (idx + 1) * DAY_MS + DAILY_RESET_OFFSET_MS
  const nextResetReal = nextResetShifted - JST_OFFSET_MS
  return nextResetReal - ONE_MINUTE_MS
}

// Shifted-frame ms of the Monday 0:00 JST that starts the week containing nowMs.
const weekStartShiftedMs = (nowMs: number): number => {
  const shifted = toShiftedMs(nowMs)
  const todayStartShifted = Math.floor(shifted / DAY_MS) * DAY_MS
  const dayOfWeek = new Date(todayStartShifted).getUTCDay() // 0=Sun..6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7 // Mon=0..Sun=6
  return todayStartShifted - daysSinceMonday * DAY_MS
}

export const getJstWeekKey = (nowMs: number): string => {
  const monday = new Date(weekStartShiftedMs(nowMs))
  // ISO 8601 week number, computed from the Monday date directly (already day 1 of the ISO week).
  const thursday = new Date(monday)
  thursday.setUTCDate(thursday.getUTCDate() + 3)
  const isoYear = thursday.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil((((thursday.getTime() - yearStart.getTime()) / DAY_MS) + 1) / 7)
  return `${isoYear}W${pad2(week)}`
}

export const getWeeklyTaskDeadlineMs = (nowMs: number): number => {
  const nextMondayShifted = weekStartShiftedMs(nowMs) + WEEK_MS
  const nextMondayReal = nextMondayShifted - JST_OFFSET_MS
  return nextMondayReal - ONE_MINUTE_MS
}

export const buildDailyTaskId = (nowMs: number): string => `daily-${getJstDayKey(nowMs)}`

export const buildWeeklyTaskId = (nowMs: number): string => `weekly-${getJstWeekKey(nowMs)}`

export const buildEventShopTaskId = (eventId: number): string => `event-shop-${eventId}`

export const isEventActiveForShop = (
  event: { startedAt: number; endedAt: number; shopFinishedAt: number },
  nowMs: number
): boolean => nowMs >= event.startedAt * 1000 && nowMs < event.shopFinishedAt * 1000
