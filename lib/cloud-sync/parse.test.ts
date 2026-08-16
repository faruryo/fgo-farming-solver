import { describe, it, expect } from 'vitest'
import { parseRecord, normalizeCloudResponse } from './parse'

describe('parseRecord', () => {
  it('null, undefined, 空文字は空オブジェクトを返す', () => {
    expect(parseRecord(null)).toEqual({})
    expect(parseRecord(undefined)).toEqual({})
    expect(parseRecord('')).toEqual({})
  })

  it('JSON の null やプリミティブは空オブジェクトに倒す', () => {
    expect(parseRecord('null')).toEqual({})
    expect(parseRecord('123')).toEqual({})
    expect(parseRecord('"string"')).toEqual({})
    expect(parseRecord('true')).toEqual({})
  })

  it('正常な JSON オブジェクトをパースする', () => {
    expect(parseRecord('{"foo":"bar"}')).toEqual({ foo: 'bar' })
    expect(parseRecord('{}')).toEqual({})
  })

  it('パース不可能な不正文字列は null を返す（測定不能）', () => {
    expect(parseRecord('{invalid json')).toBeNull()
    expect(parseRecord('undefined')).toBeNull()
  })
})

describe('normalizeCloudResponse', () => {
  it('新形式 (metadata + storage) をそのまま返す', () => {
    const data = {
      storage: { 'material': '{}' },
      metadata: { updatedAt: '2026-01-01T00:00:00.000Z', deviceId: 'dev-1' },
    }
    expect(normalizeCloudResponse(data)).toEqual(data)
  })

  it('旧形式 (storage のみ) を epoch メタデータ付きでラップする', () => {
    const raw = { 'material': '{}' }
    expect(normalizeCloudResponse(raw)).toEqual({
      storage: { 'material': '{}' },
      metadata: { updatedAt: new Date(0).toISOString(), deviceId: 'unknown' },
    })
  })

  it('不正なデータ（null/undefined）でも安全にフォールバックする', () => {
    expect(normalizeCloudResponse(null)).toEqual({
      storage: {},
      metadata: { updatedAt: new Date(0).toISOString(), deviceId: 'unknown' },
    })
  })
})
