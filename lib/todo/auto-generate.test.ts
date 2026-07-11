import { describe, it, expect } from 'vitest'
import { generateAutoTasks, mergeAutoTasks } from './auto-generate'
import { buildDailyTaskId, buildWeeklyTaskId, buildEventShopTaskId } from './period'
import type { TodoTask, TodoSettings } from '../../types/todo'
import type { DashboardEvent } from '../master-data/types'

const jst = (iso: string): number => new Date(`${iso}+09:00`).getTime()
const NOW = jst('2026-06-23T10:00:00') // Tuesday, well within a daily/weekly period

const settings = (overrides: Partial<TodoSettings> = {}): TodoSettings => ({
  autoDaily: false,
  autoWeekly: false,
  autoEvent: false,
  ...overrides,
})

const event = (overrides: Partial<DashboardEvent> = {}): DashboardEvent => ({
  id: 90123,
  name: 'テストイベント',
  banner: null,
  startedAt: Math.floor(jst('2026-06-01T00:00:00') / 1000),
  endedAt: Math.floor(jst('2026-06-15T23:59:00') / 1000),
  shopFinishedAt: Math.floor(jst('2026-06-30T23:59:00') / 1000),
  type: 'eventQuest',
  drops: [{ id: 1, name: 'ダミー交換アイテム', icon: '' }],
  ...overrides,
})

describe('generateAutoTasks', () => {
  it('generates nothing when all toggles are off', () => {
    expect(generateAutoTasks({ now: NOW, settings: settings(), events: [] })).toEqual([])
  })

  it('generates only the daily task when autoDaily is on', () => {
    const tasks = generateAutoTasks({ now: NOW, settings: settings({ autoDaily: true }), events: [] })
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ id: buildDailyTaskId(NOW), category: 'daily', completed: false })
  })

  it('generates only the weekly task when autoWeekly is on', () => {
    const tasks = generateAutoTasks({ now: NOW, settings: settings({ autoWeekly: true }), events: [] })
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ id: buildWeeklyTaskId(NOW), category: 'weekly', completed: false })
  })

  it('generates a task per active event when autoEvent is on', () => {
    const active = event({ id: 1 })
    const tasks = generateAutoTasks({ now: NOW, settings: settings({ autoEvent: true }), events: [active] })
    expect(tasks).toHaveLength(1)
    expect(tasks[0]).toMatchObject({ id: buildEventShopTaskId(1), category: 'event', completed: false })
  })

  it('excludes events that are not active for the shop, even when autoEvent is on', () => {
    const notStarted = event({ id: 1, startedAt: Math.floor(jst('2026-07-01T00:00:00') / 1000) })
    const shopFinished = event({ id: 2, shopFinishedAt: Math.floor(jst('2026-06-01T00:00:00') / 1000) })
    const tasks = generateAutoTasks({
      now: NOW,
      settings: settings({ autoEvent: true }),
      events: [notStarted, shopFinished],
    })
    expect(tasks).toEqual([])
  })

  it('excludes events with no shop items (e.g. AP-discount/bond-up campaigns), even when active and autoEvent is on', () => {
    const campaign = event({ id: 1, type: 'questCampaign', drops: [] })
    const tasks = generateAutoTasks({ now: NOW, settings: settings({ autoEvent: true }), events: [campaign] })
    expect(tasks).toEqual([])
  })

  it('does not generate event tasks when autoEvent is off, even if an event is active', () => {
    const tasks = generateAutoTasks({ now: NOW, settings: settings(), events: [event()] })
    expect(tasks).toEqual([])
  })

  it('combines daily, weekly, and multiple active event tasks when all toggles are on', () => {
    const tasks = generateAutoTasks({
      now: NOW,
      settings: settings({ autoDaily: true, autoWeekly: true, autoEvent: true }),
      events: [event({ id: 1 }), event({ id: 2 })],
    })
    expect(tasks.map((t) => t.id).sort()).toEqual(
      [buildDailyTaskId(NOW), buildWeeklyTaskId(NOW), buildEventShopTaskId(1), buildEventShopTaskId(2)].sort()
    )
  })
})

describe('mergeAutoTasks', () => {
  const daily = (overrides: Partial<TodoTask> = {}): TodoTask => ({
    id: buildDailyTaskId(NOW),
    title: 'デイリーミッションをクリアする',
    category: 'daily',
    deadline: new Date(NOW).toISOString(),
    completed: false,
    ...overrides,
  })

  it('appends a newly computed auto task that does not exist yet', () => {
    const result = mergeAutoTasks([], [daily()])
    expect(result).toEqual([daily()])
  })

  it('preserves completed state of an existing auto task with the same id', () => {
    const existing = daily({ completed: true, completedAt: '2026-06-23T01:00:00.000Z' })
    // autoTasks always recomputes as uncompleted; merge must keep the persisted completed state.
    const result = mergeAutoTasks([existing], [daily({ completed: false })])
    expect(result).toEqual([existing])
  })

  it('drops a stale, uncompleted auto task whose id is no longer in autoTasks (toggle off / event ended)', () => {
    const stale = daily({ id: 'daily-20260622', completed: false })
    const result = mergeAutoTasks([stale], [daily()])
    expect(result).toEqual([daily()])
  })

  it('keeps a stale but completed auto task as history', () => {
    const staleCompleted = daily({ id: 'daily-20260622', completed: true, completedAt: '2026-06-22T01:00:00.000Z' })
    const result = mergeAutoTasks([staleCompleted], [daily()])
    expect(result).toEqual(expect.arrayContaining([staleCompleted, daily()]))
    expect(result).toHaveLength(2)
  })

  it('always keeps custom tasks regardless of autoTasks contents', () => {
    const custom: TodoTask = {
      id: 'custom-abc123',
      title: '素材を集める',
      category: 'custom',
      deadline: new Date(NOW).toISOString(),
      completed: false,
    }
    const result = mergeAutoTasks([custom], [])
    expect(result).toEqual([custom])
  })

  it('does not duplicate an auto task that already exists with a matching id', () => {
    const existing = daily({ completed: false })
    const result = mergeAutoTasks([existing], [daily()])
    expect(result).toHaveLength(1)
  })
})
