import { describe, expect, it } from 'vitest'
import {
  sumClassScoreClassMaterials,
  sumClassScoreFarmingMaterials,
  sumClassScoreFullUnlockMaterials,
  sumClassScoreMaterials,
} from './sum'
import { getClassBoardData } from './board-loader'
import { calculateBoardDiffMaterials } from './calculate-board-diff'
import { getPlayableSquareIds } from './route-actions'
import {
  CLASS_SCORE_CLASS_KEYS,
  DEFAULT_CLASS_SCORE_STATE,
  ClassScoreState,
} from './types'

const saberBoard = getClassBoardData('saber')
if (!saberBoard) throw new Error('saber board missing')
const saberPlayables = getPlayableSquareIds(saberBoard)

describe('sumClassScoreMaterials', () => {
  it('目標が1つもない場合は空オブジェクトを返す', () => {
    const res = sumClassScoreMaterials(DEFAULT_CLASS_SCORE_STATE)
    expect(res).toEqual({})
  })

  it('completed のみの場合は目標素材としてカウントされない', () => {
    const state: ClassScoreState = {
      classes: {
        ...DEFAULT_CLASS_SCORE_STATE.classes,
        saber: 'completed',
        berserker: 'completed',
      },
    }
    const res = sumClassScoreMaterials(state)
    expect(res).toEqual({})
  })

  it('セイバーのみ target の場合、セイバーの全必要素材が正確に集計される', () => {
    const state: ClassScoreState = {
      classes: {
        ...DEFAULT_CLASS_SCORE_STATE.classes,
        saber: 'target',
      },
    }
    const res = sumClassScoreMaterials(state)

    // QP
    expect(res['1']).toBe(317_000_000)
    // ピース・モニュメント
    expect(res['7001']).toBe(140) // セイバーピース
    expect(res['7101']).toBe(500) // セイバーモニュメント
    // 特殊素材
    expect(res['50']).toBe(6680) // 星光の砂
    expect(res['51']).toBe(4) // 新星のトーチ
    expect(res['52']).toBe(4) // 明星のトーチ
    expect(res['53']).toBe(2) // 極星のトーチ
    // 通常素材（一部）
    expect(res['6503']).toBe(70) // 英雄の証
    expect(res['6506']).toBe(40) // 竜の逆鱗
    expect(res['6519']).toBe(54) // 戦馬の幼角
  })

  it('セイバーとバーサーカーの両方が target の場合、共通素材や特殊素材が正しく合算される', () => {
    const state: ClassScoreState = {
      classes: {
        ...DEFAULT_CLASS_SCORE_STATE.classes,
        saber: 'target',
        berserker: 'target',
      },
    }
    const res = sumClassScoreMaterials(state)

    // QP (3.17億 × 2)
    expect(res['1']).toBe(634_000_000)
    // 星光の砂 (6680 × 2)
    expect(res['50']).toBe(13360)
    // トーチ (各倍量)
    expect(res['51']).toBe(8)
    expect(res['52']).toBe(8)
    expect(res['53']).toBe(4)
    // 各クラスピース・モニュメント
    expect(res['7001']).toBe(140) // セイバーピース
    expect(res['7101']).toBe(500) // セイバーモニュメント
    expect(res['7007']).toBe(140) // バーサーカーピース
    expect(res['7107']).toBe(500) // バーサーカーモニュメント
  })

  it('sumClassScoreFarmingMaterials はトーチ(51, 52, 53)を除外する', () => {
    const state: ClassScoreState = {
      classes: {
        ...DEFAULT_CLASS_SCORE_STATE.classes,
        saber: 'target',
      },
    }
    const farming = sumClassScoreFarmingMaterials(state)
    expect(farming['1']).toBe(317_000_000)
    expect(farming['7001']).toBe(140)
    expect(farming['50']).toBe(6680)
    expect(farming['51']).toBeUndefined()
    expect(farming['52']).toBeUndefined()
    expect(farming['53']).toBeUndefined()
  })

  it('一部だけ目標の盤面は、目標かつ未解放のマスぶんだけを計上する', () => {
    const targets = saberPlayables.slice(0, 5)
    const unlocked = saberPlayables.slice(0, 1)
    const state: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'target' },
      boards: { saber: { unlockedSquareIds: unlocked, targetSquareIds: targets } },
    }
    const diff = calculateBoardDiffMaterials(saberBoard, targets, unlocked)
    const res = sumClassScoreMaterials(state)
    expect(res['1'] ?? 0).toBe(diff.qp)
    expect(res['1'] ?? 0).toBeLessThan(317_000_000)
    expect(res['7101']).toBeUndefined()
  })

  it('部分目標の盤面に none が保存されていても目標として計上する', () => {
    const targets = saberPlayables.slice(0, 5)
    const state: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'none' },
      boards: { saber: { unlockedSquareIds: [], targetSquareIds: targets } },
    }
    const diff = calculateBoardDiffMaterials(saberBoard, targets, [])
    expect(diff.qp).toBeGreaterThan(0)
    expect(sumClassScoreMaterials(state)['1']).toBe(diff.qp)
  })

  it('盤面に目標マスが無ければ、target が保存されていても全マスぶんを足さない', () => {
    const state: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'target' },
      boards: { saber: { unlockedSquareIds: saberPlayables.slice(0, 2), targetSquareIds: [] } },
    }
    expect(sumClassScoreMaterials(state)).toEqual({})
  })

  it('全マス目標の盤面は、全マス解放に必要な数から解放済のぶんを除いた値になる', () => {
    const unlocked = saberPlayables.slice(0, 3)
    const state: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'target' },
      boards: {
        saber: {
          unlockedSquareIds: unlocked,
          targetSquareIds: saberPlayables.filter((id) => !unlocked.includes(id)),
        },
      },
    }
    expect(sumClassScoreMaterials(state)).toEqual(sumClassScoreFullUnlockMaterials(state, 'saber'))
  })
})

describe('sumClassScoreClassMaterials', () => {
  it('target の各クラスの値を足すと全体の集計と一致する', () => {
    const state: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, archer: 'target', lancer: 'none' },
      boards: {
        saber: { unlockedSquareIds: [], targetSquareIds: saberPlayables.slice(0, 7) },
        lancer: { unlockedSquareIds: [], targetSquareIds: [] },
      },
    }
    const total = sumClassScoreMaterials(state)
    const summed = new Map<string, number>()
    for (const key of CLASS_SCORE_CLASS_KEYS) {
      for (const [id, n] of Object.entries(sumClassScoreClassMaterials(state, key))) {
        summed.set(id, (summed.get(id) ?? 0) + n)
      }
    }
    expect(Object.fromEntries(summed)).toEqual(total)
    expect(Object.keys(sumClassScoreClassMaterials(state, 'lancer'))).toHaveLength(0)
  })
})

describe('sumClassScoreFullUnlockMaterials', () => {
  it('目標も解放済も無いクラスは全マス解放に必要な全量になる', () => {
    const res = sumClassScoreFullUnlockMaterials(DEFAULT_CLASS_SCORE_STATE, 'saber')
    expect(res['1']).toBe(317_000_000)
    expect(res['7101']).toBe(500)
    expect(res['50']).toBe(6680)
  })
})
