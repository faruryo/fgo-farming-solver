import { useEffect } from 'react'
import { useLocalStorage } from './use-local-storage'
import { useDashboardMeta } from './use-dashboard-meta'
import { generateAutoTasks, mergeAutoTasks } from '../lib/todo/auto-generate'
import { DEFAULT_TODO_SETTINGS } from '../lib/todo/settings'
import type { TodoTask, TodoSettings } from '../types/todo'

const TODO_STATE_KEY = 'todoState'

const readStoredTasks = (): TodoTask[] => {
  try {
    return JSON.parse(localStorage.getItem(TODO_STATE_KEY) ?? '[]') as TodoTask[]
  } catch (e) {
    console.error('Failed to read stored todoState', e)
    return []
  }
}

/**
 * todoState/todoSettings を localStorage から読み込み、開催中イベントと設定から
 * 自動生成タスクを計算してマージ・永続化する共通フック。
 * TodoWidget（ダッシュボード）と TODO 管理ページの両方から使われ、
 * 生成・マージ・書き込みロジックの重複/差異を防ぐ。
 */
export const useTodoTasks = () => {
  const [todoState, setTodoState] = useLocalStorage<TodoTask[]>(TODO_STATE_KEY, [])
  const [settings, setSettings] = useLocalStorage<TodoSettings>('todoSettings', DEFAULT_TODO_SETTINGS)
  const { data } = useDashboardMeta()

  useEffect(() => {
    // イベント一覧が未取得(フェッチ中/失敗)の間は merge しない。events: [] で
    // 自動生成すると mergeAutoTasks が保存済みの event-* を「開催終了」とみなして
    // 削除し、取得後に復活させるため todoState が往復する。往復のたびに ls-sync が
    // 飛んで同期メタデータが dirty になり、新規端末の初回クラウド復元が競合に負ける。
    if (data == null) return

    // マージ元は React state ではなく localStorage の現在値。マウント直後は
    // useLocalStorage の hydration(非同期な effect)がまだ state に反映されておらず、
    // レンダー時点のスナップショットを基準にすると「まだ空の初期値」で計算した結果が
    // hydration 結果を上書きしてしまう(＝直前まで完了していたタスクが未完了に戻る)。
    const stored = readStoredTasks()
    const autoTasks = generateAutoTasks({ now: Date.now(), settings, events: data.events })
    const merged = mergeAutoTasks(stored, autoTasks)
    if (JSON.stringify(merged) === JSON.stringify(stored)) return

    // 自動生成タスクはマスターデータと時刻から導出される派生値で、ユーザーの未同期
    // 編集ではない。derived を付けて通知することで、useLocalStorage の各インスタンス
    // は再読み込みする一方、クラウド同期の変更追跡はこの書き込みを dirty 扱いしない。
    // (新規端末では初期値 [] の直後にこの書き込みが来るため、dirty にすると初回の
    // クラウド復元がコンフリクト扱いになって走らない)
    localStorage.setItem(TODO_STATE_KEY, JSON.stringify(merged))
    window.dispatchEvent(
      new CustomEvent('ls-sync', { detail: { key: TODO_STATE_KEY, derived: true } })
    )
  }, [data, settings])

  return { todoState, setTodoState, settings, setSettings }
}
