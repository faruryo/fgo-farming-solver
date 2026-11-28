import { describe, expect, it } from 'vitest'
import {
  computeServantResult,
  hasServantTargets,
  isEmptyAmounts,
  resolveRequiredMaterials,
  servantResultWithQuery,
} from './required-materials'
import { sumClassScoreMaterials } from './class-score/sum'
import { getClassBoardData } from './class-score/board-loader'
import { getPlayableSquareIds } from './class-score/route-actions'
import { DEFAULT_CLASS_SCORE_STATE, type ClassScoreState } from './class-score/types'
import { createChaldeaState, type ChaldeaState } from '../hooks/create-chaldea-state'
import type { MaterialsForServants } from './get-materials'

const saberTarget: ClassScoreState = {
  classes: { ...DEFAULT_CLASS_SCORE_STATE.classes, saber: 'target' },
}
const SABER_QP = 317_000_000

describe('resolveRequiredMaterials', () => {
  it('育成ぶんがあれば、育成ぶんとクラススコアぶんをアイテムIDごとに足す', () => {
    const res = resolveRequiredMaterials({
      servantResult: { '1': 1000, '6001': 5 },
      servantCurrent: true,
      legacyResult: { '1': 999_999_999 },
      classScoreState: saberTarget,
    })
    expect(res.source).toBe('servant')
    expect(res.total['1']).toBe(SABER_QP + 1000)
    expect(res.total['6001']).toBe(5)
    expect(res.total['7001']).toBe(140)
    expect(res.servant).toEqual({ '1': 1000, '6001': 5 })
    expect(res.classScore['1']).toBe(SABER_QP)
  })

  it('育成ぶんが {} なら旧値があっても使わず、クラススコアぶんだけになる', () => {
    const res = resolveRequiredMaterials({
      servantResult: {},
      servantCurrent: true,
      legacyResult: { '6001': 30 },
      classScoreState: DEFAULT_CLASS_SCORE_STATE,
    })
    expect(res.source).toBe('servant')
    expect(res.total).toEqual({})
  })

  it('育成ぶんのキーが無く旧値があれば（移行中）、旧値をそのまま使いクラススコアぶんを足さない', () => {
    const res = resolveRequiredMaterials({
      servantResult: null,
      servantCurrent: false,
      legacyResult: { '1': 5000, '7001': 140 },
      classScoreState: saberTarget,
    })
    expect(res.source).toBe('legacy')
    expect(res.total).toEqual({ '1': 5000, '7001': 140 })
    expect(res.servant).toBeNull()
    expect(res.classScore).toEqual({})
  })

  it('育成ぶんが今の状態の値でない間は、旧値があれば旧値を合算済みとして読む', () => {
    const res = resolveRequiredMaterials({
      servantResult: {},
      servantCurrent: false,
      legacyResult: { '6001': 30 },
      classScoreState: saberTarget,
    })
    expect(res.source).toBe('legacy')
    expect(res.total).toEqual({ '6001': 30 })
  })

  it('育成ぶんが今の状態の値でなく旧値も無ければ、保存値とクラススコアぶんを足す', () => {
    const res = resolveRequiredMaterials({
      servantResult: { '6001': 3 },
      servantCurrent: false,
      legacyResult: null,
      classScoreState: DEFAULT_CLASS_SCORE_STATE,
    })
    expect(res.source).toBe('servant')
    expect(res.total).toEqual({ '6001': 3 })
  })

  it('どちらも無ければクラススコアぶんだけになる', () => {
    expect(
      resolveRequiredMaterials({
        servantResult: null,
        servantCurrent: false,
        legacyResult: null,
        classScoreState: saberTarget,
      }).total,
    ).toEqual(sumClassScoreMaterials(saberTarget))
    expect(
      resolveRequiredMaterials({
        servantResult: null,
        servantCurrent: false,
        legacyResult: null,
        classScoreState: DEFAULT_CLASS_SCORE_STATE,
      }).total,
    ).toEqual({})
  })

  it('部分目標の盤面では、目標かつ未解放のマスぶんだけが足される', () => {
    const playables = getPlayableSquareIds(getClassBoardData('saber'))
    const [unlocked, ...rest] = playables
    const targets = rest.slice(0, 2)
    const partial: ClassScoreState = {
      classes: { ...DEFAULT_CLASS_SCORE_STATE.classes },
      boards: { saber: { unlockedSquareIds: [unlocked], targetSquareIds: targets } },
    }
    const cs = sumClassScoreMaterials(partial)
    expect(Object.keys(cs).length).toBeGreaterThan(0)
    expect(cs['1'] ?? 0).toBeLessThan(SABER_QP)

    const res = resolveRequiredMaterials({
      servantResult: { '1': 10 },
      servantCurrent: true,
      legacyResult: null,
      classScoreState: partial,
    })
    expect(res.total['1']).toBe((cs['1'] ?? 0) + 10)
    // 内訳のクラススコアぶんは全体を上回らない
    for (const [id, n] of Object.entries(res.classScore)) {
      const total: number | undefined = Reflect.get(res.total, id)
      expect(n).toBeLessThanOrEqual(total ?? 0)
    }
  })
})

describe('servantResultWithQuery', () => {
  const query = { '6001': 7 }
  it('求めた育成ぶんが空ならクエリの値を使う', () => {
    expect(servantResultWithQuery({}, query)).toBe(query)
  })
  it('求めた育成ぶんが空でなければ、求めた値を使う', () => {
    expect(servantResultWithQuery({ '6002': 1 }, query)).toEqual({ '6002': 1 })
  })
  it('まだ求まっていなければ（取得中・取得失敗）クエリの値を使う', () => {
    expect(servantResultWithQuery(null, query)).toBe(query)
  })
})

describe('isEmptyAmounts', () => {
  it('正の数が無ければ空', () => {
    expect(isEmptyAmounts({})).toBe(true)
    expect(isEmptyAmounts({ '1': 0 })).toBe(true)
    expect(isEmptyAmounts({ '1': 1 })).toBe(false)
  })
})

const ownedWithAscension = (): ChaldeaState => {
  const state = createChaldeaState(['1'])
  const s = state['1']
  s.disabled = false
  s.targets.ascension.ranges = [{ start: 0, end: 1 }]
  s.targets.skill.disabled = true
  s.targets.appendSkill.disabled = true
  return state
}

const materials: MaterialsForServants = {
  '1': {
    ascensionMaterials: { '0': { items: [{ item: { id: 6001 }, amount: 5 }], qp: 1000 } },
    skillMaterials: {},
    appendSkillMaterials: {},
  },
}

describe('hasServantTargets / computeServantResult', () => {
  it('有効なサーヴァントに進む範囲があれば目標あり', () => {
    expect(hasServantTargets(ownedWithAscension())).toBe(true)
  })

  it('未所持・all・範囲が進まないものは目標なし', () => {
    const state = ownedWithAscension()
    state['1'].targets.ascension.ranges = [{ start: 1, end: 1 }]
    expect(hasServantTargets(state)).toBe(false)
    expect(hasServantTargets({ ...createChaldeaState(['all', '2']) })).toBe(false)
    expect(hasServantTargets({})).toBe(false)
  })

  it('素材データに無いサーヴァントは飛ばして求める', () => {
    const state = { ...ownedWithAscension(), ...{ '9': { ...ownedWithAscension()['1'] } } }
    expect(computeServantResult(state, materials)).toEqual({ '6001': 5, '1': 1000 })
  })
})
