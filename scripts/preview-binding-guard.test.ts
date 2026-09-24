import { describe, expect, it } from 'vitest'
import { productionIdsInPreviews } from './preview-binding-guard'

const PRODUCTION_KV = 'c621d47e509445a3a7f713702b3cb07e'
const PRODUCTION_D1 = '4bb0a615-9079-4233-b57f-a5725b9eb4da'
const PREVIEW_KV = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const PREVIEW_D1 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

const toml = (previewKv: string, previewD1: string) => `
[[kv_namespaces]]
binding = "CLOUD_SAVE"
id = "${PRODUCTION_KV}"

[[d1_databases]]
binding = "DB"
database_name = "fgo-farming-solver-db"
database_id = "${PRODUCTION_D1}"

[[previews.kv_namespaces]]
binding = "CLOUD_SAVE"
id = "${previewKv}"

[[previews.d1_databases]]
binding = "DB"
database_name = "fgo-farming-solver-preview-db"
database_id = "${previewD1}"
`

describe('productionIdsInPreviews', () => {
  it('allows production ids at the top level when previews use other ids', () => {
    expect(productionIdsInPreviews(toml(PREVIEW_KV, PREVIEW_D1))).toEqual([])
  })

  it('fails when a preview KV id is a production id', () => {
    expect(productionIdsInPreviews(toml(PRODUCTION_KV, PREVIEW_D1))).toEqual([
      PRODUCTION_KV,
    ])
  })

  it('fails when a preview D1 id is a production id', () => {
    expect(productionIdsInPreviews(toml(PREVIEW_KV, PRODUCTION_D1))).toEqual([
      PRODUCTION_D1,
    ])
  })

  it('fails on a commented header and a literal string', () => {
    expect(
      productionIdsInPreviews(`
[[previews.kv_namespaces]] # comment
id = '${PRODUCTION_KV}'
`),
    ).toEqual([PRODUCTION_KV])
  })

  it('fails on a known production id even when the top level changes', () => {
    expect(
      productionIdsInPreviews(`
[[d1_databases]]
database_id = "${PREVIEW_D1}"

[[previews.d1_databases]]
database_id = "${PRODUCTION_D1}"
`),
    ).toEqual([PRODUCTION_D1])
  })

  it('passes when the previews block is absent', () => {
    expect(
      productionIdsInPreviews(`
[[kv_namespaces]]
id = "${PRODUCTION_KV}"
`),
    ).toEqual([])
  })
})
