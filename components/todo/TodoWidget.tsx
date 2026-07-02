'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'
import { useTodoTasks } from '../../hooks/use-todo-tasks'
import { formatCountdown } from '../../lib/todo/format'
import type { TodoTask } from '../../types/todo'

const THRESHOLD_MS: Record<TodoTask['category'], number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 48 * 60 * 60 * 1000,
  event: 48 * 60 * 60 * 1000,
  custom: 48 * 60 * 60 * 1000,
}

const REFRESH_INTERVAL_MS = 60_000

/**
 * ダッシュボード上部の「期限間近のタスク」ウィジェット。
 * 表示対象タスクが1件も無ければ何も描画しない（specs/dashboard/spec.md）。
 */
export const TodoWidget: React.FC = () => {
  const { t } = useTranslation('dashboard')
  const { todoState, setTodoState } = useTodoTasks()
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [])

  const urgentTasks = useMemo(() => {
    return todoState
      .filter((task) => !task.completed)
      .filter((task) => new Date(task.deadline).getTime() - now < THRESHOLD_MS[task.category])
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
  }, [todoState, now])

  if (urgentTasks.length === 0) return null

  const handleComplete = (id: string) => {
    setTodoState((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: true, completedAt: new Date().toISOString() } : task
      )
    )
  }

  return (
    <div className="u-fgo-card p-4 rounded-xl">
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('期限間近のタスク')}</h2>
        <div className="u-section-header-line" />
      </div>
      <ul className="flex flex-col gap-2">
        {urgentTasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
            style={{ background: 'var(--bg2)' }}
          >
            <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
              <Checkbox checked={task.completed} onCheckedChange={() => handleComplete(task.id)} />
              <span className="text-sm truncate" style={{ color: 'var(--text)' }}>
                {task.title}
              </span>
            </label>
            <span className="text-xs shrink-0" style={{ color: 'var(--gold)' }}>
              {formatCountdown(new Date(task.deadline).getTime(), now)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
