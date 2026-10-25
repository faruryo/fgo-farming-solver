import { describe, expect, it, vi } from 'vitest'
import {
  SYNCED_KEYS,
  planKeys,
  previewMasterDataTarget,
  syncPreviewMasterData,
} from './preview-master-data-sync'

const PRODUCTION_CLOUD_SAVE = 'c621d47e509445a3a7f713702b3cb07e'
const PRODUCTION_MASTER_DATA = '306bbe537e9d4907809f82468df500e4'
const PRODUCTION_D1 = '4bb0a615-9079-4233-b57f-a5725b9eb4da'
const PREVIEW_MASTER_DATA = '9d4d9cbdf56e4cb284d6c74234e40a5d'
const OTHER_TOP_LEVEL = 'dddddddddddddddddddddddddddddddd'

const topLevel = `
[[kv_namespaces]]
binding = "CLOUD_SAVE"
id = "${PRODUCTION_CLOUD_SAVE}"

[[kv_namespaces]]
binding = "MASTER_DATA"
id = "${PRODUCTION_MASTER_DATA}"

[[kv_namespaces]]
binding = "OTHER"
id = "${OTHER_TOP_LEVEL}"

[[d1_databases]]
binding = "DB"
database_name = "fgo-farming-solver-db"
database_id = "${PRODUCTION_D1}"
`

const previews = (masterDataId: string | null) => `
[[previews.kv_namespaces]]
binding = "CLOUD_SAVE"
id = "a6cff391f6d847a1925ebb70d94a4c46"
${
  masterDataId === null
    ? ''
    : `
[[previews.kv_namespaces]]
binding = "MASTER_DATA"
id = "${masterDataId}"
`
}`

const toml = (masterDataId: string | null) => topLevel + previews(masterDataId)

describe('previewMasterDataTarget', () => {
  it('returns the preview MASTER_DATA id', () => {
    expect(previewMasterDataTarget(toml(PREVIEW_MASTER_DATA))).toEqual({
      namespaceId: PREVIEW_MASTER_DATA,
    })
  })

  it.each([
    ['production MASTER_DATA', PRODUCTION_MASTER_DATA],
    ['production CLOUD_SAVE', PRODUCTION_CLOUD_SAVE],
    ['another top-level id', OTHER_TOP_LEVEL],
  ])('refuses %s', (_, id) => {
    const target = previewMasterDataTarget(toml(id))
    expect(target.namespaceId).toBeUndefined()
    expect(target.reason).toContain('production')
  })

  it('refuses when previews has no MASTER_DATA', () => {
    const target = previewMasterDataTarget(toml(null))
    expect(target.namespaceId).toBeUndefined()
    expect(target.reason).toContain('no MASTER_DATA')
  })

  it('refuses the known production id even if the top level no longer lists it', () => {
    const target = previewMasterDataTarget(previews(PRODUCTION_MASTER_DATA))
    expect(target.namespaceId).toBeUndefined()
    expect(target.reason).toContain('production')
  })
})

describe('planKeys', () => {
  it('writes changed keys and keys missing in preview, skips the rest', () => {
    const plan = planKeys(
      new Map([
        ['all_drops_json', 'new'],
        ['dashboard_meta', 'same'],
        ['event_data_json', 'v'],
        ['material_catalog_v1', null],
        ['nice_war_aaquests', 'cache'],
      ]),
      new Map([
        ['all_drops_json', 'old'],
        ['dashboard_meta', 'same'],
        ['event_data_json', null],
        ['material_catalog_v1', 'kept'],
        ['nice_war_aaquests', null],
      ]),
    )
    expect(plan.write).toEqual(['all_drops_json', 'event_data_json'])
    expect(plan.skipped).toEqual([
      { key: 'dashboard_meta', reason: 'unchanged' },
      { key: 'material_catalog_v1', reason: 'missing in production' },
      { key: 'rarity_ap_tables', reason: 'missing in production' },
      { key: 'servants_list', reason: 'missing in production' },
    ])
  })
})

const productionValue = async (key: string): Promise<string | null> =>
  (SYNCED_KEYS as readonly string[]).includes(key) ? `prod:${key}` : null

type Deps = Parameters<typeof syncPreviewMasterData>[0]

const deps = (overrides: Partial<Deps>) => {
  const d = {
    toml: toml(PREVIEW_MASTER_DATA),
    getProduction: vi.fn<Deps['getProduction']>(productionValue),
    getPreview: vi.fn<Deps['getPreview']>(async () => null),
    putPreview: vi.fn<Deps['putPreview']>(async () => {}),
    log: vi.fn(),
    error: vi.fn(),
  }
  return { ...d, ...overrides, mocks: d }
}

describe('syncPreviewMasterData', () => {
  it('writes every differing key to the preview namespace', async () => {
    const d = deps({})
    expect(await syncPreviewMasterData(d)).toBe(0)
    expect(d.mocks.putPreview.mock.calls).toEqual(
      SYNCED_KEYS.map((k) => [PREVIEW_MASTER_DATA, k, `prod:${k}`]),
    )
  })

  it('never writes when the target is a production namespace', async () => {
    const d = deps({ toml: toml(PRODUCTION_MASTER_DATA) })
    expect(await syncPreviewMasterData(d)).toBe(1)
    expect(d.mocks.putPreview).not.toHaveBeenCalled()
    expect(d.mocks.getPreview).not.toHaveBeenCalled()
  })

  it('tries the remaining keys after a write failure and exits non-zero', async () => {
    const putPreview = vi.fn<Deps['putPreview']>(async (...args) => {
      if (args[1] === 'all_drops_json') throw new Error('boom')
    })
    const d = deps({ putPreview })
    expect(await syncPreviewMasterData(d)).toBe(1)
    expect(putPreview.mock.calls.map((c) => c[1])).toEqual([...SYNCED_KEYS])
  })

  it('tries the remaining keys after a read failure and exits non-zero', async () => {
    const getProduction = vi.fn(async (key: string) => {
      if (key === 'dashboard_meta') throw new Error('boom')
      return productionValue(key)
    })
    const putPreview = vi.fn<Deps['putPreview']>(async () => {})
    const d = deps({ getProduction, putPreview })
    expect(await syncPreviewMasterData(d)).toBe(1)
    expect(putPreview.mock.calls.map((c) => c[1])).toEqual(
      SYNCED_KEYS.filter((k) => k !== 'dashboard_meta'),
    )
  })
})
