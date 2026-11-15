import { describe, expect, it } from 'vitest'
import { createChaldeaState, type ChaldeaState, type ServantState } from '../hooks/create-chaldea-state'
import { countNewlyOwned, withOwnedServants } from './servant-roster-owned'

const planned = (disabled: boolean): ServantState => ({
  disabled,
  targets: {
    ascension: { disabled: false, ranges: [{ start: 2, end: 4 }] },
    skill: { disabled: false, ranges: [{ start: 6, end: 10 }, { start: 7, end: 10 }, { start: 8, end: 9 }] },
    appendSkill: { disabled: true, ranges: [1, 2, 3, 4, 5].map(n => ({ start: n, end: 10 })) },
  },
})

const state = (): ChaldeaState => ({
  ...createChaldeaState(['all', '100', '200']),
  '300': planned(true),
  '400': planned(false),
})

describe('withOwnedServants', () => {
  it('未所持のサーヴァントを取り込むと「所持」になる', () => {
    const next = withOwnedServants(state(), [100])
    expect(next['100']?.disabled).toBe(false)
  })

  it('育成計画の値（再臨・スキル・アペンドスキルの今と目標）を変えない', () => {
    const prev = state()
    const next = withOwnedServants(prev, ['300'])
    expect(next['300']).toEqual({ ...planned(true), disabled: false })
    expect(next['300']?.targets).toEqual(prev['300']?.targets)
  })

  it('写っていないサーヴァントと `all` は同じ値のまま', () => {
    const prev = state()
    const next = withOwnedServants(prev, ['100'])
    expect(next['200']).toBe(prev['200'])
    expect(next['300']).toBe(prev['300'])
    expect(next.all).toBe(prev.all)
  })

  it('既に所持のサーヴァントは未所持に戻らない', () => {
    const prev = state()
    const next = withOwnedServants(prev, ['400', '100'])
    expect(next['400']).toBe(prev['400'])
    expect(next['400']?.disabled).toBe(false)
  })

  it('前の状態に無い ID と `all` は足さずに飛ばす', () => {
    const prev = state()
    const next = withOwnedServants(prev, ['999', 'all'])
    expect(next).toBe(prev)
    expect(new Set(Object.keys(withOwnedServants(prev, ['999', '100'])))).toEqual(new Set(Object.keys(prev)))
    expect(next.all?.disabled).toBe(true)
  })

  it('前の状態を書き換えない', () => {
    const prev = state()
    withOwnedServants(prev, ['100'])
    expect(prev['100']?.disabled).toBe(true)
  })
})

describe('countNewlyOwned', () => {
  it('前の状態にあり未所持の ID だけを数える（既に所持・無い ID・重複・`all` は数えない）', () => {
    expect(countNewlyOwned(state(), ['100', 100, '300', '400', '999', 'all'])).toBe(2)
  })

  it('空の一覧は 0', () => {
    expect(countNewlyOwned(state(), [])).toBe(0)
  })
})
