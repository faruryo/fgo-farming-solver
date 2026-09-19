import { describe, expect, it } from 'vitest'
import {
  sumClassScoreFarmingMaterials,
  sumClassScoreMaterials,
} from './sum'
import { DEFAULT_CLASS_SCORE_STATE, ClassScoreState } from './types'

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
})
