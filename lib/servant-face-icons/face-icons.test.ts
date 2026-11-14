import { describe, expect, it } from 'vitest'
import type { FaceIconData } from '../servant-roster-import/types'
import {
  buildFaceIconData,
  isSameFaceIconData,
  listFaceIconSources,
  needsUnconditionalFetch,
  parseFaceIconData,
  planFaceIconUpdate,
  type FaceSourceServant,
} from './face-icons'

const servant = (id: number, type: string, ascension: Record<string, string>, costume?: Record<string, string>): FaceSourceServant => ({
  id,
  type,
  extraAssets: { faces: { ascension, costume } },
})

const entry = (servantId: number, url: string) => ({ servantId, url, pixels: `px-${url}` })

describe('listFaceIconSources', () => {
  it('lists every ascension and costume face of playable servants only', () => {
    const sources = listFaceIconSources([
      servant(1, 'normal', { '2': 'a2', '1': 'a1', '4': 'a4', '3': 'a3' }, { '100130': 'c30', '100110': 'c10' }),
      servant(2, 'heroine', { '1': 'm1' }),
      servant(3, 'enemyCollection', { '1': 'e1' }),
      servant(4, 'enemy', { '1': 'x1' }),
    ])

    expect(sources).toEqual([
      { servantId: 1, url: 'a1' },
      { servantId: 1, url: 'a2' },
      { servantId: 1, url: 'a3' },
      { servantId: 1, url: 'a4' },
      { servantId: 1, url: 'c10' },
      { servantId: 1, url: 'c30' },
      { servantId: 2, url: 'm1' },
    ])
  })

  it('skips servants without faces and lists a shared URL once', () => {
    expect(listFaceIconSources([
      { id: 1, type: 'normal' },
      servant(2, 'normal', { '1': 'same', '2': 'same', '3': '' }),
    ])).toEqual([{ servantId: 2, url: 'same' }])
  })
})

describe('planFaceIconUpdate', () => {
  const previous: FaceIconData = { icons: [entry(1, 'a1'), entry(1, 'a2')], failedUrls: [], etag: 'v1' }

  it('fetches only the faces of a newly added servant', () => {
    const plan = planFaceIconUpdate(previous, [
      { servantId: 1, url: 'a1' },
      { servantId: 1, url: 'a2' },
      { servantId: 9, url: 'n1' },
      { servantId: 9, url: 'n2' },
    ])

    expect(plan.fetch).toEqual([{ servantId: 9, url: 'n1' }, { servantId: 9, url: 'n2' }])
    expect(plan.keep).toEqual([entry(1, 'a1'), entry(1, 'a2')])
  })

  it('fetches everything when there is no previous data', () => {
    const sources = [{ servantId: 1, url: 'a1' }]
    expect(planFaceIconUpdate(null, sources)).toEqual({ fetch: sources, keep: [] })
  })

  it('fetches a face that failed last time again', () => {
    const plan = planFaceIconUpdate(
      { ...previous, failedUrls: ['a3'] },
      [{ servantId: 1, url: 'a1' }, { servantId: 1, url: 'a2' }, { servantId: 1, url: 'a3' }],
    )
    expect(plan.fetch).toEqual([{ servantId: 1, url: 'a3' }])
  })
})

describe('buildFaceIconData', () => {
  it('keeps the previous faces and records the face that could not be fetched', () => {
    const sources = [
      { servantId: 1, url: 'a1' },
      { servantId: 9, url: 'n1' },
      { servantId: 9, url: 'n2' },
      { servantId: 1, url: 'a2' },
    ]
    const data = buildFaceIconData({
      sources,
      keep: [entry(1, 'a1'), entry(1, 'a2')],
      fetched: [entry(9, 'n1')],
      failedUrls: ['n2'],
      etag: 'v2',
      updatedAt: '2026-11-15T00:00:00.000Z',
    })

    expect(data).toEqual({
      icons: [entry(1, 'a1'), entry(9, 'n1'), entry(1, 'a2')],
      failedUrls: ['n2'],
      etag: 'v2',
      updatedAt: '2026-11-15T00:00:00.000Z',
    })
  })
})

describe('parseFaceIconData', () => {
  it('reads stored data', () => {
    const stored = { icons: [entry(1, 'a1')], failedUrls: ['a2'], etag: 'v1', updatedAt: 'x' }
    expect(parseFaceIconData(JSON.stringify(stored))).toEqual(stored)
  })

  it.each([null, '', 'not json', '{}', '{"icons":[{"url":"a"}]}', '[]'])('treats %j as no data', raw => {
    expect(parseFaceIconData(raw)).toBeNull()
  })
})

describe('needsUnconditionalFetch', () => {
  it('is unconditional without data or with faces left to retry', () => {
    expect(needsUnconditionalFetch(null)).toBe(true)
    expect(needsUnconditionalFetch({ icons: [], failedUrls: ['a'] })).toBe(true)
    expect(needsUnconditionalFetch({ icons: [], failedUrls: [], etag: 'v1' })).toBe(false)
    expect(needsUnconditionalFetch({ icons: [] })).toBe(false)
  })
})

describe('isSameFaceIconData', () => {
  const data: FaceIconData = { icons: [entry(1, 'a1')], failedUrls: [], etag: 'v1', updatedAt: 'old' }

  it('ignores only the time it was built', () => {
    expect(isSameFaceIconData(data, { ...data, updatedAt: 'new' })).toBe(true)
    expect(isSameFaceIconData(null, data)).toBe(false)
    expect(isSameFaceIconData(data, { ...data, etag: 'v2' })).toBe(false)
    expect(isSameFaceIconData(data, { ...data, failedUrls: ['a2'] })).toBe(false)
    expect(isSameFaceIconData(data, { ...data, icons: [entry(1, 'a1'), entry(1, 'a2')] })).toBe(false)
  })
})
