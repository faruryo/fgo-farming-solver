/**
 * 実際のスクリーンショットから取った fixture（scripts/build-roster-fixture.ts で作り直す）で、
 * 顔の照合と帯の読みの解釈が当たっていたカードを外さないかを確かめる。OCR の読み違いそのものは範囲外。
 */
import { describe, expect, it } from 'vitest'
import fixture from './__fixtures__/real-screens.json'
import { decodeFacePixels, faceCandidates, matchFaceCrops } from './face-match'
import type { Rect, RosterScreen } from './types'
import { readCardValues } from './values'

type Card = (typeof fixture.cards)[number] & { screen: RosterScreen; base: Rect }
const cards = fixture.cards as Card[]
const ids = new Set(fixture.icons.map((i) => i.servantId))
const candidates = { enhance: faceCandidates(fixture, ids, 'enhance'), skill: faceCandidates(fixture, ids, 'skill') }
const cropsOf = (card: Card) =>
  card.crops.map(({ rect, crop }) => {
    const pixels = decodeFacePixels(crop)
    if (!pixels) throw new Error(`fixture の切り出しが壊れています: ${card.image} ${card.row}-${card.column}`)
    return { rect, crop: pixels }
  })
const label = (card: Card) => `${card.image} ${card.row}-${card.column}`
const bandText = (card: Card) => card.top.map((b) => b.text).join(' ')

describe('実画面の fixture', () => {
  it('スキル強化の7列の画面 18 枚と、サーヴァント強化の画面 21 枚がある', () => {
    expect(cards.filter((c) => c.image === 'skill-7col')).toHaveLength(18)
    expect(cards.filter((c) => c.image === 'enhance-np-order')).toHaveLength(21)
    expect(cards.every((c) => c.expected.servantId !== null)).toBe(true)
  })

  it.each(cards.map((c) => [label(c), c] as const))('%s の顔が期待したサーヴァントになる', (_, card) => {
    const face = matchFaceCrops(cropsOf(card), card.base, candidates[card.screen], card.screen)
    expect(face.kind === 'matched' ? face.servantId : face).toBe(card.expected.servantId)
  })

  it.each(cards.map((c) => [label(c), c] as const))('%s の帯の読みが期待した値になる', (_, card) => {
    const values = readCardValues(card.top, card.bottom, card.screen)
    expect({ lv: values.lv, npLv: values.npLv, skills: values.skills }).toEqual({
      lv: card.expected.lv,
      npLv: card.expected.npLv,
      skills: card.expected.skills,
    })
  })

  it('#314 のカード（暗い Lv.MAX のカード2枚と「宝具Lv51/5」の1枚）が入っている', () => {
    // 暗いカードは明るさをそろえない比べ方では「どのサーヴァントにも近くない」になる
    const dark = cards.filter((c) => {
      const raw = matchFaceCrops(cropsOf(c), c.base, candidates[c.screen], 'enhance')
      return c.screen === 'skill' && raw.kind === 'review' && raw.reason === 'unknown-face'
    })
    expect(dark).toHaveLength(2)
    const np51 = cards.filter((c) => bandText(c).includes('51/5'))
    expect(np51).toHaveLength(1)
    expect(np51[0]?.expected.npLv).toEqual({ current: 1, max: 5 })
  })
})
