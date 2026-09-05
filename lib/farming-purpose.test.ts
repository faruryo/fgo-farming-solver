import { describe, expect, it } from 'vitest'
import { migrateFarmingPurpose } from './farming-purpose'

describe('migrateFarmingPurpose', () => {
  it('新しい値を旧設定より優先する', () => {
    expect(migrateFarmingPurpose('training', true, false)).toBe('training')
  })

  it('旧全部、旧ストック、既定値の順に移行する', () => {
    expect(migrateFarmingPurpose(null, true, false)).toBe('all')
    expect(migrateFarmingPurpose(null, false, true)).toBe('reserve')
    expect(migrateFarmingPurpose(null, false, false)).toBe('training')
  })

  it('壊れた新しい値は旧設定から復旧する', () => {
    expect(migrateFarmingPurpose('broken', false, true)).toBe('reserve')
  })
})
