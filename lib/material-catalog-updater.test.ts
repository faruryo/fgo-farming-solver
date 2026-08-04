import { describe, expect, it, vi } from 'vitest'
import { conditionalRequestHeaders, updateMaterialCatalog } from './material-catalog-updater'
import { buildMaterialCatalog } from './material-catalog'
import { makeItem, makeMaterials, makeServant } from '../components/material/test-fixtures'

const servant = makeServant({ id: 1, extraAssets: { faces: { ascension: { '0': 'face.png' } }, charaGraph: {} } })
const items = [100, 200, 300, 400, 500].map(id => makeItem({ id, type: id === 100 ? 'qp' : 'skillLvUp' }))
const previous = buildMaterialCatalog({
  servants: [servant], materials: { 1: makeMaterials() }, items,
  sources: { niceServant: { etag: 'servant-v1' }, niceItem: { etag: 'item-v1' } }, updatedAt: 1,
})

describe('updateMaterialCatalog', () => {
  it('sends Atlas a strong ETag and Last-Modified validator', () => {
    const headers = conditionalRequestHeaders({ etag: 'W/"catalog"', lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT' })
    expect(headers.get('If-None-Match')).toBe('"catalog"')
    expect(headers.get('If-Modified-Since')).toBe('Mon, 01 Jan 2026 00:00:00 GMT')
  })

  it('skips parsing and writing when both sources return 304', async () => {
    const fetchSource = vi.fn().mockResolvedValue({ status: 304, validator: {} })
    const result = await updateMaterialCatalog({ previous, fetchSource, servantUrl: 'servants', itemUrl: 'items', now: () => 2 })
    expect(result).toEqual({ catalog: previous, changed: false, reason: 'both sources not modified' })
  })

  it('reuses a 304 section and skips a semantic no-op without rewriting validators', async () => {
    const fetchSource = vi.fn()
      .mockResolvedValueOnce({ status: 304, validator: {} })
      .mockResolvedValueOnce({ status: 200, value: items, validator: { etag: 'item-v2' } })
    const result = await updateMaterialCatalog({ previous, fetchSource, servantUrl: 'servants', itemUrl: 'items', now: () => 2 })
    expect(result.catalog?.sources).toEqual(previous.sources)
  })

  it('rejects an invalid response before it can replace last-known-good', async () => {
    const fetchSource = vi.fn().mockResolvedValue({ status: 200, value: {}, validator: {} })
    await expect(updateMaterialCatalog({ previous, fetchSource, servantUrl: 'servants', itemUrl: 'items', now: () => 2 })).rejects.toThrow('not an array')
  })

  it('retains ascension items referenced by material records', async () => {
    const servantWithMaterials = { ...servant, ...makeMaterials() }
    const fetchSource = vi.fn()
      .mockResolvedValueOnce({ status: 200, value: [servantWithMaterials], validator: {} })
      .mockResolvedValueOnce({ status: 200, value: [{ ...items[0], type: 'ascension' }, ...items.slice(1)], validator: {} })
    const result = await updateMaterialCatalog({ previous: null, fetchSource, servantUrl: 'servants', itemUrl: 'items', now: () => 2 })
    expect(result.catalog?.items.map(item => item.id)).toContain(100)
  })
})
