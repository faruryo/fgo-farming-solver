/**
 * 本番の MASTER_DATA からプレビュー用の MASTER_DATA へ、アプリが読むキーを写す。
 * 写す先は wrangler.toml の previews から読み、本番の ID なら書かない。
 */
import { parse } from 'smol-toml'
import { KNOWN_PRODUCTION_IDS, bindingIds } from './preview-binding-guard'

// アプリが読むキーだけ。更新処理だけが使うキャッシュ(nice_war_aaquests 等)は写さない
export const SYNCED_KEYS = [
  'all_drops_json',
  'dashboard_meta',
  'event_data_json',
  'material_catalog_v1',
  'rarity_ap_tables',
  'servants_list',
] as const

export type SyncTarget =
  | { namespaceId: string; reason?: undefined }
  | { namespaceId?: undefined; reason: string }

type KvBinding = { binding?: unknown; id?: unknown }

const previewMasterDataId = (previews: unknown): unknown => {
  const kv = (previews as { kv_namespaces?: unknown } | undefined)?.kv_namespaces
  if (!Array.isArray(kv)) return undefined
  return (kv as KvBinding[]).find((b) => b.binding === 'MASTER_DATA')?.id
}

export const previewMasterDataTarget = (toml: string): SyncTarget => {
  const config = parse(toml) as Record<string, unknown>
  const production = new Set([
    ...KNOWN_PRODUCTION_IDS,
    ...bindingIds(config.kv_namespaces),
    ...bindingIds(config.d1_databases),
  ])
  const id = previewMasterDataId(config.previews)
  if (typeof id !== 'string')
    return { reason: 'previews has no MASTER_DATA kv namespace id' }
  if (production.has(id))
    return { reason: `previews MASTER_DATA id ${id} is a production id` }
  return { namespaceId: id }
}

export type KeyValues = ReadonlyMap<string, string | null>

export type KeyPlan = {
  write: string[]
  skipped: { key: string; reason: 'missing in production' | 'unchanged' }[]
}

export const planKeys = (production: KeyValues, preview: KeyValues): KeyPlan => {
  const plan: KeyPlan = { write: [], skipped: [] }
  for (const key of SYNCED_KEYS) {
    const value = production.get(key) ?? null
    if (value === null) plan.skipped.push({ key, reason: 'missing in production' })
    else if (value === (preview.get(key) ?? null))
      plan.skipped.push({ key, reason: 'unchanged' })
    else plan.write.push(key)
  }
  return plan
}

export type SyncDeps = {
  toml: string
  getProduction: (key: string) => Promise<string | null>
  getPreview: (namespaceId: string, key: string) => Promise<string | null>
  putPreview: (namespaceId: string, key: string, value: string) => Promise<void>
  log?: (message: string) => void
  error?: (message: string) => void
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** 終了コードを返す。0 = 成功、1 = 写す先が決まらない、または失敗したキーがある */
export async function syncPreviewMasterData(deps: SyncDeps): Promise<number> {
  const log = deps.log ?? console.log
  const error = deps.error ?? console.error

  const target = previewMasterDataTarget(deps.toml)
  if (target.namespaceId === undefined) {
    error(`sync aborted: ${target.reason}`)
    return 1
  }
  const namespaceId = target.namespaceId
  log(`sync target: preview MASTER_DATA ${namespaceId}`)

  const failed: string[] = []
  const production = new Map<string, string | null>()
  const preview = new Map<string, string | null>()
  for (const key of SYNCED_KEYS) {
    try {
      production.set(key, await deps.getProduction(key))
      preview.set(key, await deps.getPreview(namespaceId, key))
    } catch (e) {
      error(`failed: ${key} (read): ${message(e)}`)
      production.delete(key)
      failed.push(key)
    }
  }

  const plan = planKeys(production, preview)
  for (const { key, reason } of plan.skipped.filter((s) => !failed.includes(s.key)))
    log(`skipped: ${key} (${reason})`)

  for (const key of plan.write) {
    try {
      await deps.putPreview(namespaceId, key, production.get(key) as string)
      log(`written: ${key}`)
    } catch (e) {
      error(`failed: ${key} (write): ${message(e)}`)
      failed.push(key)
    }
  }

  if (failed.length === 0) return 0
  error(`sync failed for: ${failed.join(', ')}`)
  return 1
}
