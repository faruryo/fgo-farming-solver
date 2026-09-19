import { useCallback, useMemo, useRef, useState } from 'react'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import {
  CLASS_SCORE_CLASS_KEYS,
  ClassScoreClassKey,
  ClassScoreState,
  ClassScoreStatus,
  DEFAULT_CLASS_SCORE_STATE,
} from '../lib/class-score/types'
import { useLocalStorage } from './use-local-storage'

const buildAllStatusClasses = (
  status: ClassScoreStatus,
): Record<ClassScoreClassKey, ClassScoreStatus> =>
  Object.fromEntries(
    CLASS_SCORE_CLASS_KEYS.map((k) => [k, status]),
  ) as Record<ClassScoreClassKey, ClassScoreStatus>

const countStatus = (
  classes: Partial<Record<ClassScoreClassKey, ClassScoreStatus>> | undefined,
  status: ClassScoreStatus,
): number => {
  if (!classes) return 0
  return CLASS_SCORE_CLASS_KEYS.filter(
    (k) => Reflect.get(classes, k) === status,
  ).length
}

const useClassScoreUndo = (
  setState: React.Dispatch<React.SetStateAction<ClassScoreState>>,
) => {
  const [undoState, setUndoState] = useState<ClassScoreState | null>(null)
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const undo = useCallback(() => {
    if (!undoState) return
    setState(undoState)
    setUndoState(null)
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
      undoTimeoutRef.current = null
    }
  }, [undoState, setState])

  const clearUndo = useCallback(() => {
    setUndoState(null)
  }, [])

  return { setUndoState, undo, clearUndo, canUndo: undoState !== null }
}

export const useClassScore = () => {
  const [state, setState] = useLocalStorage<ClassScoreState>(
    STORAGE_KEYS.CLASS_SCORE,
    DEFAULT_CLASS_SCORE_STATE,
  )

  const { setUndoState, undo, clearUndo, canUndo } = useClassScoreUndo(setState)

  const setClassStatus = useCallback(
    (key: ClassScoreClassKey, status: ClassScoreStatus) => {
      setState((prev) => ({
        ...prev,
        classes: {
          ...(prev?.classes ?? DEFAULT_CLASS_SCORE_STATE.classes),
          [key]: status,
        },
      }))
    },
    [setState],
  )

  const setAllStatus = useCallback(
    (status: ClassScoreStatus) => {
      setState((prev) => {
        setUndoState(prev)
        return { classes: buildAllStatusClasses(status) }
      })
    },
    [setState, setUndoState],
  )

  const resetAll = useCallback(() => {
    setAllStatus('none')
  }, [setAllStatus])

  const targetCount = useMemo(
    () => countStatus(state?.classes, 'target'),
    [state],
  )
  const completedCount = useMemo(
    () => countStatus(state?.classes, 'completed'),
    [state],
  )

  return {
    state: state ?? DEFAULT_CLASS_SCORE_STATE,
    setState,
    setClassStatus,
    setAllStatus,
    resetAll,
    undo,
    clearUndo,
    canUndo,
    targetCount,
    completedCount,
  }
}
