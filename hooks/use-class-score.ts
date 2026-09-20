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
import {
  computeBoardAllTarget,
  computeBoardAllUnlocked,
  computePrunedOnNone,
  computeRouteTargets,
  computeRouteUnlocked,
  getBlankSquareIds,
  getPlayableSquareIds,
} from '../lib/class-score/route-actions'
import type {
  ClassBoardData,
  ClassBoardSquareStatus,
} from '../lib/class-score/board-types'

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
  status: ClassBoardSquareStatus,
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

const updateSquareStatusInBoard = (
  curBoard: ClassBoardDetailState | undefined,
  squareId: number,
  status: ClassBoardSquareStatus,
  boardData: ClassBoardData | undefined,
): ClassBoardDetailState => {
  if (status === 'none') {
    if (!boardData) {
      return updateSquareInState(curBoard, squareId, 'none')
    }
    return computePrunedOnNone(
      curBoard,
      squareId,
      boardData.lines,
      boardData.startSquareIds,
      getBlankSquareIds(boardData),
    )
  }
  return updateSquareInState(curBoard, squareId, status)
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

const buildClassStatusUpdate = (
  prev: ClassScoreState | null,
  key: ClassScoreClassKey,
  status: ClassScoreStatus,
): ClassScoreState => {
  const nextClasses = { ...(prev?.classes ?? DEFAULT_CLASS_SCORE_STATE.classes) }
  Reflect.set(nextClasses, key, status)
  const boardData = getClassBoardData(key)
  const playables = getPlayableSquareIds(boardData)
  const curBoards = prev?.boards ?? {}
  const nextBoards = { ...curBoards }

  if (status === 'target') {
    const curDetail = Reflect.get(curBoards, key)
    Reflect.set(nextBoards, key, computeBoardAllTarget(curDetail, playables))
  } else if (status === 'completed') {
    Reflect.set(nextBoards, key, computeBoardAllUnlocked(playables))
  } else {
    Reflect.deleteProperty(nextBoards, key)
  }

  return { classes: nextClasses, boards: nextBoards }
}

const buildAllStatusUpdate = (
  status: ClassScoreStatus,
  prevBoards: Partial<Record<ClassScoreClassKey, ClassBoardDetailState>> | undefined,
): ClassScoreState => {
  const nextClasses = buildAllStatusClasses(status)
  if (status === 'none') {
    return { classes: nextClasses, boards: {} }
  }

  const nextBoards: Partial<Record<ClassScoreClassKey, ClassBoardDetailState>> = {}
  for (const key of CLASS_SCORE_CLASS_KEYS) {
    const boardData = getClassBoardData(key)
    const playables = getPlayableSquareIds(boardData)
    if (status === 'target') {
      const curDetail = prevBoards ? Reflect.get(prevBoards, key) : undefined
      Reflect.set(nextBoards, key, computeBoardAllTarget(curDetail, playables))
    } else {
      Reflect.set(nextBoards, key, computeBoardAllUnlocked(playables))
    }
  }

  return { classes: nextClasses, boards: nextBoards }
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

const updateRouteInState = (
  prev: ClassScoreState | null,
  key: ClassScoreClassKey,
  targetSquareId: number,
  computeFn: (cur: ClassBoardDetailState | undefined, path: number[]) => ClassBoardDetailState,
): ClassScoreState => {
  const boardData = getClassBoardData(key)
  if (!boardData) return prev ?? DEFAULT_CLASS_SCORE_STATE
  const path = findShortestPathFromStarts(
    boardData.lines,
    boardData.startSquareIds,
    targetSquareId,
  )
  if (path.length === 0) return prev ?? DEFAULT_CLASS_SCORE_STATE
  const curBoard = getBoardDetail(prev?.boards, key)
  const nextBoard = computeFn(curBoard, path)
  return withUpdatedBoard(prev, key, nextBoard)
}

const useClassScoreBoardActions = (
  setState: React.Dispatch<React.SetStateAction<ClassScoreState>>,
) => {
  const setSquareStatus = useCallback(
    (key: ClassScoreClassKey, squareId: number, status: ClassBoardSquareStatus) => {
      const boardData = getClassBoardData(key)
      setState((prev) => {
        const curBoard = getBoardDetail(prev?.boards, key)
        const nextBoard = updateSquareStatusInBoard(curBoard, squareId, status, boardData)
        return withUpdatedBoard(prev, key, nextBoard)
      })
    },
    [setState],
  )

  const setSquareRouteTarget = useCallback(
    (key: ClassScoreClassKey, targetSquareId: number) => {
      setState((prev) => updateRouteInState(prev, key, targetSquareId, computeRouteTargets))
    },
    [setState],
  )

  const setSquareRouteUnlocked = useCallback(
    (key: ClassScoreClassKey, targetSquareId: number) => {
      setState((prev) => updateRouteInState(prev, key, targetSquareId, computeRouteUnlocked))
    },
    [setState],
  )

  const resetBoardDetail = useCallback(
    (key: ClassScoreClassKey) => {
      setState((prev) => withRemovedBoard(prev, key))
    },
    [setState],
  )

  return {
    setSquareStatus,
    setSquareRouteTarget,
    setSquareRouteUnlocked,
    resetBoardDetail,
  }
}

export const useClassScore = () => {
  const [state, setState] = useLocalStorage<ClassScoreState>(
    STORAGE_KEYS.CLASS_SCORE,
    DEFAULT_CLASS_SCORE_STATE,
  )
  const { setUndoState, undo, clearUndo, canUndo } = useClassScoreUndo(setState)
  const {
    setSquareStatus,
    setSquareRouteTarget,
    setSquareRouteUnlocked,
    resetBoardDetail,
  } = useClassScoreBoardActions(setState)

  const setClassStatus = useCallback(
    (key: ClassScoreClassKey, status: ClassScoreStatus) => {
      setState((prev) => buildClassStatusUpdate(prev, key, status))
    },
    [setState],
  )

  const setAllStatus = useCallback(
    (status: ClassScoreStatus) => {
      setState((prev) => {
        setUndoState(prev)
        return buildAllStatusUpdate(status, prev?.boards)
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
    setSquareRouteUnlocked,
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
