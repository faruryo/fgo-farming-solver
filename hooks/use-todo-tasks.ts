import { useEffect } from 'react'
import { useLocalStorage } from './use-local-storage'
import { useDashboardMeta } from './use-dashboard-meta'
import { generateAutoTasks, mergeAutoTasks } from '../lib/todo/auto-generate'
import { DEFAULT_TODO_SETTINGS } from '../lib/todo/settings'
import type { TodoTask, TodoSettings } from '../types/todo'

/**
 * todoState/todoSettings を localStorage から読み込み、開催中イベントと設定から
 * 自動生成タスクを計算してマージ・永続化する共通フック。
 * TodoWidget（ダッシュボード）と TODO 管理ページの両方から使われ、
 * 生成・マージ・書き込みロジックの重複/差異を防ぐ。
 */
export const useTodoTasks = () => {
  const [todoState, setTodoState] = useLocalStorage<TodoTask[]>('todoState', [])
  const [settings, setSettings] = useLocalStorage<TodoSettings>('todoSettings', DEFAULT_TODO_SETTINGS)
  const { data } = useDashboardMeta()

  useEffect(() => {
    // マウント直後は useLocalStorage 側の localStorage 読み込み(非同期な hydration
    // effect)がまだ state に反映されていない可能性がある。ここで直接 todoState
    // (レンダー時点のスナップショット)を使って merge・setTodoState してしまうと、
    // 同一コミット内で hydration の setState と競合し、後着のこちらが「まだ空の
    // 初期値」を基準に計算した結果で hydration 結果を上書きしてしまう
    // (＝直前まで完了していたタスクが未完了に戻り、それがそのまま永続化される)。
    // 関数更新形で「適用時点の最新 state」を基準に merge することで、
    // hydration の setState が先に適用されていればそれを正しく引き継げる。
    setTodoState((prev) => {
      const autoTasks = generateAutoTasks({ now: Date.now(), settings, events: data?.events ?? [] })
      const merged = mergeAutoTasks(prev, autoTasks)
      return JSON.stringify(merged) === JSON.stringify(prev) ? prev : merged
    })
  }, [data, settings, setTodoState])

  return { todoState, setTodoState, settings, setSettings }
}
