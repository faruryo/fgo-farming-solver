import { describe, expect, it } from 'vitest'
import { parsePossessionInput } from './possession-count'

describe('parsePossessionInput', () => {
  it('空文字は未入力(undefined)を返す', () => {
    expect(parsePossessionInput('')).toBeUndefined()
  })

  it('整数文字列はそのまま数値化する', () => {
    expect(parsePossessionInput('42')).toBe(42)
  })

  it('小数は切り捨てる', () => {
    expect(parsePossessionInput('5.9')).toBe(5)
  })

  it('負数は0に丸める', () => {
    expect(parsePossessionInput('-3')).toBe(0)
  })

  it('数値でない文字列はundefinedを返す', () => {
    expect(parsePossessionInput('abc')).toBeUndefined()
  })
})
