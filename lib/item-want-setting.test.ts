import { describe, it, expect } from 'vitest'
import { itemWantKey, readUnwantedKeys, withItemWant } from './item-want-setting'
import { shopWantedKey } from './event-shop-summary'

describe('readUnwantedKeys', () => {
  it('false の品目だけが「いらない」で、true と保存の無い品目は「欲しい」', () => {
    const unwanted = readUnwantedKeys({ 4001: true, 7999: false })
    expect(unwanted.has('7999')).toBe(true)
    expect(unwanted.has('4001')).toBe(false)
    expect(unwanted.has('6503')).toBe(false)
  })

  it('前の版で既定で交換する品目に保存した false（伝承結晶 6999）は「いらない」', () => {
    const unwanted = readUnwantedKeys({ 6999: false, 4001: true })
    expect([...unwanted]).toEqual(['6999'])
  })

  it('boolean でない値は「欲しい」として読む', () => {
    expect(readUnwantedKeys({ 1: 'false', 2: 0, 3: null }).size).toBe(0)
  })

  it('svt: のキーと番号が同じアイテムのキーを取り違えない', () => {
    const unwanted = readUnwantedKeys({ 'svt:9305420': false })
    expect(unwanted.has(shopWantedKey({ itemId: 9305420, kind: 'svt' }))).toBe(true)
    expect(unwanted.has(shopWantedKey({ itemId: 9305420 }))).toBe(false)
    expect(unwanted.has(itemWantKey(9305420))).toBe(false)
  })
})

describe('withItemWant', () => {
  it('「いらない」は false、「欲しい」は true を書き、キーを消さない。ほかのキーはそのまま', () => {
    const unwantedOnce = withItemWant({ 4001: true }, '7999', false)
    expect(unwantedOnce).toEqual({ 4001: true, 7999: false })
    expect(withItemWant(unwantedOnce, '7999', true)).toEqual({ 4001: true, 7999: true })
  })

  it('アイテムの品目のキーは Atlas の番号の文字列', () => {
    expect(itemWantKey(6999)).toBe('6999')
    expect(shopWantedKey({ itemId: 6999 })).toBe('6999')
  })
})
