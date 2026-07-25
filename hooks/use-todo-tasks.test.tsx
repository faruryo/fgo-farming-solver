// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTodoTasks } from './use-todo-tasks'
import type { TodoTask } from '../types/todo'

const EVENT_TASK: TodoTask = {
  id: 'event-shop-80612',
  title: 'テストイベント アイテム交換を完了する',
  category: 'event',
  deadline: '2026-07-29T03:59:59.000Z',
  completed: false,
}

const dashboardMeta = {
  events: [
    {
      id: 80612,
      name: 'テストイベント',
      startedAt: 1750000000,
      endedAt: 1790000000,
      shopFinishedAt: 1790000000,
      drops: [{ itemId: 6512, quantity: 1 }],
    },
  ],
}

const storedTasks = () =>
  JSON.parse(localStorage.getItem('todoState') ?? '[]') as TodoTask[]

describe('useTodoTasks', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.useRealTimers()
  })

  // dashboard-meta の取得が終わる前に merge すると events: [] で自動生成され、
  // 保存済みのイベントタスクが消えて再度復活する。書き込みのたびに ls-sync が
  // 飛び、クラウド同期のメタデータが未同期扱い(dirty)になって初回復元を潰す。
  it('keeps stored event tasks and stays silent while dashboard meta is pending', async () => {
    localStorage.setItem('todoState', JSON.stringify([EVENT_TASK]))
    let resolveFetch: (() => void) | undefined
    const pending = new Promise<void>((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await pending
        return { ok: true, json: async () => dashboardMeta } as Response
      })
    )

    const syncEvents: string[] = []
    const listener = (e: Event) => {
      const key = e instanceof CustomEvent ? (e.detail as { key?: string })?.key : undefined
      if (key) syncEvents.push(key)
    }
    window.addEventListener('ls-sync', listener)

    try {
      const { result } = renderHook(() => useTodoTasks())

      await waitFor(() => {
        expect(result.current.todoState).toHaveLength(1)
      })

      expect(storedTasks().map((t) => t.id)).toEqual([EVENT_TASK.id])
      expect(syncEvents).toEqual([])

      resolveFetch?.()
      await waitFor(() => {
        expect(storedTasks().length).toBeGreaterThan(1)
      })

      // 取得後は daily/weekly が増えるだけで、イベントタスクは消えない
      expect(storedTasks().map((t) => t.id)).toContain(EVENT_TASK.id)
    } finally {
      window.removeEventListener('ls-sync', listener)
    }
  })
})
