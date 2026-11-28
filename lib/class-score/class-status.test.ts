import { describe, expect, it } from 'vitest'
import { getClassBoardData } from './board-loader'
import { countBoardSquares, countClassSquares, resolveClassStatus, resolveClassStatuses } from './class-status'
import { getPlayableSquareIds } from './route-actions'
import { DEFAULT_CLASS_SCORE_STATE, type ClassScoreState } from './types'

const saberPlayables = getPlayableSquareIds(getClassBoardData('saber'))

const withSaberBoard = (
  board: { unlockedSquareIds: number[]; targetSquareIds: number[] },
  savedStatus: 'none' | 'target' | 'completed' = 'none',
): ClassScoreState => ({
  classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: savedStatus },
  boards: { saber: board },
})

describe('resolveClassStatus', () => {
  it('部分目標の盤面に none が保存されていても target として読む', () => {
    const state = withSaberBoard({ unlockedSquareIds: [], targetSquareIds: saberPlayables.slice(0, 3) })
    expect(resolveClassStatus(state, 'saber')).toBe('target')
  })

  it('盤面に目標マスが無ければ、target が保存されていても none として読む', () => {
    const state = withSaberBoard({ unlockedSquareIds: [], targetSquareIds: [] }, 'target')
    expect(resolveClassStatus(state, 'saber')).toBe('none')
  })

  it('目標マスがすべて解放済で全マス解放済でなければ none として読む', () => {
    const ids = saberPlayables.slice(0, 2)
    const state = withSaberBoard({ unlockedSquareIds: ids, targetSquareIds: ids }, 'target')
    expect(resolveClassStatus(state, 'saber')).toBe('none')
  })

  it('全マス解放済の盤面は completed として読む', () => {
    const state = withSaberBoard({ unlockedSquareIds: saberPlayables, targetSquareIds: [] })
    expect(resolveClassStatus(state, 'saber')).toBe('completed')
  })

  it('盤面が無いクラスは保存されたステータスを使い、壊れた値は none にする', () => {
    const state = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, archer: 'target', lancer: 'broken' },
    } as unknown as ClassScoreState
    const statuses = resolveClassStatuses(state)
    expect(statuses.archer).toBe('target')
    expect(statuses.lancer).toBe('none')
    expect(statuses.saber).toBe('none')
  })
})

describe('countBoardSquares / countClassSquares', () => {
  it('解放済・目標（未解放）・残りを実サインマスだけで数える', () => {
    const [a, b, c] = saberPlayables
    const counts = countBoardSquares(
      { unlockedSquareIds: [a], targetSquareIds: [a, b, c, -1] },
      saberPlayables,
    )
    expect(counts).toEqual({
      total: saberPlayables.length,
      unlocked: 1,
      target: 2,
      remaining: saberPlayables.length - 3,
    })
  })

  it('盤面が無く target が保存されたクラスは全マス目標として数える', () => {
    const state: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'target' },
    }
    expect(countClassSquares(state, 'saber')).toEqual({
      total: saberPlayables.length,
      unlocked: 0,
      target: saberPlayables.length,
      remaining: 0,
    })
  })
})
