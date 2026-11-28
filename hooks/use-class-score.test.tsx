// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useClassScore } from './use-class-score'
import { STORAGE_KEYS } from '../lib/constants/storage-keys'
import { getClassBoardData } from '../lib/class-score/board-loader'
import { findShortestPathFromStarts } from '../lib/class-score/find-shortest-path'
import { getBlankSquareIds, getPlayableSquareIds } from '../lib/class-score/route-actions'
import { DEFAULT_CLASS_SCORE_STATE, type ClassScoreState } from '../lib/class-score/types'

const saber = getClassBoardData('saber')
if (!saber) throw new Error('saber board missing')
const playables = getPlayableSquareIds(saber)
const blanks = getBlankSquareIds(saber)

const save = (state: ClassScoreState) =>
  localStorage.setItem(STORAGE_KEYS.CLASS_SCORE, JSON.stringify(state))

describe('useClassScore', () => {
  beforeEach(() => localStorage.clear())

  it('部分目標の盤面と none が保存された状態から始めても、目標クラス数とステータスは盤面から導出する', async () => {
    save({
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'none', archer: 'target' },
      boards: {
        saber: { unlockedSquareIds: [], targetSquareIds: playables.slice(0, 2) },
        archer: { unlockedSquareIds: [], targetSquareIds: [] },
      },
    })
    const { result } = renderHook(() => useClassScore())
    await waitFor(() => expect(result.current.targetCount).toBe(1))
    expect(result.current.state.classes.saber).toBe('target')
    expect(result.current.state.classes.archer).toBe('none')
  })

  it('経路を目標に戻す操作は経路上の解放済を目標にし、経路の外のマスは変えない', async () => {
    const goal = playables[playables.length - 1]
    const path = findShortestPathFromStarts(saber.lines, saber.startSquareIds, goal).filter(
      (id) => !blanks.has(id),
    )
    expect(path.length).toBeGreaterThan(1)
    const outside = playables.filter((id) => !path.includes(id))
    const outsideUnlocked = outside.slice(0, 2)
    const outsideTarget = outside.slice(2, 3)
    save({
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes },
      boards: {
        saber: {
          unlockedSquareIds: [...path.slice(0, 2), ...outsideUnlocked],
          targetSquareIds: outsideTarget,
        },
      },
    })
    const { result } = renderHook(() => useClassScore())
    await waitFor(() => expect(result.current.state.boards?.saber).toBeDefined())

    act(() => result.current.setSquareRouteRetarget('saber', goal))

    const board = result.current.state.boards?.saber
    expect([...(board?.unlockedSquareIds ?? [])].sort((a, b) => a - b)).toEqual(
      [...outsideUnlocked].sort((a, b) => a - b),
    )
    expect(new Set(board?.targetSquareIds)).toEqual(new Set([...path, ...outsideTarget]))
    expect(result.current.state.classes.saber).toBe('target')
  })
})
