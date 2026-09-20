import { useCallback, useMemo, useRef, useState } from 'react'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import {
  CLASS_SCORE_CLASS_KEYS,
  ClassBoardDetailState,
  ClassScoreClassKey,
  ClassScoreState,
  ClassScoreStatus,
  DEFAULT_CLASS_SCORE_STATE,
} from '../lib/class-score/types'
import { useLocalStorage } from './use-local-storage'
import { getClassBoardData } from '../lib/class-score/board-loader'
import { findShortestPathFromStarts } from '../lib/class-score/find-shortest-path'

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

const updateSquareInState = (
  current: ClassBoardDetailState | undefined,
  squareId: number,
  status: 'none' | 'target' | 'unlocked',
): ClassBoardDetailState => {
  const unlocked = new Set(current?.unlockedSquareIds ?? [])
  const targets = new Set(current?.targetSquareIds ?? [])

  unlocked.delete(squareId)
  targets.delete(squareId)

  if (status === 'unlocked') {
    unlocked.add(squareId)
  } else if (status === 'target') {
    targets.add(squareId)
  }

  return {
    unlockedSquareIds: Array.from(unlocked),
    targetSquareIds: Array.from(targets),
  }
}

const getBoardDetail = (
  boards: Partial<Record<ClassScoreClassKey, ClassBoardDetailState>> | undefined,
  key: ClassScoreClassKey,
): ClassBoardDetailState | undefined => {
  if (!boards) return undefined
  return Reflect.get(boards, key)
}

const withUpdatedBoard = (
  prev: ClassScoreState | null,
  key: ClassScoreClassKey,
  board: ClassBoardDetailState,
): ClassScoreState => {
  const curBoards = prev?.boards ?? {}
  const nextBoards = { ...curBoards }
  Reflect.set(nextBoards, key, board)
  return {
    classes: { ...(prev?.classes ?? DEFAULT_CLASS_SCORE_STATE.classes) },
    boards: nextBoards,
  }
}

const withRemovedBoard = (
  prev: ClassScoreState | null,
  key: ClassScoreClassKey,
): ClassScoreState => {
  const curBoards = prev?.boards ?? {}
  if (!Reflect.has(curBoards, key)) {
    return prev ?? DEFAULT_CLASS_SCORE_STATE
  }
  const nextBoards = { ...curBoards }
  Reflect.deleteProperty(nextBoards, key)
  return {
    classes: { ...(prev?.classes ?? DEFAULT_CLASS_SCORE_STATE.classes) },
    boards: nextBoards,
  }
}

const computeRouteTargets = (
  curBoard: ClassBoardDetailState | undefined,
  path: number[],
): ClassBoardDetailState => {
  const unlocked = new Set(curBoard?.unlockedSquareIds ?? [])
  const targets = new Set(curBoard?.targetSquareIds ?? [])
  for (const sqId of path) {
    if (!unlocked.has(sqId)) {
      targets.add(sqId)
    }
  }
  return {
    unlockedSquareIds: Array.from(unlocked),
    targetSquareIds: Array.from(targets),
  }
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

  const clearUndo = useCallback(() => setUndoState(null), [])
  return { setUndoState, undo, clearUndo, canUndo: undoState !== null }
}

const useClassScoreBoardActions = (
  setState: React.Dispatch<React.SetStateAction<ClassScoreState>>,
) => {
  const setSquareStatus = useCallback(
    (key: ClassScoreClassKey, squareId: number, status: 'none' | 'target' | 'unlocked') => {
      setState((prev) => {
        const curBoard = getBoardDetail(prev?.boards, key)
        const nextBoard = updateSquareInState(curBoard, squareId, status)
        return withUpdatedBoard(prev, key, nextBoard)
      })
    },
    [setState],
  )

  const setSquareRouteTarget = useCallback(
    (key: ClassScoreClassKey, targetSquareId: number) => {
      const boardData = getClassBoardData(key)
      if (!boardData) return
      const path = findShortestPathFromStarts(
        boardData.lines,
        boardData.startSquareIds,
        targetSquareId,
      )
      if (path.length === 0) return
      setState((prev) => {
        const curBoard = getBoardDetail(prev?.boards, key)
        const nextBoard = computeRouteTargets(curBoard, path)
        return withUpdatedBoard(prev, key, nextBoard)
      })
    },
    [setState],
  )

  const resetBoardDetail = useCallback(
    (key: ClassScoreClassKey) => {
      setState((prev) => withRemovedBoard(prev, key))
    },
    [setState],
  )

  return { setSquareStatus, setSquareRouteTarget, resetBoardDetail }
}

export const useClassScore = () => {
  const [state, setState] = useLocalStorage<ClassScoreState>(
    STORAGE_KEYS.CLASS_SCORE,
    DEFAULT_CLASS_SCORE_STATE,
  )
  const { setUndoState, undo, clearUndo, canUndo } = useClassScoreUndo(setState)
  const { setSquareStatus, setSquareRouteTarget, resetBoardDetail } =
    useClassScoreBoardActions(setState)

  const setClassStatus = useCallback(
    (key: ClassScoreClassKey, status: ClassScoreStatus) => {
      setState((prev) => {
        const nextClasses = { ...(prev?.classes ?? DEFAULT_CLASS_SCORE_STATE.classes) }
        Reflect.set(nextClasses, key, status)
        return { ...prev, classes: nextClasses }
      })
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

  const resetAll = useCallback(() => setAllStatus('none'), [setAllStatus])
  const targetCount = useMemo(() => countStatus(state?.classes, 'target'), [state])
  const completedCount = useMemo(() => countStatus(state?.classes, 'completed'), [state])

  return {
    state: state ?? DEFAULT_CLASS_SCORE_STATE,
    setState,
    setClassStatus,
    setSquareStatus,
    setSquareRouteTarget,
    resetBoardDetail,
    setAllStatus,
    resetAll,
    undo,
    clearUndo,
    canUndo,
    targetCount,
    completedCount,
  }
}
