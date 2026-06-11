/**
 * Cloudflare KV への REST API アクセスヘルパー(CI 用)。
 * 要 env: CLOUDFLARE_API_TOKEN(Workers KV Storage:Edit)/ CLOUDFLARE_ACCOUNT_ID。
 *
 * DRY_RUN=1 のとき書き込みをスキップし、読み込みは localFiles に登録された
 * ローカルファイルへフォールバックする(ローカル検証用)。
 * run-updater.ts / run-rarity-updater.ts で共有。
 */
import { readFileSync, existsSync } from 'node:fs'

export const MASTER_DATA_NAMESPACE_ID = '306bbe537e9d4907809f82468df500e4'

const DRY_RUN = process.env.DRY_RUN === '1'

const kvUrl = (key: string) => {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!account) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set')
  return `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${MASTER_DATA_NAMESPACE_ID}/values/${key}`
}

const authHeaders = () => {
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set')
  return { Authorization: `Bearer ${token}` }
}

/** DRY_RUN 時の読み込み元(key → ローカルファイルパス)。スクリプト側で登録する。 */
export const dryRunLocalFiles: Record<string, string> = {}

export async function kvGet(key: string): Promise<string | null> {
  if (DRY_RUN) {
    const p = dryRunLocalFiles[key]
    if (p && existsSync(p)) {
      console.log(`[dry-run] kvGet ${key} <- ${p}`)
      return readFileSync(p, 'utf8')
    }
    console.log(`[dry-run] kvGet ${key} -> null`)
    return null
  }
  const res = await fetch(kvUrl(key), { headers: authHeaders() })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`KV get ${key} failed: ${res.status} ${await res.text()}`)
  return await res.text()
}

export async function kvPut(key: string, value: string): Promise<void> {
  if (DRY_RUN) {
    console.log(`[dry-run] kvPut ${key} (${(value.length / 1024).toFixed(1)} KB) skipped`)
    return
  }
  const res = await fetch(kvUrl(key), {
    method: 'PUT',
    headers: { ...authHeaders(), 'Content-Type': 'text/plain' },
    body: value,
  })
  if (!res.ok) throw new Error(`KV put ${key} failed: ${res.status} ${await res.text()}`)
}
