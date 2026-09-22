import { describe, expect, it } from 'vitest'
import { calculateTotalRequiredMaterials } from './calculate-total'
import { ClassScoreState, DEFAULT_CLASS_SCORE_STATE } from './types'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import { MaterialsForServants } from '../get-materials'

describe('calculateTotalRequiredMaterials', () => {
  it('クラススコアが未設定の場合、サーヴァント素材のみを返す', () => {
    const chaldeaState: ChaldeaState = {}
    const materials: MaterialsForServants = {}
    const res = calculateTotalRequiredMaterials(
      chaldeaState,
      materials,
      DEFAULT_CLASS_SCORE_STATE,
    )
    expect(res).toEqual({})
  })

  it('クラススコアが設定されている場合、クラススコア素材が合算される', () => {
    const chaldeaState: ChaldeaState = {}
    const materials: MaterialsForServants = {}
    const csState: ClassScoreState = {
      classes: {
        ...DEFAULT_CLASS_SCORE_STATE.classes,
        saber: 'target',
      },
    }
    const res = calculateTotalRequiredMaterials(chaldeaState, materials, csState)
    expect(res['1']).toBe(317_000_000)
    expect(res['7001']).toBe(140)
    expect(res['6503']).toBe(70)
  })

  it('マス詳細設定（boards）がある場合、マス単位の差分素材が合算される', () => {
    const chaldeaState: ChaldeaState = {}
    const materials: MaterialsForServants = {}
    const csState: ClassScoreState = {
      classes: {
        ...DEFAULT_CLASS_SCORE_STATE.classes,
      },
      boards: {
        saber: {
          unlockedSquareIds: [],
          targetSquareIds: [1], // Square 1: QP 500,000, Sand 30, Hero Proof (6503) 14
        },
      },
    }
    const res = calculateTotalRequiredMaterials(chaldeaState, materials, csState)
    expect(res['1']).toBe(500_000)
    expect(res['50']).toBe(30)
    expect(res['6503']).toBe(14)
  })
})
