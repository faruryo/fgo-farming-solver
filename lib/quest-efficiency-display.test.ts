import { describe, expect, it } from 'vitest'
import {
  efficiencyScoreColorVar,
  efficiencyScoreLabelFallback,
  efficiencyScoreLabelKey,
} from './quest-efficiency-display'

describe('efficiencyScoreLabelKey', () => {
  it('AP効率は ap-efficiency-score を返す', () => {
    expect(efficiencyScoreLabelKey('ap')).toBe('ap-efficiency-score')
  })

  it('周回効率は turn-efficiency-score を返す', () => {
    expect(efficiencyScoreLabelKey('turn')).toBe('turn-efficiency-score')
  })
})

describe('efficiencyScoreLabelFallback', () => {
  it('AP効率と周回効率でラベルが異なる', () => {
    expect(efficiencyScoreLabelFallback('ap')).toBe('AP効率ポイント')
    expect(efficiencyScoreLabelFallback('turn')).toBe('周回効率ポイント')
    expect(efficiencyScoreLabelFallback('ap')).not.toBe(efficiencyScoreLabelFallback('turn'))
  })
})

describe('efficiencyScoreColorVar', () => {
  it('AP効率と周回効率で色トークンが異なる', () => {
    expect(efficiencyScoreColorVar('ap')).toBe('var(--efficiency-ap)')
    expect(efficiencyScoreColorVar('turn')).toBe('var(--efficiency-turn)')
    expect(efficiencyScoreColorVar('ap')).not.toBe(efficiencyScoreColorVar('turn'))
  })
})
