import { describe, it, expect } from 'vitest'
import { computeRaritySourceFingerprint } from './rarity-ap-table'

// rarity worker は all_drops_json を毎時読むが、再計算するのは指紋が変わったときだけ。
// この指紋が「AP に効く入力(quests.ap / drop_rates)」にだけ反応し、
// 「AP に効かない揺れ(waveCount・配列順)」には反応しないことを保証する。
describe('computeRaritySourceFingerprint', () => {
  const base = {
    quests: [
      { id: 'q1', ap: 40 },
      { id: 'q2', ap: 20 },
    ],
    drop_rates: [
      { quest_id: 'q1', item_id: 'a', drop_rate: 0.5 },
      { quest_id: 'q2', item_id: 'b', drop_rate: 0.3 },
    ],
  }

  it('同一入力なら同一指紋(決定的)', () => {
    expect(computeRaritySourceFingerprint(base)).toBe(
      computeRaritySourceFingerprint(base)
    )
  })

  it('quests / drop_rates の配列順が変わっても指紋は不変', () => {
    const shuffled = {
      quests: [base.quests[1], base.quests[0]],
      drop_rates: [base.drop_rates[1], base.drop_rates[0]],
    }
    expect(computeRaritySourceFingerprint(shuffled)).toBe(
      computeRaritySourceFingerprint(base)
    )
  })

  it('quest の ap が変わると指紋も変わる(AP キャンペーン反映)', () => {
    const changed = {
      ...base,
      quests: [{ id: 'q1', ap: 20 }, base.quests[1]],
    }
    expect(computeRaritySourceFingerprint(changed)).not.toBe(
      computeRaritySourceFingerprint(base)
    )
  })

  it('drop_rate が変わると指紋も変わる', () => {
    const changed = {
      ...base,
      drop_rates: [
        { quest_id: 'q1', item_id: 'a', drop_rate: 0.9 },
        base.drop_rates[1],
      ],
    }
    expect(computeRaritySourceFingerprint(changed)).not.toBe(
      computeRaritySourceFingerprint(base)
    )
  })

  it('AP に効かないフィールド(waveCount 等)の揺れでは指紋は不変', () => {
    const withWave = {
      quests: base.quests.map((q) => ({ ...q, waveCount: 3 })),
      drop_rates: base.drop_rates,
    }
    expect(computeRaritySourceFingerprint(withWave)).toBe(
      computeRaritySourceFingerprint(base)
    )
  })

  it('クエスト追加(件数変化)で指紋が変わる', () => {
    const added = {
      ...base,
      quests: [...base.quests, { id: 'q3', ap: 30 }],
    }
    expect(computeRaritySourceFingerprint(added)).not.toBe(
      computeRaritySourceFingerprint(base)
    )
  })
})
