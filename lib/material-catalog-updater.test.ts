import { describe, expect, it, vi } from 'vitest'
import { conditionalRequestHeaders, updateMaterialCatalog } from './material-catalog-updater'
import { buildMaterialCatalog, type SourceValidator } from './material-catalog'
import { makeBondUpCraftEssence, makeCompleteMaterials, makeItem, makeNiceEquip, makeServant } from '../components/material/test-fixtures'

const servant = makeServant({ id: 1, cost: 16, extraAssets: { faces: { ascension: { '0': 'face.png' } }, charaGraph: {} } })
const items = [100, 200, 300, 400, 500].map(id => makeItem({ id, type: id === 100 ? 'qp' : 'skillLvUp' }))
const equips = [makeNiceEquip()]
const previous = buildMaterialCatalog({
  servants: [servant], materials: { 1: makeCompleteMaterials() }, items,
  bondUpCraftEssences: [makeBondUpCraftEssence()],
  sources: { niceServant: { etag: 'servant-v1' }, niceItem: { etag: 'item-v1' }, niceEquip: { etag: 'equip-v1' } }, updatedAt: 1,
})
const urls = { servantUrl: 'servants', itemUrl: 'items', equipUrl: 'equips' }

describe('updateMaterialCatalog', () => {
  it('sends Atlas a strong ETag and Last-Modified validator', () => {
    const headers = conditionalRequestHeaders({ etag: 'W/"catalog"', lastModified: 'Mon, 01 Jan 2026 00:00:00 GMT' })
    expect(headers.get('If-None-Match')).toBe('"catalog"')
    expect(headers.get('If-Modified-Since')).toBe('Mon, 01 Jan 2026 00:00:00 GMT')
  })

  it('skips parsing and writing when all sources return 304', async () => {
    const fetchSource = vi.fn().mockResolvedValue({ status: 304, validator: {} })
    const result = await updateMaterialCatalog({ previous, fetchSource, ...urls, now: () => 2 })
    expect(result).toEqual({ catalog: previous, changed: false, reason: 'all sources not modified' })
    expect(fetchSource).toHaveBeenCalledTimes(3)
    expect(fetchSource).toHaveBeenCalledWith('equips', { etag: 'equip-v1' })
  })

  it('reuses a 304 section and skips a semantic no-op without rewriting validators', async () => {
    const fetchSource = vi.fn()
      .mockResolvedValueOnce({ status: 304, validator: {} })
      .mockResolvedValueOnce({ status: 200, value: items, validator: { etag: 'item-v2' } })
      .mockResolvedValueOnce({ status: 304, validator: {} })
    const result = await updateMaterialCatalog({ previous, fetchSource, ...urls, now: () => 2 })
    expect(result.catalog?.sources).toEqual(previous.sources)
  })

  it('rejects an invalid response before it can replace last-known-good', async () => {
    const fetchSource = vi.fn().mockResolvedValue({ status: 200, value: {}, validator: {} })
    await expect(updateMaterialCatalog({ previous, fetchSource, ...urls, now: () => 2 })).rejects.toThrow('not an array')
  })

  it('retains ascension items referenced by material records', async () => {
    const servantWithMaterials = { ...servant, ...makeCompleteMaterials() }
    const fetchSource = vi.fn()
      .mockResolvedValueOnce({ status: 200, value: [servantWithMaterials], validator: {} })
      .mockResolvedValueOnce({ status: 200, value: [{ ...items[0], type: 'ascension' }, ...items.slice(1)], validator: {} })
      .mockResolvedValueOnce({ status: 200, value: equips, validator: {} })
    const result = await updateMaterialCatalog({ previous: null, fetchSource, ...urls, now: () => 2 })
    expect(result.catalog?.items.map(item => item.id)).toContain(100)
  })

  it('refreshes items when servants change so new material references can be resolved', async () => {
    const nextMaterials = makeCompleteMaterials()
    nextMaterials.skillMaterials['1'] = {
      ...nextMaterials.skillMaterials['1'],
      items: [{ item: makeItem({ id: 999, type: 'ascension' }), amount: 1 }],
    }
    const nextServant = { ...servant, ...nextMaterials }
    const nextItems = [...items, makeItem({ id: 999, type: 'ascension' })]
    const fetchSource = vi.fn(async (url: string, validator: SourceValidator) => {
      if (url === 'servants') {
        return { status: 200 as const, value: [nextServant], validator: { etag: 'servant-v2' } }
      }
      if (validator.etag) return { status: 304 as const, validator: {} }
      expect(validator).toEqual({})
      return { status: 200 as const, value: nextItems, validator: { etag: 'item-v1' } }
    })

    const result = await updateMaterialCatalog({ previous, fetchSource, ...urls, now: () => 2 })

    expect(result).toMatchObject({ changed: true })
    expect(result.catalog?.items.map(item => item.id)).toContain(999)
    expect(fetchSource).toHaveBeenNthCalledWith(4, 'items', {})
  })

  const servantWithBonus = {
    ...servant, ...makeCompleteMaterials(), bondGrowth: [1000],
    extraPassive: [{
      extraPassive: [{ eventId: 80627, startedAt: 0, endedAt: 1_800_000_000 }],
      functions: [{ funcType: 'servantFriendshipUp', buffs: [], svals: [{ RateCount: 200 }] }],
    }],
  }
  const eventsOk = async () => ({ status: 200 as const, value: [{ id: 80627, name: 'ハロウィン' }], validator: {} })
  const eventsDown = async (): Promise<never> => { throw new Error('boom') }
  const previousNamed = {
    ...previous,
    servants: [{
      ...previous.servants[0], bondGrowth: [1000],
      eventBonuses: [{ eventId: 80627, eventName: 'ハロウィン', startedAt: 0, endedAt: 1_800_000_000, bond: 20 }],
    }],
  }

  it.each([
    ['names the bonus event from basic_event', previous, eventsOk, 'ハロウィン'],
    ['keeps updating when basic_event cannot be read', previous, eventsDown, undefined],
    ['keeps the previous event names when basic_event cannot be read', previousNamed, eventsDown, 'ハロウィン'],
  ])('%s', async (_label, prev, eventResponse, expectedName) => {
    const fetchSource = vi.fn(async (url: string) => {
      if (url === 'events') return eventResponse()
      if (url === 'servants') return { status: 200 as const, value: [servantWithBonus], validator: { etag: 'servant-v2' } }
      return { status: 304 as const, validator: {} }
    })
    const result = await updateMaterialCatalog({ previous: prev, fetchSource, ...urls, eventUrl: 'events', now: () => 2 })
    expect(result.catalog?.servants[0].eventBonuses?.[0]?.eventName).toBe(expectedName)
    expect(result.catalog?.servants[0].eventBonuses?.[0]?.bond).toBe(20)
  })

  it.each([
    ['an eventQuest started after the last build', 'eventQuest', {}],
    ['only a campaign started after the last build', 'questCampaign', { etag: 'servant-v1' }],
    ['basic_event cannot be read, so a start cannot be ruled out', null, {}],
  ])('refetches nice_servant unconditionally only when %s', async (_label, type, expectedValidator) => {
    const prev = { ...previous, updatedAt: 1_000_000, servants: [{ ...previous.servants[0], bondGrowth: [1000] }] }
    const fetchSource = vi.fn<(url: string, validator: SourceValidator) => Promise<{ status: 200 | 304; value?: unknown; validator: SourceValidator }>>(async url => {
      if (url !== 'events') return { status: 304 as const, validator: {} }
      if (type === null) throw new Error('boom')
      return { status: 200 as const, value: [{ id: 80627, name: 'ハロウィン', type, startedAt: 1_500 }], validator: {} }
    })
    await updateMaterialCatalog({ previous: prev, fetchSource, ...urls, eventUrl: 'events', now: () => 2_000_000 })
    expect(fetchSource).toHaveBeenCalledWith('servants', expectedValidator)
  })

  it.each([
    ['without bondGrowth', previous, {}],
    ['with bondGrowth', { ...previous, servants: [{ ...previous.servants[0], bondGrowth: [1000] }] }, { etag: 'servant-v1' }],
    ['with bondGrowth but built before eventBonuses', { ...previous, servants: [{ ...previous.servants[0], bondGrowth: [1000], eventBonuses: undefined }] }, {}],
  ])('refetches nice_servant unconditionally only when the previous catalog lacks bondGrowth or eventBonuses (%s)', async (_label, prev, expectedValidator) => {
    const fetchSource = vi.fn(async (url: string, validator: SourceValidator) => {
      if (url === 'servants' && !validator.etag) {
        return { status: 200 as const, value: [{ ...servant, ...makeCompleteMaterials(), bondGrowth: [1000, 3000] }], validator: { etag: 'servant-v1' } }
      }
      return { status: 304 as const, validator: {} }
    })
    const result = await updateMaterialCatalog({ previous: prev, fetchSource, ...urls, now: () => 2 })
    expect(fetchSource).toHaveBeenCalledWith('servants', expectedValidator)
    if (!('etag' in expectedValidator)) expect(result.catalog?.servants[0].bondGrowth).toEqual([1000, 3000])
  })

  it('refetches nice_servant unconditionally when no previous servant has a cost', async () => {
    const prev = { ...previous, servants: [{ ...previous.servants[0], bondGrowth: [1000], cost: undefined }] }
    const fetchSource = vi.fn(async (url: string, validator: SourceValidator) => {
      if (url === 'servants' && !validator.etag) {
        return { status: 200 as const, value: [{ ...servant, ...makeCompleteMaterials(), bondGrowth: [1000] }], validator: { etag: 'servant-v1' } }
      }
      return { status: 304 as const, validator: {} }
    })
    const result = await updateMaterialCatalog({ previous: prev, fetchSource, ...urls, now: () => 2 })
    expect(fetchSource).toHaveBeenCalledWith('servants', {})
    expect(result.catalog?.servants[0].cost).toBe(16)
  })

  it('keeps the previous bond-up craft essences without parsing when nice_equip returns 304', async () => {
    const fetchSource = vi.fn(async (url: string) => {
      if (url === 'servants') {
        return { status: 200 as const, value: [{ ...servant, ...makeCompleteMaterials(), name: '改名' }], validator: { etag: 'servant-v2' } }
      }
      // 304 の本文は読まれないので、parse されれば落ちる値を返す。
      return { status: 304 as const, value: 'not an array', validator: {} }
    })
    const result = await updateMaterialCatalog({ previous, fetchSource, ...urls, now: () => 2 })
    expect(result.changed).toBe(true)
    expect(result.catalog?.bondUpCraftEssences).toEqual(previous.bondUpCraftEssences)
    expect(result.catalog?.sources.niceEquip).toEqual({ etag: 'equip-v1' })
  })

  it('fetches nice_equip unconditionally when the previous catalog has no bond-up craft essences', async () => {
    const prev = { ...previous, bondUpCraftEssences: undefined }
    const fetchSource = vi.fn(async (url: string) =>
      url === 'equips'
        ? { status: 200 as const, value: equips, validator: { etag: 'equip-v1' } }
        : { status: 304 as const, validator: {} })
    const result = await updateMaterialCatalog({ previous: prev, fetchSource, ...urls, now: () => 2 })
    expect(fetchSource).toHaveBeenCalledWith('equips', {})
    expect(result.changed).toBe(true)
    expect(result.catalog?.bondUpCraftEssences).toHaveLength(1)
  })

  it('writes a candidate when only nice_equip changed, keeping servants and their cost', async () => {
    const nextEquips = [makeNiceEquip(), makeNiceEquip({ id: 9400001, collectionNo: 2 })]
    const fetchSource = vi.fn(async (url: string) =>
      url === 'equips'
        ? { status: 200 as const, value: nextEquips, validator: { etag: 'equip-v2' } }
        : { status: 304 as const, validator: {} })
    const result = await updateMaterialCatalog({ previous, fetchSource, ...urls, now: () => 2 })
    expect(result).toMatchObject({ changed: true, reason: 'catalog updated' })
    expect(result.catalog?.bondUpCraftEssences?.map(essence => essence.id)).toEqual([9400000, 9400001])
    expect(result.catalog?.sources).toEqual({ ...previous.sources, niceEquip: { etag: 'equip-v2' } })
    expect(result.catalog?.servants[0].cost).toBe(16)
    expect(result.catalog?.items).toEqual(previous.items)
  })

  it('skips writing when only the nice_equip validator changed', async () => {
    const fetchSource = vi.fn(async (url: string) =>
      url === 'equips'
        ? { status: 200 as const, value: equips, validator: { etag: 'equip-v2' } }
        : { status: 304 as const, validator: {} })
    const result = await updateMaterialCatalog({ previous, fetchSource, ...urls, now: () => 2 })
    expect(result).toEqual({ catalog: previous, changed: false, reason: 'semantic content unchanged' })
  })

  it('refuses a nice_equip response that distills to no bond-up craft essences', async () => {
    const fetchSource = vi.fn(async (url: string) =>
      url === 'equips'
        ? { status: 200 as const, value: [makeNiceEquip({ skills: [] })], validator: { etag: 'equip-v2' } }
        : { status: 304 as const, validator: {} })
    await expect(updateMaterialCatalog({ previous, fetchSource, ...urls, now: () => 2 })).rejects.toThrow('bond-up craft essences is empty')
  })
})
