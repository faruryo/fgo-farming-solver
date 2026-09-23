import type { KVNamespace } from '@cloudflare/workers-types'
import { JTI_KEY_PREFIX, JTI_TTL_SECONDS, type EnvSource } from './policy'

export type RuntimeBindings = {
  env: EnvSource
  consumeJti: (jti: string) => Promise<boolean>
}

const stringEnv = (): EnvSource => ({ ...process.env })

export const kvConsumeJti =
  (kv: KVNamespace) =>
  async (jti: string): Promise<boolean> => {
    const key = `${JTI_KEY_PREFIX}${jti}`
    if ((await kv.get(key)) !== null) return false
    await kv.put(key, '1', { expirationTtl: JTI_TTL_SECONDS })
    return true
  }

export const readRuntimeBindings = async (): Promise<RuntimeBindings> => {
  const env = stringEnv()
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env: bindings } = (await getCloudflareContext({ async: true })) as unknown as {
      env: Record<string, unknown>
    }
    const strings = Object.fromEntries(
      Object.entries(bindings).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
    Object.assign(env, strings)
    const kv = bindings.CLOUD_SAVE
    if (kv && typeof kv === 'object' && 'get' in kv && 'put' in kv) {
      return { env, consumeJti: kvConsumeJti(kv as KVNamespace) }
    }
  } catch {
    // next dev has no worker binding. Preview login is not the localhost path.
  }
  return { env, consumeJti: async () => false }
}
