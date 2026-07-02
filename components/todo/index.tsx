'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTodoTasks } from '../../hooks/use-todo-tasks'
import { formatCountdown } from '../../lib/todo/format'
import { TodoSettingsPanel } from './TodoSettingsPanel'
import type { TodoTask } from '../../types/todo'

const CATEGORY_LABEL: Record<TodoTask['category'], string> = {
  daily: 'デイリー',
  weekly: 'ウィークリー',
  event: 'イベント交換',
  custom: 'カスタム',
}

type FormState = { mode: 'add' } | { mode: 'edit'; task: TodoTask }

const toDatetimeLocalValue = (iso: string): string => {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/**
 * TODO 管理ページ本体。全カテゴリ・完了/未完了を一覧表示し、
 * カスタムタスクの追加・編集・削除、自動生成/通知設定パネルをまとめて提供する。
 */
export const TodoPage: React.FC = () => {
  const { t } = useTranslation('todo')
  const { todoState, setTodoState } = useTodoTasks()
  const [now, setNow] = useState(() => Date.now())
  const [formState, setFormState] = useState<FormState | null>(null)
  const [formTitle, setFormTitle] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TodoTask | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const { incomplete, completed } = useMemo(() => {
    const sorted = [...todoState].sort(
      (a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
    )
    return {
      incomplete: sorted.filter((task) => !task.completed),
      completed: sorted
        .filter((task) => task.completed)
        .sort(
          (a, b) =>
            new Date(b.completedAt ?? b.deadline).getTime() - new Date(a.completedAt ?? a.deadline).getTime()
        ),
    }
  }, [todoState])

  const toggleComplete = (task: TodoTask) => {
    setTodoState((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completed: !t.completed, completedAt: !t.completed ? new Date().toISOString() : undefined }
          : t
      )
    )
  }

  const openAdd = () => {
    setFormTitle('')
    setFormDeadline('')
    setFormState({ mode: 'add' })
  }

  const openEdit = (task: TodoTask) => {
    setFormTitle(task.title)
    setFormDeadline(toDatetimeLocalValue(task.deadline))
    setFormState({ mode: 'edit', task })
  }

  const closeForm = () => setFormState(null)

  const submitForm = () => {
    if (!formTitle.trim() || !formDeadline) return
    const deadlineIso = new Date(formDeadline).toISOString()
    if (formState?.mode === 'edit') {
      const targetId = formState.task.id
      setTodoState((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, title: formTitle.trim(), deadline: deadlineIso } : t))
      )
    } else {
      setTodoState((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: formTitle.trim(),
          category: 'custom',
          deadline: deadlineIso,
          completed: false,
        },
      ])
    }
    closeForm()
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    setTodoState((prev) => prev.filter((t) => t.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const renderTaskRow = (task: TodoTask) => (
    <div
      key={task.id}
      className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
        <Checkbox checked={task.completed} onCheckedChange={() => toggleComplete(task)} />
        <div className="flex flex-col min-w-0">
          <span
            className="text-sm truncate"
            style={{
              color: task.completed ? 'var(--text3)' : 'var(--text)',
              textDecoration: task.completed ? 'line-through' : 'none',
            }}
          >
            {task.title}
          </span>
          <span className="text-xs" style={{ color: 'var(--text3)' }}>
            {new Date(task.deadline).toLocaleString()}
            {!task.completed && ` (${formatCountdown(new Date(task.deadline).getTime(), now)})`}
          </span>
        </div>
      </label>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className="text-[10px]">
          {t(CATEGORY_LABEL[task.category])}
        </Badge>
        {task.category === 'custom' && (
          <>
            <Button size="icon-sm" variant="ghost" onClick={() => openEdit(task)} aria-label={t('編集')}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(task)} aria-label={t('削除')}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-8">
      <div className="flex justify-between items-center">
        <h2 className="u-section-header-title" style={{ fontSize: '15px' }}>
          {t('未完了のタスク')}
        </h2>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" /> {t('カスタムタスクを追加')}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        {incomplete.length === 0 ? (
          <div className="text-sm text-center py-8" style={{ color: 'var(--text3)' }}>
            {t('タスクがありません')}
          </div>
        ) : (
          incomplete.map(renderTaskRow)
        )}
      </div>

      {completed.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="u-section-header-title" style={{ fontSize: '15px' }}>
            {t('完了済み')}
          </h2>
          {completed.map(renderTaskRow)}
        </div>
      )}

      <TodoSettingsPanel />

      <Dialog
        open={formState !== null}
        onOpenChange={(open) => {
          if (!open) closeForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{formState?.mode === 'edit' ? t('タスクを編集') : t('カスタムタスクを追加')}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs" style={{ color: 'var(--text2)' }}>
                {t('タイトル')}
              </label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder={t('タスク名を入力')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs" style={{ color: 'var(--text2)' }}>
                {t('期限')}
              </label>
              <Input type="datetime-local" value={formDeadline} onChange={(e) => setFormDeadline(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>
              {t('common:キャンセル')}
            </Button>
            <Button onClick={submitForm} disabled={!formTitle.trim() || !formDeadline}>
              {t('保存')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('このタスクを削除しますか？')}</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.title}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:キャンセル')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              {t('削除')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
