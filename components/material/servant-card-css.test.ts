import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

// #126: /material は全サーヴァント分（数百枚）のカードを常に描く。カード単位の無限アニメや
// blur を足すと、iOS では描き直しの負荷で WebContent が落ち、読み込み直しを繰り返す
const css = readFileSync(join(__dirname, '../../app/globals.css'), 'utf8')
const rulesFor = (selectorPart: string) =>
  css
    .split('}')
    .map((chunk) => ({ selector: chunk.slice(0, chunk.lastIndexOf('{')).trim(), body: chunk.slice(chunk.lastIndexOf('{') + 1) }))
    .filter(({ selector }) => selector.includes(selectorPart))

describe('servant card CSS stays cheap for hundreds of cards', () => {
  it('has no animation on completed (tier-full) cards or their pseudo elements', () => {
    const rules = rulesFor('.c-servant-card.tier-full')
    expect(rules.length).toBeGreaterThan(0)
    for (const { selector, body } of rules) expect(body, selector).not.toMatch(/animation/)
  })

  it('dims the other cards during highlight without blur', () => {
    const rules = rulesFor(':has(.u-highlight) .c-servant-card')
    expect(rules.length).toBeGreaterThan(0)
    for (const { selector, body } of rules) expect(body, selector).not.toMatch(/blur\(/)
  })
})
