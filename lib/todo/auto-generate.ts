import type { TodoTask, TodoSettings } from '../../types/todo'
import type { DashboardEvent } from '../master-data/types'
import {
  buildDailyTaskId,
  buildWeeklyTaskId,
  buildEventShopTaskId,
  getDailyTaskDeadlineMs,
  getWeeklyTaskDeadlineMs,
  isEventActiveForShop,
} from './period'

/**
 * 現在時刻・設定・開催中イベントから「今存在すべき」自動生成 TODO の一覧を返す。
 * 既存の todoState とのマージは mergeAutoTasks が担う（ここでは常に未完了で返す）。
 */
export const generateAutoTasks = (params: {
  now: number
  settings: TodoSettings
  events: DashboardEvent[]
}): TodoTask[] => {
  const { now, settings, events } = params
  const tasks: TodoTask[] = []

  if (settings.autoDaily) {
    tasks.push({
      id: buildDailyTaskId(now),
      title: 'デイリーミッションをクリアする',
      category: 'daily',
      deadline: new Date(getDailyTaskDeadlineMs(now)).toISOString(),
      completed: false,
    })
  }

  if (settings.autoWeekly) {
    tasks.push({
      id: buildWeeklyTaskId(now),
      title: 'ウィークリーミッションをクリアする',
      category: 'weekly',
      deadline: new Date(getWeeklyTaskDeadlineMs(now)).toISOString(),
      completed: false,
    })
  }

  if (settings.autoEvent) {
    for (const event of events) {
      if (!isEventActiveForShop(event, now)) continue
      tasks.push({
        id: buildEventShopTaskId(event.id),
        title: `${event.name} アイテム交換を完了する`,
        category: 'event',
        deadline: new Date(event.shopFinishedAt * 1000).toISOString(),
        completed: false,
      })
    }
  }

  return tasks
}

/**
 * 直近に計算した autoTasks を、永続化済み existing タスクへ非破壊的にマージする。
 * - 既存に同じ id があればそれを維持（completed/completedAt を保持し、チェック状態を消さない）
 * - 無ければ未完了で新規追加
 * - category: 'custom' は常にそのまま維持
 * - 自動生成カテゴリ(daily/weekly/event)で、今回の autoTasks に id が存在しないもの
 *   (イベント終了やトグルOFFなど)は、未完了なら削除し、完了済みは履歴として残す
 *   (仕様上「完了済み履歴を残すか」の明記が無いため、安全側でチェック済みのみ残す)
 */
export const mergeAutoTasks = (existing: TodoTask[], autoTasks: TodoTask[]): TodoTask[] => {
  const autoIds = new Set(autoTasks.map((t) => t.id))
  const existingIds = new Set(existing.map((t) => t.id))

  const kept = existing.filter((t) => {
    if (t.category === 'custom') return true
    if (autoIds.has(t.id)) return true
    return t.completed
  })

  const appended = autoTasks.filter((t) => !existingIds.has(t.id))

  return [...kept, ...appended]
}
