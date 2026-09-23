import type { D1Database } from '@cloudflare/workers-types'
import { d1ConsumeJti } from './jti'
import type { EnvSource } from './policy'

export type RuntimeBindings = {
  env: EnvSource
  consumeJti: (jti: string) => Promise<boolean>
}

const stringEnv = (): EnvSource => ({ ...process.env })

const isD1 = (value: unknown): value is D1Database =>
  typeof value === 'object' &&
  value !== null &&
  'prepare' in value &&
  typeof value.prepare === 'function'

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
    if (isD1(bindings.DB)) return { env, consumeJti: d1ConsumeJti(bindings.DB) }
  } catch {
    // next dev has no worker binding. Preview login is not the localhost path.
  }
  return { env, consumeJti: async () => false }
}
