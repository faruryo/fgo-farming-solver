import { describe, expect, it, vi } from 'vitest'
import { makeItem, makeMaterials, makeServant } from '../components/material/test-fixtures'
import { buildMaterialCatalog, MATERIAL_CATALOG_KEY } from './material-catalog'
import { runMaterialCatalogPhase } from './material-catalog-phase'

const servant = makeServant({ id: 1, extraAssets: { faces: { ascension: { '0': 'face.png' } }, charaGraph: {} } })
const servantWithMaterials = { ...servant, ...makeMaterials() }
const items = [100, 200, 300, 400, 500].map(id => makeItem({ id, type: id === 100 ? 'qp' : 'skillLvUp' }))
const previous = buildMaterialCatalog({
  servants: [servant], materials: { 1: makeMaterials() }, items,
  sources: { niceServant: { etag: 'servant-v1' }, niceItem: { etag: 'item-v1' } }, updatedAt: 1,
})

const logger = { log: vi.fn(), error: vi.fn() }

const run = (overrides: Partial<Parameters<typeof runMaterialCatalogPhase>[0]> = {}) =>
  runMaterialCatalogPhase({
    get: vi.fn().mockResolvedValue(JSON.stringify(previous)),
    put: vi.fn().mockResolvedValue(undefined),
    fetchSource: vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 304 }))
      .mockResolvedValueOnce(new Response(null, { status: 304 })),
    servantUrl: 'servants',
    itemUrl: 'items',
    logger,
    ...overrides,
  })

describe('runMaterialCatalogPhase', () => {
  it('skips KV writes when both Atlas sources are unchanged', async () => {
    const get = vi.fn().mockResolvedValue(JSON.stringify(previous))
    const put = vi.fn().mockResolvedValue(undefined)

    await expect(run({ get, put })).resolves.toEqual({ failed: false })
    expect(get).toHaveBeenCalledWith(MATERIAL_CATALOG_KEY)
    expect(put).not.toHaveBeenCalled()
  })

  it('keeps last-known-good and lets later phases continue when a source cannot be reused', async () => {
    const put = vi.fn().mockResolvedValue(undefined)
    const nextPhase = vi.fn()

    const result = await run({ get: vi.fn().mockResolvedValue(null), put })
    if (result.failed) nextPhase()

    expect(result).toEqual({ failed: true })
    expect(put).not.toHaveBeenCalled()
    expect(nextPhase).toHaveBeenCalledOnce()
  })

  it('keeps last-known-good when a candidate fails validation', async () => {
    const put = vi.fn().mockResolvedValue(undefined)
    const fetchSource = vi.fn()
      .mockResolvedValueOnce(Response.json([]))
      .mockResolvedValueOnce(Response.json([]))

    await expect(run({ put, fetchSource })).resolves.toEqual({ failed: true })
    expect(put).not.toHaveBeenCalled()
  })

  it('keeps last-known-good when Atlas omits a required material table', async () => {
    const incompleteMaterials = makeMaterials()
    Reflect.deleteProperty(incompleteMaterials, 'appendSkillMaterials')
    const incompleteServant = { ...servant, ...incompleteMaterials }
    const put = vi.fn().mockResolvedValue(undefined)
    const fetchSource = vi.fn()
      .mockResolvedValueOnce(Response.json([incompleteServant], { headers: { etag: 'servant-v2' } }))
      .mockResolvedValueOnce(Response.json(items, { headers: { etag: 'item-v1' } }))

    await expect(run({ put, fetchSource })).resolves.toEqual({ failed: true })

    expect(put).not.toHaveBeenCalled()
  })

  it('reports failure when the one-key KV write fails', async () => {
    const put = vi.fn().mockRejectedValue(new Error('KV unavailable'))
    const fetchSource = vi.fn()
      .mockResolvedValueOnce(Response.json([servantWithMaterials], { headers: { etag: 'servant-v2' } }))
      .mockResolvedValueOnce(Response.json(items, { headers: { etag: 'item-v2' } }))

    await expect(run({ get: vi.fn().mockResolvedValue(null), put, fetchSource })).resolves.toEqual({ failed: true })
    expect(put).toHaveBeenCalledWith(MATERIAL_CATALOG_KEY, expect.any(String))
  })
})
